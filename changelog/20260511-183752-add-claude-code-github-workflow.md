---
title: "Add the Claude Code GitHub Actions integration"
release_note: "Adds the @claude-mention responder and automatic PR Code Review workflows."
version: "0.0.1"
created_at: "2026-05-11T18:37:52Z"
merged_at: "2026-05-11T18:48:18Z"
branch: "add-claude-github-actions-1778524660925"
pr: 2
commit: "32b43fe"
merge_strategy: merge
author: "hello@robeasthope.com"
co_authors: []
category: chore
breaking: false
issues: []
stats:
  files_changed: 2
  loc_added: 93
  loc_removed: 0
  commits: 3
---

## Added

- `.github/workflows/claude.yml` — the `@claude`-mention responder (`anthropics/claude-code-action@v1`).
- `.github/workflows/claude-code-review.yml` — automatic Code Review on PR open/sync, with Octavo-parity refinements: `cancel-in-progress` concurrency, a draft-skip gate, a sticky review comment, `track_progress`, an `allowed_bots` entry, and a `claude_args` allowed-tools whitelist.

This is the change recorded under `0.0.1` in the root `CHANGELOG.md` (commit `cc91127`); its changeset rode in on PR #1's branch because PR #2 predated the Changesets infrastructure.
