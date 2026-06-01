---
"@acme-skunkworks/agent-skills": minor
---

Add the `changelog` skill: the single source of truth for the changelog-entry contract — frontmatter schema, idempotent update-vs-create, field-ownership boundaries (`created_at` sacred; `stats` and post-merge fields owned by the release step), grouped/categorised body generation, and the validate gate. Bundles the zero-dependency `.mjs` enrichment and validation scripts (Node built-ins only, no build step): `set-affected-packages`, `add-links`, `preflight-changelog-ci`, `validate-changelog`, plus shared `scripts/lib` helpers. Issue-ID prefixes, the Linear workspace slug, and the base branch are configurable via `config.json`, and a local `/changelog` command wrapper runs the standalone write/validate flow.
