# Fleet deployment runbook

How to roll the shared agent skills onto a target repo: cleanly remove whatever
bespoke skill/command files it already has, install the canonical set via the
[skills.sh](https://skills.sh) CLI, reconcile each skill's `config.json` from the
repo's own facts, and verify. Every per-repo adoption issue (A-449–A-454) shares
this mechanism — this is the single place it is defined, so those issues just
link here.

The flow is **wipe → install → reconcile → verify**. It is idempotent: re-running
it upgrades an existing install rather than duplicating it.

> **Scope.** This runbook lives in `agent-skills` and covers the repeatable
> mechanism plus the helper(s) this repo ships to support it. Migrating a
> specific target repo end-to-end is tracked under that repo's own adoption
> issue.

## The canonical skill set

All skills live under `skills/<name>/`. The seven shared skills:

| Skill | Purpose | Notes |
| --- | --- | --- |
| `send-it` | All-in-one finisher (commit → preflight → changelog → PR → Linear) | Delegates to `preflight`, `changelog`, `linear-sync` — install those alongside it. |
| `preflight` | Change-gated, branch-scoped lint | Self-configuring; reads an optional root `preflight.config.json`, no in-bundle `config.json`. |
| `changelog` | Author/refresh/validate dated changelog entries | Skip on repos with no changelog flow (see below). |
| `linear-sync` | Transition linked Linear issues | — |
| `cleanup-repo` | Prune merged branches, worktrees, filesystem cruft | — |
| `initialise-skills` | Reconcile every installed skill's `config.json` from repo facts | Run as step 3 of this flow. |
| `triage-pr` | Drive a PR from draft-with-failing-CI to merge-ready | Optional / standalone. |

**Set per repo type:**

- **Single-package repo with a release pipeline** — the full set.
- **Repo with no changelog/release flow** — omit `changelog`; `send-it`'s
  `changelog` config knob is detected as `false` by `initialise-skills`, so it
  skips authoring rather than following an uninstalled skill (A-452).
- **Monorepo** — the full set; `initialise-skills` detects the workspace and
  turns on the changelog `affectedPackages` field (A-461).

## Step 1 — Wipe existing

Remove the target repo's drifted, bespoke skill/command files so there is a clean
slate and no duplicate or competing definitions. Preview first.

**Remove:**

- Bespoke command shims under `.claude/commands/` that duplicate a canonical
  skill — e.g. a hand-rolled `.claude/commands/send-it.md` (the pattern every
  adoption issue calls out).
- Local prototype skill bundles under any agent skills dir (`.claude/skills/`,
  `.agents/skills/`, `.cursor/...`) that the shared set replaces. Find these by
  listing those dirs yourself (e.g. `ls .claude/skills .agents/skills`) — the
  helper below only flags dirs that share a canonical skill name, not
  arbitrarily-named prototypes.

**Preserve:**

- The repo's own `preflight.config.json` (a deliberate root-level override).
- Any already-reconciled per-skill `config.json` you intend to keep (a fresh
  install + `initialise-skills` will rewrite these anyway, but never delete a
  config you mean to carry forward).
- Anything genuinely repo-specific and not part of the shared set.

Use the bundled helper to preview and apply the command-shim removals:

```bash
# Preview (default — lists what would be removed, deletes nothing):
node infrastructure/scripts/fleet-wipe.mjs --repo /path/to/target

# Apply once the preview looks right:
node infrastructure/scripts/fleet-wipe.mjs --repo /path/to/target --apply
```

The helper only removes the canonical command shims it knows about
(`.claude/commands/<skill>.md`). Its "other candidates" list flags **only** skill
dirs whose name matches a canonical skill (a vendored install and a bespoke
prototype are indistinguishable by name, so it never auto-deletes them) — it does
**not** discover arbitrarily-named prototype dirs. Review the candidates it lists,
and separately scan the agent skill dirs yourself for any other bespoke bundles to
remove by hand.

## Step 2 — Install via skills.sh

Install the chosen set with `--copy` so each repo vendors a stable bundle (real
files, not symlinks):

```bash
npx skills add https://github.com/acme-skunkworks/agent-skills \
  --skill send-it --skill preflight --skill changelog --skill linear-sync \
  --skill cleanup-repo --skill initialise-skills \
  --agent claude-code --agent cursor --copy
```

Omit `--skill` entirely to install all skills, or repeat it per skill for a
subset. Never use `-g` / `--global` — installs belong in the consumer repo.

### Pinning and reproducibility

The skills.sh CLI has **no `--ref` flag** (ADR-0001 Decision 4), so `npx skills
add <url>` resolves the repo's default branch (`main`). `main` is kept
release-ready, so this is the normal path. For a reproducible, pinned install:

```bash
git clone --branch <tag> https://github.com/acme-skunkworks/agent-skills /tmp/agent-skills-<tag>
npx skills add /tmp/agent-skills-<tag> --skill <name> --agent claude-code --copy
```

(The `tree/<ref>/skills/<name>` URL form may also resolve a tag, but is not
officially supported by the CLI — prefer the local-clone path.)

### Re-install / upgrade behaviour

`npx skills add … --copy` over an existing copy **overwrites** the vendored
bundle files in place — it is the upgrade path, not a duplicator. To move a repo
to a newer bundle, re-run the same `add` command; then re-run step 3 (reconcile)
to pick up any new config keys. Because agent-skills no longer ships a
`config.json` (only the neutral `config.example.json` travels — A-615), an upgrade
re-copies the example but **never touches your own `config.json`**, so your
reconciled values — including deliberate no-detector edits — survive untouched.
Because installs are `--copy`, an upgrade is a clean file replacement with no
symlink drift.

> **No config reset needed (A-615).** Earlier revisions of this runbook had a
> "reset each `config.json` from its example" step here, because `skills add`
> used to vendor agent-skills' *own* config values into the consumer (A-554), and
> upgrades re-vendored them (regressing no-detector edits — A-612). agent-skills
> now gitignores its per-skill `config.json` and ships only `config.example.json`,
> so there is nothing to scrub: go straight from install to reconcile.

## Step 3 — Reconcile config

Write each skill's `config.json` from detected repo facts (base branch, package
roots, changelog dir, Linear keys, review bots, …). On a fresh install the
consumer has only `config.example.json` (agent-skills ships no `config.json` —
A-615), so `initialise-skills` **creates** each `config.json` from the example's
key set plus the detected/supplied facts. Dry-run first; it is idempotent and
never clobbers a deliberate edit (drift is reported, not overwritten).

```bash
# Preview:
node <skills-dir>/initialise-skills/scripts/initialise.mjs --dry-run

# Write, supplying the facts the script can't derive from git/fs:
echo '{"facts":{"linearTeamName":"…","linearWorkspaceSlug":"…","issueKeys":["A"]}}' \
  | node <skills-dir>/initialise-skills/scripts/initialise.mjs --write
```

`<skills-dir>` is wherever `skills add` vendored the bundles (e.g.
`.claude/skills/`). See
[`skills/initialise-skills/references/detectable-keys.md`](../skills/initialise-skills/references/detectable-keys.md)
for the full key → detection-source table.

> **Renamed Linear team?** `issueKeys` is auto-detected from branch-name prefixes,
> preferring the most recently committed branch (A-556). If the team key was renamed
> and stale branches still carry old prefixes — or detection is otherwise wrong (e.g.
> a fresh repo with no keyed branches yet) — pass the canonical key(s) as a fact
> (`"issueKeys":["A"]`, as above) to override. The `facts.issueKeys` value always
> wins over detection, so it is the canonical fix for a renamed team.

## Step 4 — Verify

1. **Idempotency** — re-run `initialise.mjs --dry-run`; the second run must report
   no inferred changes (every key `unchanged`/`drift`/`manual-kept`).
2. **Safe previews** — exercise each installed skill's read-only path (e.g.
   `/preflight`, `changelog` validate, `cleanup-repo --dry-run`) and confirm it
   resolves config and runs without error.
3. **Bundle metadata** — if the target repo runs the validator, `pnpm
   validate:skills` confirms each bundle's `package.json` ↔ `SKILL.md`
   `metadata.version` parity.
4. **CI unaffected** — confirm the install added only vendored skill files and
   touched no CI config.

## Checklist

- [ ] Previewed and wiped bespoke command shims / prototype skills (step 1).
- [ ] Installed the repo-type-appropriate set via `skills add … --copy` (step 2).
- [ ] Reconciled config with `initialise-skills` `--dry-run` then `--write`, supplying `facts.issueKeys` for a renamed team (step 3).
- [ ] Verified idempotency, safe previews, and CI (step 4).
