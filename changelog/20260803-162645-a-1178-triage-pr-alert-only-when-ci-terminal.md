---
title: "Only alert the human once triage-pr CI is terminal"
release_note: "triage-pr no longer claims a run is complete while required checks are still queued, pending, or in progress — the human is only alerted at the final report once every required check is terminal."
created_at: "2026-08-03T16:26:45Z"
merged_at:
branch: "a-1178-fixtriage-pr-only-alert-the-human-once-ci-has-fully"
pr:
commit:
author: "rob@acmeskunkworks.io"
co_authors: []
category: fix
breaking: false
issues: ["A-1178"]
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Fixed

- **Completion contract ([A-1178](https://linear.app/acme-skunkworks/issue/A-1178)).**
  Agents must not claim the triage run is complete, green, or ready for attention
  while any required check is still queued, pending, or in progress. Step 6 stays
  quiet during the watch; Step 12 is the only completion alert and must cite the
  proving command's fresh terminal states. Bundle bumped to `0.8.2`.
