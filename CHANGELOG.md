# @acme-skunkworks/agent-skills

## 0.0.2

### Patch Changes

- d2354bd: Document the repo's British English writing-style rule in `CLAUDE.md` so Claude consistently uses British spelling and grammar in prose (comments, docs, commit messages, PR bodies). Identifiers, dependency names, and third-party API surfaces are explicitly out of scope.

## 0.0.1

### Patch Changes

- cc91127: Add Claude Code GitHub Actions — `@claude`-mention responder (`.github/workflows/claude.yml`) and automatic Code Review on PR open/sync (`.github/workflows/claude-code-review.yml`). Refinements layered on top of the install-github-app baseline to match Octavo's setup: concurrency `cancel-in-progress`, draft-skip gate, sticky review comment, `track_progress`, full-URL `prompt` form, `allowed_bots`, `claude_args` allowed-tools whitelist, AJV pinning comment. Shipped via PR #2 ahead of this bootstrap PR; the changeset entry was recorded here because PR #2's branch predated the Changesets infrastructure.
