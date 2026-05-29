---
"@acme-skunkworks/skill-cleanup-repo": minor
---

Add the `cleanup-repo` skill: removes merged Git worktrees and branches (two-pass detection covering both git-merged and squash-merged PRs), guards worktrees with uncommitted changes, and optionally writes linked Linear issues back to `Done`. Adds a new filesystem-hygiene pass that prunes recursively-empty directories (leaving `.gitkeep` / `.gitignore` placeholders alone and never touching `.git/`) and orphaned `node_modules/`. The Linear team name, issue-key allowlist, and protected-branches list are configurable via `config.json`.
