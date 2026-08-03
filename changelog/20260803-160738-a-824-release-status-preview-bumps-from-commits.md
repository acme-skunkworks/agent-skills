---
title: "release-status: preview bumps from commits since last tag (A-824)"
release_note: "release-status version preview now ranks Conventional-Commit subjects on commits since the last tag (merge commits excluded), matching release-please under multi-commit history."
created_at: "2026-08-03T16:07:38Z"
merged_at:
branch: a-824-validate-release-please-bump-derivation-under-multi-commit
pr:
commit:
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - A-824
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Added

- **`release-status`:** version preview reads **commits since the last tag**
  (`git log <tag>..HEAD --no-merges`) instead of merged PR titles, so the advisory
  bump matches release-please 17.9.0 under multi-commit (non-squash) history
  ([A-824](https://linear.app/acme-skunkworks/issue/A-824)).

## Changed

- Strongest-type ranking is unchanged (`feat`→minor, `fix`/`perf`/`revert`→patch,
  `!`/`BREAKING CHANGE:`→major; docs/chore/…→none). **Policy:** a `feat:` later
  `revert:`ed in the same window still implies **minor** — no cancel/netting —
  matching release-please's `DefaultVersioningStrategy`. Merge-commit subjects are
  excluded so a merge body's PR title is not double-counted against branch commits.
- Report JSON field `mergedPrCount` → `commitCount`; human copy updated accordingly.
- Skill bundle bumped `0.1.5` → `0.2.0`.
