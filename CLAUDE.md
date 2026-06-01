# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Writing style

Use **British English** spelling and grammar in all prose you author for this repo: code comments, documentation (this file, ADRs, READMEs, `.changeset/*.md`), commit messages, PR titles and bodies, and user-facing strings.

- **Spelling.** Prefer British forms: *colour*, *behaviour*, *organisation*, *centre*, *catalogue*, *recognise*, *analyse*, *licence* (noun) / *license* (verb), *-ise*/*-yse* over *-ize*/*-yze*.
- **Grammar and punctuation.** British conventions where they differ from American: single quotes are acceptable when quoting; place full stops outside closing quotation marks when the quoted phrase is partial; *whilst* and *amongst* are fine; collective nouns may take a plural verb ('the team are' / 'the team is' are both fine — pick whichever reads better).
- **Scope: prose, not code.** This rule applies to text written for humans. It does **not** apply to identifiers, dependency names, third-party API field names, or quoted upstream text that already uses US spelling. Examples of things to leave alone: CSS `color`, `background-color`; package names like `serialize-javascript`; API fields like `analyze_url`; quoted error messages from upstream tools.
- **When in doubt, follow upstream.** If you're touching code that mirrors an external API or library, match the upstream spelling exactly — even in surrounding comments where that name appears. Consistency with the thing being wrapped beats consistency with this rule.

## Repo

Container for shared agent skills, distributed via [skills.sh](https://skills.sh). Each skill lives under `skills/<name>/` as a skills.sh-compatible bundle (with a `SKILL.md` manifest at its root); consumers install via `npx skills add` against this repo's URL.

The root package is `@acme-skunkworks/agent-skills` (`private: true` initially — flipped when there's a reason to publish the root itself). Versioning is via Changesets, mirroring the setup in sibling repos `@acme-skunkworks/eslint-config` and `@acme-skunkworks/markdownlint-config`.

Architectural decisions live under `architecture/` as ADRs (sequentially numbered, immutable once landed). ADR-0001 (forthcoming — ASW-133) settles the deeper questions — skill directory layout, distribution conventions, semver discipline — that this bootstrap deliberately defers.

## Commands

```bash
pnpm install              # install deps (runs husky via the prepare script)
pnpm changeset            # interactive changeset (or hand-write .changeset/<slug>.md)
pnpm changeset status     # show pending changesets and what would be released
pnpm changeset:version    # changeset version + changelog:finalise (orchestrator-run at release)
pnpm test                 # vitest — changelog + send-it helper unit tests
pnpm validate:changelog   # validate changelog/<ts>-<slug>.md entries against the schema
```

Node 22 required (`.nvmrc`, `engines.node: ">=22"`, `engine-strict=true` in `.npmrc`).

## Conventions

- **Conventional Commits.** Commits follow `<type>(<scope>?): <subject>` (e.g. `feat(cleanup-repo): add stale-branch prune step`, `chore: bump @changesets/cli`). Enforced by convention only for now — no commitlint until the repo has enough churn to justify it.
- **Draft PRs.** Open PRs as drafts by default; flip to ready when CI is green and the work is review-ready.
- **Changesets per behavioural change.** Every PR that ships a skill change or a new skill includes a `.changeset/<slug>.md`. Tooling-only PRs (CI tweaks, dependency bumps that don't affect consumers) can skip.
- **Branch naming.** `<linear-id>-<slug>` lower-cased, matching Linear's `gitBranchName` (e.g. `asw-132-set-up-the-agent-skills-repo`).

## Shipping changes (`/send-it`)

`/send-it` (`.claude/commands/send-it.md` plus `infrastructure/send-it/`) is the all-in-one finisher: it commits uncommitted work as atomic Conventional Commits, writes or updates a `.changeset/<slug>.md` **and a dated `changelog/<ts>-<slug>.md` companion**, pushes the branch, opens or updates a draft PR, and transitions linked Linear issues to **In Review**. Prefer it over hand-rolled `git commit` + `git push` + `gh pr create` flows.

Common invocations:

```bash
/send-it                              # commit + changeset + push + draft PR
/send-it --issue=ASW-132              # same, plus prefix the auto-branch with asw-132-
/send-it --ready                      # open the PR as ready-for-review (not draft)
/send-it --merge-when-ready           # enable gh pr merge --auto --squash after creation
/send-it --worktree=<branch-or-path>  # cd into a worktree first, then run
```

**`/send-it` here is a stopgap.** It was cloned from `@acme-skunkworks/eslint-config`'s `/send-it` and lightly adapted. The whole point of the Agent Skills project is to extract `/send-it` into a single reusable skill so the per-repo copies disappear. When that skill ships, this slash command and `infrastructure/send-it/` get deleted and replaced by `npx skills add … --skill send-it`. Tracked in the Agent Skills Linear project.

## Release

`.github/workflows/release.yml` is **publish-only** and runs on every push to `main` (no `workflow_dispatch` — ASW-326). It never opens or merges the version PR. Versioning is owned by the private **road-runner-bot `release-orchestrator`** repo, mirroring `@acme-skunkworks/eslint-config` (ASW-311 / ASW-312 / ASW-320). It is a **build-once-publish-exact 3-job split** (ASW-328): an unprivileged `build` job (`pnpm install` + `npm pack` — no compile step; agent-skills ships skills.sh bundles) packs one tarball and uploads it as an artifact; `release` (npm OIDC) and `publish-github-packages` (GitHub-native provenance attestation) each download and publish that exact tarball, so the npm tarball, the GitHub Packages tarball, and the attested digest are byte-identical and no build-time code runs alongside a publish credential. Non-secret knobs (node-version-file, registry URLs, npm scope) come from `infrastructure/repo-config.yaml` via the `load-repo-config` composite action (allowlist-validated → `GITHUB_OUTPUT`, ASW-330). `files: ["skills/"]` in `package.json` scopes the tarball to the skill bundles. Publishing is dual-registry (public npm + GitHub Packages) and **dormant by design**: both publish scripts guard on `private: true` and `exit 0` while the root package is private, so the full machinery runs green and publishes nothing. (The guard matters because these scripts call raw `npm publish`, which — unlike `pnpm changeset publish` — *errors* on a private package rather than skipping it; without the guard the release job would go red.)

### How a release flows

1. A feature PR with a `.changeset/*.md` merges to `main`. `release.yml` fires, **detects pending changesets**, and is a clean no-op (it only publishes when there are none).
2. On its 15-minute cron tick the orchestrator sees the pending changeset, mints a short-lived repo-scoped App token (the bot's private key **never** touches this public repo's CI), runs `pnpm changeset:version` (which is `changeset version && pnpm changelog:finalise` — the latter enriches + version-stamps the dated `changelog/` entries), and opens a `changeset-release/main` PR titled `<pkg>@<version>`.
3. The orchestrator waits for the required **`🔬 Build & Lint`** check (the `build-and-lint` job in `validate.yml`, which deliberately runs on the version PR), then squash-merges it.
4. That merge re-fires `release.yml`, which now finds **no** pending changesets and runs the publish path: `build` packs the tarball, then `release` (npm OIDC) + `publish-github-packages` (provenance attestation) publish that exact artifact, plus an explicit idempotent git tag / GitHub release. While `private: true`, both publish legs `exit 0` — green, ships nothing. A `🚨 Notify on release failure` step opens/updates a tracking issue if any step fails (the run is unattended).

- **npm leg.** `changesets/action`'s `publish:` input is `scripts/publish-via-raw-npm.sh`, not `pnpm changeset publish` — pnpm's OIDC path fails from inside the action even with an upgraded npm on `PATH` (eslint-config ASW-174). The wrapper publishes the prebuilt `$TARBALL` from the `build` job via `npm publish "$TARBALL" --access public --provenance` (the upgraded npm), and is idempotent (skips only on a genuine `npm view` hit — exit 0 *with* output — and `exit 0`s early while `private: true`). Auth is OIDC Trusted Publishing — **no `NPM_TOKEN`**. Needs npm ≥ 11.5.1, hence the "Upgrade npm" step (the runner ships npm 10.9.x, which is both too old and broken on self-upgrade). The step is gated on `push` + `refs/heads/main` + no-pending-changesets, alongside the branch-restricted `npm-release` environment (ASW-326).
- **GitHub Packages leg.** A separate job (so `packages: write` never coexists with the npm OIDC credential). `actions/attest-build-provenance` signs the exact tarball, then `scripts/publish-to-github-packages.sh` publishes it. Gated on the same no-pending-changesets + main-only condition (reused via the `release` job's output). It's idempotent against `npm.pkg.github.com`, uses token auth via `GITHUB_TOKEN` (no OIDC; `npm --provenance` is npmjs.org-only, so provenance rides the attestation instead), hard-codes the registry host and fails closed on drift (ASW-330), and carries the same `private: true` `exit 0` guard.

Both publish scripts are exercised by bats tests in `infrastructure/tests/` (run in `validate.yml`'s `infra` job alongside shellcheck); the dated-changelog `.ts` helpers (`infrastructure/scripts/*-changelog.ts`, `infrastructure/send-it/derive-changeset.ts`) have vitest unit tests run in `build-and-lint`. Workflow YAML is linted by digest-pinned `yamllint` + `actionlint` (`infrastructure/scripts/ensure-*.sh`, ASW-327) in the `yaml-lint` job.

### One-time setup (out of band, operator)

The orchestrator model needs server-side config that lives outside this repo:

1. **Add `agent-skills` to the orchestrator matrix** — `strategy.matrix.repo` in `release-orchestrator/.github/workflows/orchestrate-releases.yml` (a separate PR in that repo). This is the only orchestrator-side change; there is no central allowlist file.
2. **Install road-runner-bot** on `agent-skills` with `contents: write` + `pull-requests: write`. Its private key stays scoped to the orchestrator repo — never broaden it here.
3. **Create the `npm-release` environment** restricted to `main` (defence-in-depth, ASW-326). Without it the workflow still runs — GitHub auto-creates an *unprotected* environment on first use and publishing stays gated by the explicit `push` + `refs/heads/main` step guards — so this adds the structural branch restriction on top:

   ```bash
   gh api -X PUT repos/acme-skunkworks/agent-skills/environments/npm-release \
     --input - <<<'{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
   gh api -X POST repos/acme-skunkworks/agent-skills/environments/npm-release/deployment-branch-policies \
     -f name=main -f type=branch
   ```

4. **Make `🔬 Build & Lint` a required status check** on `main` (exact name, incl. emoji — the orchestrator polls it verbatim). Add it to a **repo-level** ruleset / branch-protection rule on `agent-skills`, *not* the org-level "Protect main trunk" ruleset (that governs every org repo). Do this **after this PR merges** — the renamed job only reaches `main` then, and requiring it earlier would block sibling PRs still on the old job name. The job already runs on `changeset-release/*` (no skip), so the orchestrator's version PRs satisfy it. Keep "Allow GitHub Actions to create and approve pull requests" **off**; enable "Allow auto-merge".

> **60-day caveat.** The orchestrator's schedule auto-disables after 60 days with no commits to the orchestrator repo — releases then stop silently. Keep it alive (a periodic commit, or an external cron trigger).

### Flip-to-public checklist (the deferred first live publish)

When the root — or an extracted package — becomes publishable, the release machinery is already in place; flipping it on is mechanical:

1. **Configure the npm Trusted Publishing allowlist** on [npmjs.com](https://npmjs.com) for the package. The workflow filename (`release.yml`) and the `acme-skunkworks/agent-skills` repo must match the allowlist entry exactly, or OIDC publish 404s (eslint-config ASW-174).
2. **Set `private: false`** in `package.json`. `publishConfig` (`access: public`, `provenance: true`, registry) is already present. Note the publish scripts stop short-circuiting the moment this flips — they will publish on the next version-PR merge.
3. **Land a changeset** so the orchestrator cuts a version and the publish steps fire on the next push to `main`.
4. The GitHub Packages leg needs no extra config — `packages: write` and the `GITHUB_TOKEN` auth are already wired.

`validate.yml` has four jobs: **`🔬 Build & Lint`** (the required gate — runs on the version PR; hard-gates on the frozen-lockfile install, the vitest unit tests, and `pnpm validate:changelog`, with `changeset status` kept informational), **`yaml-lint`** (digest-pinned yamllint + actionlint), **`infra`** (shellcheck + bats over the publish scripts), and **`skill-manifests`** (validates every `skills/<name>/SKILL.md`). The latter three are skipped on `changeset-release/*` so the version PR isn't blocked on them.

The deeper eslint-config hardening that was deferred during the bootstrap — the build-once 3-job split + provenance attestation, the `load-repo-config` action, the dated-changelog system, and husky — **landed in [ASW-345](https://linear.app/acme-skunkworks/issue/ASW-345)** ahead of the publishing flip. The machinery is fully wired and exercised in CI, but stays dormant (publishing nothing) until `private: false`.

## Linear

- Workspace slug: `goose-and-hobbes`. Team key: `ASW` (ACME Skunkworks).
- When starting work on an ASW issue, transition it to `In Progress` via the Linear MCP (`mcp__linear-server__save_issue`) — unless it's already In Progress or further along.
- Transition to `In Review` when the PR opens. `Done` / `Canceled` stay manual or via Linear's GitHub integration on PR merge.

## Out of scope (deferred)

- **commitlint.** No commit-message linting until the repo has enough churn to justify it. Husky + lint-staged landed in [ASW-345](https://linear.app/acme-skunkworks/issue/ASW-345) (`.husky/pre-push` blocks direct `main` pushes, `pre-commit` runs lint-staged, `commit-msg` strips the Claude trailer), but the `commit-msg` hook does **not** enforce Conventional Commits — that stays convention-only for now.
