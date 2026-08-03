---
title: 'changelog: document multi-commit and merge-merge enrichment (A-825)'
release_note: Changelog authoring and finalise/enrich are documented and fixture-tested as safe across multi-commit branches and merge merges — one entry per branch, mergeCommit.oid for commit, non-merge commit counts.
created_at: '2026-08-03T17:55:00Z'
merged_at:
branch: a-825-validate-changelog-authoring-changelogfinalise-enrichment
pr:
commit:
author: rob@acmeskunkworks.io
co_authors: []
category: docs
breaking: false
issues:
  - A-825
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Changed

- **`changelog` skill (0.9.4 → 0.9.5):** document multi-commit / merge-commit
  behaviour in `SKILL.md` and `references/changelog-contract.md` — one dated
  entry per `branch:` (update vs create), post-merge `commit` from
  `mergeCommit.oid`, and `stats.commits` excluding branch merge commits
  ([A-825](https://linear.app/acme-skunkworks/issue/A-825)).
- **`finalise-changelog.mjs` / `commit-count.mjs`:** refresh header comments —
  production enrichment is `@acme-skunkworks/changelog-core` via
  `reusable-changelog-enrich.yml`; skill scripts remain published source.

## Added

- **Tests:** multi-commit branch fixtures in `commit-count.test.ts` and
  merge-merge `mergeCommit.oid` / commit-count coverage in
  `finalise-changelog.test.ts`.
