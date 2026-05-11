# @acme-skunkworks/agent-skills

## 0.0.1

### Patch Changes

- cc91127: Add Claude Code GitHub Actions — `@claude`-mention responder (`.github/workflows/claude.yml`) and automatic Code Review on PR open/sync (`.github/workflows/claude-code-review.yml`). Refinements layered on top of the install-github-app baseline to match Octavo's setup: concurrency `cancel-in-progress`, draft-skip gate, sticky review comment, `track_progress`, full-URL `prompt` form, `allowed_bots`, `claude_args` allowed-tools whitelist, AJV pinning comment. Shipped via PR #2 ahead of this bootstrap PR; the changeset entry was recorded here because PR #2's branch predated the Changesets infrastructure.
