---
title: Fleet runbook config-reset step and recency-based issue-key detection
release_note: "initialise-skills now detects the current Linear issue key from the most recently committed branch (git for-each-ref --sort=-committerdate) instead of unioning every historical prefix, and accepts single-letter keys (e.g. A) — so a repo whose team was renamed (…→ASW→SK→A) reconciles to the live key rather than stale ones. The fleet-deployment runbook gains the missing step to reset each config.json from its config.example.json before reconciling (so consumers stop inheriting agent-skills' own config), and documents facts.issueKeys as the canonical override for a renamed team."
created_at: '2026-06-27T21:35:27Z'
merged_at:
branch: a-554-fleet-reset-issuekeys-detection
pr:
commit:
merge_strategy:
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - A-554
  - A-556
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Fixed

- **`initialise-skills` issue-key detection prefers the current key, not the historical
  union ([A-556](https://linear.app/acme-skunkworks/issue/A-556)).** Detection now reads
  the leading `<KEY>-<num>` prefix from the **most recently committed** branch
  (`git for-each-ref --sort=-committerdate`) rather than unioning every prefix across all
  branches, and **accepts single-letter keys** (the previous 2+-letter rule silently
  dropped a one-letter team key like `A`; `v1-release`-style branches stay excluded
  because the digit follows the letter with no `-`). A repo whose Linear team was renamed
  (…→ASW→SK→`A`) now reconciles to `["A"]` instead of the stale `["ASW","SK"]`. New
  `listBranchNamesByRecency` / `currentIssueKeys` helpers carry the logic; `facts.issueKeys`
  still overrides when the heuristic is wrong. Bundled as `initialise-skills@0.4.3`.

## Changed

- **Fleet runbook: reset `config.json` from the example before reconciling
  ([A-554](https://linear.app/acme-skunkworks/issue/A-554)).** `skills add … --copy`
  vendors agent-skills' **own** `config.json`, which `initialise-skills` then treats as
  deliberate edits and won't overwrite — so a consumer silently inherits agent-skills'
  config. `docs/fleet-deployment.md` gains an explicit step (new Step 3) to overwrite each
  installed skill's `config.json` with its `config.example.json` (in every agent skills
  dir, skipping example-only skills like `preflight`) before the reconcile, plus a note
  that an upgrade must re-run the reset too, and documents `facts.issueKeys` as the
  canonical override for a renamed team. `references/detectable-keys.md` is updated to
  match the new detection behaviour.
