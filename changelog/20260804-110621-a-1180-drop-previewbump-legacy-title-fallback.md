---
title: "release-status: drop previewBump legacy title fallback"
release_note: ""
created_at: "2026-08-04T11:06:21Z"
merged_at:
branch: a-1180-release-status-drop-previewbump-legacy-title-fallback
pr:
commit:
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - A-1180
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Changed

- **`release-status` (0.2.0 → 0.2.1):** drop the unused `commit.title` fallback in
  `previewBump`, remove the self-serving vitest case, and update the JSDoc so the
  helper only documents `{ subject, body }` — the only shape
  `parseGitLog` / `fetchCommitsSinceLastTag` ever emit
  ([A-1180](https://linear.app/acme-skunkworks/issue/A-1180)).
