---
description: Clean up merged Git branches and worktrees, then prune filesystem cruft — behind a single confirmation gate, with a --dry-run preview.
allowed-tools: Read, Bash(git:*), Bash(gh:*), Bash(node:*), mcp__linear-server__get_issue, mcp__linear-server__save_issue, mcp__linear-server__list_issue_statuses
---

Clean up the repository's merged branches and worktrees, then sweep filesystem
cruft (recursively-empty directories and orphaned `node_modules/`). This is the
standalone entry point for the [`cleanup-repo`
skill](../../skills/cleanup-repo/SKILL.md) — follow that skill's process
(read `config.json`, two-pass merge detection, single confirmation gate),
with the constraints below.

## Process

1. Read the skill's [`config.json`](../../skills/cleanup-repo/config.json) for
   `linearTeamName`, `issueKeys`, and `protectedBranches`.
2. Follow the skill's Steps 1–11: fetch and prune, identify merged worktrees and
   branches (git ancestry **plus** merged GitHub PRs for squash merges), run the
   read-only filesystem-hygiene detection
   (`node skills/cleanup-repo/scripts/filesystem-hygiene.mjs <repo-root> --json`),
   display everything to be deleted, gate on a single confirmation, then execute
   in order (worktrees → branches → filesystem `--apply`, which re-runs detection
   so parents emptied by removing worktrees are swept too).
3. Branches in `protectedBranches` are never touched; uncommitted worktrees are
   never force-removed automatically.
4. If the Linear MCP server is unavailable, skip the Linear status check and the
   optional `Done` writeback silently.

## Flags

- `--dry-run` — preview every deletion and change nothing; short-circuits before
  the confirmation gate.

## Notes

- Run the bundled script from the repo root:
  `node skills/cleanup-repo/scripts/filesystem-hygiene.mjs` (read-only without
  `--apply`).
- The optional `Done` writeback defaults to **no** — Linear's GitHub integration
  normally handles it on PR merge; this exists for the case where it didn't fire.

## Arguments

$ARGUMENTS
