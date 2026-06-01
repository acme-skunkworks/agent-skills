---
title: "Pin GitHub Actions to commit SHAs"
release_note: "Pins all remaining workflow actions to full-length commit SHAs to satisfy the org policy."
version: "0.0.1"
created_at: "2026-05-29T18:04:01Z"
merged_at: "2026-05-30T22:30:19Z"
branch: "ci-pin-actions-to-commit-shas"
pr: 11
commit: "42cff84"
merge_strategy: squash
author: "rob@acmeskunkworks.io"
co_authors: []
category: chore
breaking: false
issues: []
stats:
  files_changed: 3
  loc_added: 8
  loc_removed: 7
---

## Changed

- Pinned `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`, and `anthropics/claude-code-action` in `claude.yml`, `claude-code-review.yml`, and `validate.yml` to the same full-length commit SHAs already used by `release.yml`, satisfying the org's SHA-pinning policy (one consistent SHA per action across the repo).
- Added `persist-credentials: false` to the `validate.yml` checkout.
