---
title: "Recognise Cursor Bugbot review-body summaries in triage-pr"
release_note: "triage-pr now surfaces Cursor Bugbot's per-PR review summary, so its headline review is consolidated alongside CodeRabbit's and Claude's."
created_at: "2026-07-23T11:42:30Z"
merged_at:
branch: "triage-pr-bugbot-summary-recognition"
pr:
commit:
author: "rob@acmeskunkworks.io"
co_authors: []
category: feature
breaking: false
issues: []
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Added

- **`triage-pr`:** the review-thread fetcher now recognises a review bot's
  **review-submission body** as a headline summary, not just issue-level comments.
  Cursor Bugbot posts its per-PR summary as a `COMMENTED` review body marked
  `<!-- BUGBOT_REVIEW -->` (its bug findings already arrive as actionable inline
  threads), so that summary previously never reached `aiSummaryComments` and Step 11
  could not consolidate it. A new `reviews` GraphQL query feeds review bodies through
  the same per-author selector, which keeps each bot's **latest marker-bearing**
  candidate (so a re-review's fresh summary supersedes an earlier one). Review bodies
  are considered after issue comments; a bot posting a marker on both surfaces is
  surfaced from its review body (equivalent content). Blank review bodies and Bugbot's
  free-tier "not enabled" upsell are excluded.
