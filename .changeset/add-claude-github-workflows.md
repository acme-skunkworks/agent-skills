---
---

chore(ci): add Claude Code GitHub Actions — `@claude`-mention responder (`.github/workflows/claude.yml`) and automatic Code Review on PR open/sync (`.github/workflows/claude-code-review.yml`). Refinements layered on top of the install-github-app baseline to match Octavo's setup: concurrency cancel-in-progress, draft-skip gate, sticky review comment, `track_progress`, full-URL `prompt` form, `allowed_bots`, `claude_args` allowed-tools whitelist, AJV pinning comment. Ships via PR #2; the changeset entry is recorded here because PR #2's branch predates the Changesets infrastructure.
