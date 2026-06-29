---
title: Harden the shared skills ahead of the estate rollout
release_note: send-it gains an optional changelog knob that turns its changelog step off entirely for repos with no changelog flow (decoupled from the shippability gate), cleanup-repo's merge-detection trunk is now configurable via a mainBranch key instead of a hard-coded origin/main, and initialise-skills auto-populates both — setting send-it's changelog flag to false when a repo has neither a changelog skill nor a changelog/ directory, and mirroring the base branch into cleanup-repo's mainBranch. The changelog skill also notes that agent-authored prose follows the host repo's language convention.
created_at: '2026-06-26T18:33:51Z'
merged_at:
branch: harden-shared-skills-sk448
pr:
commit:
merge_strategy:
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues: []
affected_packages:
  - changelog
  - cleanup-repo
  - infrastructure
  - initialise-skills
  - send-it
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits: 7
---

## Added

- **`changelog` knob for `send-it`** (`config.json` / `config.example.json`, default
  `true`). When `false`, `send-it` skips changelog authoring and the
  `docs(changelog)` commit entirely — regardless of shippability — for repos with no
  `changelog/` directory and no `changelog` skill installed. The shippability
  decision continues to drive the PR title independently. This is the first-class
  way to run `send-it` in a no-release-flow repo, replacing the fragile workaround of
  forcing `shippablePaths` never to match.
- **`mainBranch` knob for `cleanup-repo`** (`config.json` / `config.example.json`,
  default `main`). Both merge-detection passes now diff against `origin/<mainBranch>`
  so `master` / `develop` / `canary` repos detect merged branches correctly, rather
  than assuming `origin/main`.
- **Auto-population of both keys in `initialise-skills`.** A new `changelog` detector
  resolves to `false` only when a repo has neither the `changelog` skill installed
  nor a `changelog/` directory; a new `mainBranch` detector mirrors the detected base
  branch. Both are covered by unit tests and recorded in the detectable-keys
  reference table.

## Changed

- **Prose follows the host repo's language convention.** `send-it` and `changelog`
  now note that agent-authored prose (PR title, PR body, commit messages, changelog
  entry) follows the consuming repo's documented language — British English across
  this estate — applying to prose only, never identifiers or upstream API names.
