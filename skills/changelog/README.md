# changelog

Author, refresh, or repair the changelog entry for the current branch under
`changelog/YYYYMMDD-HHMMSS-<slug>.md` — derive metadata, write the frontmatter and
grouped body, run the deterministic enrichment scripts, and validate against the
changelog contract.

## Install

From any consumer repo:

```bash
npx skills add https://github.com/acme-skunkworks/agent-skills --skill changelog --agent claude-code --agent cursor --copy
```

`--copy` writes real files so the bundle is portable. Don't use `-g` / `--global`
— the install should live in the consumer repo.

## Configure

The shipped [`config.json`](config.json) carries **ACME Skunkworks defaults** —
update them for your organisation on install, or issue-ID detection and Linear
links will be wrong. A neutral [`config.example.json`](config.example.json) ships
alongside it as a template — copy it over `config.json` or edit `config.json`
directly.

| Key | Meaning | Default |
| --- | --- | --- |
| `issueKeys` | Team-key prefixes used to recognise issue IDs in the branch and body. Keep legacy keys so old branches still match. | `["ASW", "AKW", "SKW"]` |
| `linearWorkspaceSlug` | Linear workspace slug for issue links (`https://linear.app/<slug>/issue/<id>`). | `"goose-and-hobbes"` |
| `baseBranch` | Trunk the branch diff is taken against (`origin/<baseBranch>`); `BASE_REF` env overrides per-run. | `"main"` |

## Requirements

- **Node.js ≥22** for the bundled scripts. They use **only Node built-ins** — no
  `npm install`, no build step.
- The **`git` CLI** for branch and diff analysis.
- **pnpm** *only* for the optional `preflight-changelog-ci.mjs` step (Node/lockfile
  CI-parity). Skip that step if your repo doesn't use pnpm.

## What it does

Detects the branch's existing entry (idempotent update-vs-create), derives the
metadata from git and the diff, writes the frontmatter + grouped/categorised body,
runs the enrichment scripts (`set-affected-packages.mjs`, `add-links.mjs`), and
validates with `validate-changelog.mjs`. `created_at` is set once and never
overwritten; `stats` and the post-merge fields are left blank for the release step.

Run standalone via `/changelog` (writes/validates, leaves the entry **uncommitted**)
or as the changelog step inside a ship flow. See [`SKILL.md`](SKILL.md) for the
six-step process and [`references/changelog-contract.md`](references/changelog-contract.md)
for the full frontmatter schema and field-ownership rules.

## Scripts and tests

The bundled scripts are the **zero-dependency `.mjs`** set (Node built-ins only),
deliberately chosen so the bundle is drop-in with no tooling. Their **unit tests
are maintained in the [`agent-skills`](https://github.com/acme-skunkworks/agent-skills)
repo**, not bundled into the skill — see that repo's test suite for coverage.
