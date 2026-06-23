---
title: "Add the changelog skill"
release_note: "Adds a changelog skill that is the single source of truth for the changelog-entry contract."
version:
created_at: "2026-06-01T17:10:36Z"
merged_at:
branch: "asw-351-port-the-changelog-skill-into-the-shared-agent-skills-repo"
pr: 21
commit:
merge_strategy:
author: "rob@acmeskunkworks.io"
co_authors: []
category: feature
breaking: false
issues: ["ASW-351"]
affected_packages: []
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Added

- New `changelog` skill under `skills/changelog/`: the single source of truth for
  the changelog-entry contract — frontmatter schema, idempotent update-vs-create,
  field-ownership boundaries (`created_at` sacred; `stats` and post-merge fields
  left to the release step), grouped/categorised body generation, and the
  validate gate.
- Bundles the zero-dependency `.mjs` enrichment and validation scripts (Node
  built-ins only, no build step): `set-affected-packages`, `add-links`,
  `preflight-changelog-ci`, `validate-changelog`, plus shared `scripts/lib`
  helpers (`changelog`, `derive-packages`, `frontmatter`, `config`).
- Issue-ID prefixes, the Linear workspace slug, and the base branch are
  parameterised via `config.json` (with a neutral `config.example.json`).
- A local `/changelog` command wrapper runs the standalone write/validate flow,
  and `references/changelog-contract.md` documents the full schema and
  field-ownership rules.

## Changed

- Document `pr` as a fourth field owner (the ship flow) in `changelog-contract.md`.
- Surface malformed `config.json` parse errors with the file path instead of silently falling back to defaults.
- Show vendored `skills/changelog/scripts/` paths in `SKILL.md` enrichment examples.
