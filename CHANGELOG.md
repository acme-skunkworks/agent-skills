# @acme-skunkworks/agent-skills

## 1.0.0

### Major Changes

- Promote `@acme-skunkworks/agent-skills` to its first public release (`1.0.0`). This flips the package from `private: true` (publishing dormant) to a published npm package, taking the parking brake off the release pipeline built and exercised across ASW-318, ASW-345, and ASW-346. The skill bundles under `skills/` are now installable from the public registry via `npx skills add`. The catalogue is still maturing — `1.0.0` marks the package going public, not feature-completeness.

### Minor Changes

- a0263ac: Add the `cleanup-repo` skill: removes merged Git worktrees and branches (two-pass detection covering both git-merged and squash-merged PRs), guards worktrees with uncommitted changes, and optionally writes linked Linear issues back to `Done`. Adds a new filesystem-hygiene pass that prunes recursively-empty directories (leaving `.gitkeep` / `.gitignore` placeholders alone and never touching `.git/`) and orphaned `node_modules/`. The Linear team name, issue-key allowlist, and protected-branches list are configurable via `config.json`.

## 0.0.2

### Patch Changes

- d2354bd: Document the repo's British English writing-style rule in `CLAUDE.md` so Claude consistently uses British spelling and grammar in prose (comments, docs, commit messages, PR bodies). Identifiers, dependency names, and third-party API surfaces are explicitly out of scope.

## 0.0.1

### Patch Changes

- cc91127: Add Claude Code GitHub Actions — `@claude`-mention responder (`.github/workflows/claude.yml`) and automatic Code Review on PR open/sync (`.github/workflows/claude-code-review.yml`). Refinements layered on top of the install-github-app baseline to match Octavo's setup: concurrency `cancel-in-progress`, draft-skip gate, sticky review comment, `track_progress`, full-URL `prompt` form, `allowed_bots`, `claude_args` allowed-tools whitelist, AJV pinning comment. Shipped via PR #2 ahead of this bootstrap PR; the changeset entry was recorded here because PR #2's branch predated the Changesets infrastructure.
