# Changelog entry contract

The full frontmatter schema and field-ownership rules the `changelog` skill
enforces. The bundled `scripts/validate-changelog.mjs` is the executable form of
this contract.

## Frontmatter schema

Preserve this field order. Emit `affected_packages: []` as a placeholder — the
enrichment script fills it in place.

```yaml
---
title: "Concise summary"
release_note: "One-sentence user-facing summary"
created_at: "2026-04-26T13:24:00Z"
merged_at:
branch: "<current-branch>"
pr:
commit:
merge_strategy:
author: "you@example.com"
co_authors: []
category: feature
breaking: false
issues: ["ASW-123"]
affected_packages: []
stats:
  files_changed:
  loc_added:
  loc_removed:
---
```

## Required fields

`validate-changelog.mjs` requires: `title`, `created_at`, `branch`, `author`,
`category`, `breaking`, `co_authors`, and a `stats` object. Other fields are
validated **by type when present** but may be blank placeholders until enrichment.

## Field types and rules

| Field | Rule |
| ----- | ---- |
| `title` | Non-empty string. |
| `release_note` | String or `null`/blank when present. |
| `created_at` | ISO 8601 UTC with `Z` suffix, quoted. **Set once; never overwritten.** |
| `merged_at` | ISO 8601 UTC with `Z` suffix when set; blank until release. |
| `branch` | Non-empty string — the stable lookup key for enrichment. |
| `pr` | Integer when set; blank until the PR exists. |
| `commit` | 7-char hex SHA when set; blank until merge. |
| `merge_strategy` | One of `merge`, `rebase`, `squash`; blank until merge. |
| `author` | Non-empty string (an email). |
| `co_authors` | Array of strings (`[]` when none). |
| `category` | One of `feature`, `fix`, `chore`, `docs`, `refactor`, `perf`. |
| `breaking` | Boolean. If `true`, the body MUST contain a `## Breaking` section. |
| `issues` | Array of strings, each matching `[A-Z]{2,}-\d+`. |
| `affected_packages` | Array of strings (`[]` when unpopulated). |
| `stats.{files_changed,loc_added,loc_removed}` | Non-negative integers when set; blank until release. |

The filename must match `YYYYMMDD-HHMMSS-<slug>.md` (slug `[a-z0-9-]+`), and the
body must contain at least one of `## Breaking` / `## Added` / `## Changed` /
`## Fixed`.

## Field ownership boundaries

Three owners, never overlapping:

1. **The author (this skill).** `title`, `release_note`, `category`, `breaking`,
   `issues`, `co_authors`, `author`. Re-derived on every run.
2. **The enrichment scripts (deterministic, pre-merge).** `affected_packages` —
   `set-affected-packages.mjs` always overwrites it from the latest branch diff,
   so it tracks added commits. `add-links.mjs` rewrites bare issue IDs in the body
   to Linear links.
3. **The release-orchestrator (post-merge, privileged).** `merged_at`, `commit`,
   `merge_strategy`, and authoritative `stats`, plus the published `version` where
   a consumer adds one. Emit these as blank placeholders; never hand-edit them —
   so an in-flight PR never shows numbers that drift as commits land.

`branch` is set by the author at create time and is the stable lookup key for
enrichment. `pr` is **back-filled by the ship flow** (`/send-it`) when the PR is
opened — left blank by the author and untouched by enrichment until then.

`created_at` is **sacred**: set once at create time, preserved verbatim on every
update. The release step refuses to finalise an entry without it.

## Body structure

```markdown
## Breaking <!-- only when breaking: true -->

- Description and migration steps

## Added

- Description

## Changed

- ...

## Fixed

- ...
```

Only include `Added` / `Changed` / `Fixed` headings that have entries.

## Notes for adopters

- **Single-package repos** can drop `affected_packages` from the schema (there is
  only one package) and skip `set-affected-packages.mjs`. The validator treats
  `affected_packages` as optional-when-present, so leaving it out is fine — but
  if you keep `validate-changelog.mjs` as shipped, it still requires `branch`,
  `author`, `co_authors`, and `stats`.
- **Adding a `version` field.** A single-versioned package may add `version` to
  record the release each entry shipped in; that is owned by the release step,
  alongside the other post-merge fields.
- The `issueKeys`, `linearWorkspaceSlug`, and `baseBranch` knobs in `config.json`
  are the only repo-specific inputs; everything else in the contract is generic.
