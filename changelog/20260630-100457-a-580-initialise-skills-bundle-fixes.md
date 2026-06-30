---
title: initialise-skills bundle fixes — slash-safe branch parsing, changelog-dir gating, and gitignore !-unignore
release_note: "Five fixes to the initialise-skills bundle. Branch-name parsing now strips only the ref namespace (refs/heads/ or refs/remotes/<remote>/), so a slash-named local branch like A-123/demo keeps its issue key instead of being mangled to demo. send-it.changelog is now inferred from a real changelog/ directory rather than from the changelog skill merely being vendored, so a repo that over-installed the skill but keeps no changelog of its own is no longer wrongly flipped true. The gitignore reconcile now treats an explicit !-unignore of .preflight-summary.json as already-handled, so it never appends a positive rule over a deliberate negation, and it gains a .gitignore-specific error message on write failure. Plus a docs reword in detectable-keys.md."
version:
created_at: '2026-06-30T10:04:57Z'
merged_at:
branch: a-580-initialise-skills-bundle-fixes
pr:
commit:
merge_strategy:
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - A-580
  - A-570
  - A-582
  - A-583
  - A-584
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Fixed

- **Branch-name parsing preserves embedded slashes
  ([A-580](https://linear.app/acme-skunkworks/issue/A-580)).** `listBranchNames` and
  `listBranchNamesByRecency` formatted refs with `%(refname:short)` and stripped the first
  path segment with `/^[^/]+\//`, which mangled a slash-named local branch — `A-123/demo`
  became `demo`, losing the issue key. They now format with `%(refname)` (full ref) and strip
  only the ref namespace (`refs/heads/` or `refs/remotes/<remote>/`), preserving the branch
  name so `detectIssueKeys()` still finds the key.

- **`send-it.changelog` is gated on a real `changelog/` directory, not skill presence
  ([A-570](https://linear.app/acme-skunkworks/issue/A-570)).** The detector flipped `changelog`
  to `true` whenever the companion `changelog` skill was vendored, so a repo that over-installed
  the skill but keeps no changelog of its own (e.g. release-orchestrator, which runs *other*
  repos' `changelog:finalise`) was wrongly set `true` and would try to author entries with
  nowhere to live. It now keys solely off a `changelog/` directory at the repo root.

- **The gitignore reconcile respects an explicit `!`-unignore
  ([A-582](https://linear.app/acme-skunkworks/issue/A-582)).** `hasEntry()` only matched the
  positive forms, so a deliberate `!.preflight-summary.json` was treated as absent and a
  positive ignore rule was appended over it — under last-match-wins, silently re-ignoring a file
  the consumer chose to track. The negation forms now count as already-handled.

- **The gitignore reconcile gains skill-local error handling
  ([A-583](https://linear.app/acme-skunkworks/issue/A-583)).** A write failure now emits a
  `.gitignore`-specific message before `exit(2)`, mirroring the per-skill config write handler,
  rather than relying on the generic top-level catch.

## Changed

- **Docs ([A-584](https://linear.app/acme-skunkworks/issue/A-584)).** `detectable-keys.md`
  rewords the awkward "`issueKeys` order is not drift" heading to "order does not count as drift",
  and updates the `changelog` detection row to match the dir-only rule above.

- The `initialise-skills` bundle bumps to `0.6.1`. The merged consumer copies pick the fixes up
  on their next shared-skills re-sync (byte-identical vendored source).
