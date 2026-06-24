---
description: Bundle uncommitted work, run the lint preflight, write a dated changelog entry, set a Conventional Commits PR title, push the branch, open or update a PR, and move linked Linear issues to In Review.
allowed-tools: Write, Read, Edit, Glob, Grep, Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(node:*), mcp__linear-server__get_issue, mcp__linear-server__save_issue, mcp__linear-server__list_issue_statuses
---

The all-in-one ship finisher for this repo. This is the entry point for the
[`send-it` skill](../../skills/send-it/SKILL.md) — follow that skill end to end.

It bundles uncommitted work into atomic commits, runs the change-gated lint
[`preflight`](../../skills/preflight/SKILL.md), authors or updates the dated
`changelog/<ts>-<slug>.md` entry (via the
[`changelog`](../../skills/changelog/SKILL.md) skill), composes a **Conventional
Commits PR title** (the squash subject release-please reads to decide the version
bump), pushes the branch, opens or updates a PR against `main`, and transitions
linked Linear issues to **In Review** (via the
[`linear-sync`](../../skills/linear-sync/SKILL.md) skill).

## Process

Follow the `send-it` skill's steps. It reads
[`skills/send-it/config.json`](../../skills/send-it/config.json) for the
shippability decision — for this repo, `shippablePaths: ["skills/"]` and
`shippableManifestKeys: ["name", "version", "files", "publishConfig"]`, base branch
`main`. The team name / issue keys for the Linear and changelog steps come from the
respective sibling skills' `config.json` files.

Repo specifics that fall out of the skill's config here:

- **Shippable** = any change under `skills/`, or a `package.json` change to `name` /
  `version` / `files` / `publishConfig` → a release-triggering `feat`/`fix`/`feat!`
  title. Everything else (docs, `.github/`, `infrastructure/`, `.claude/`,
  `architecture/`, the dated `changelog/` itself, release-please config, a lone
  lockfile bump) is non-shippable → a non-release type (`docs:`/`chore:`/`ci:`/…).
- A skill's own `package.json` / `SKILL.md` `metadata.version` bump lives under
  `skills/`, so it **is** shippable when the skill content changes alongside it.
- The single published package is the root `@acme-skunkworks/agent-skills`; the PR
  title always describes it (published surface `files: ["skills/"]`, ADR-0002).

This command intentionally does NOT run typecheck, tests, or format checks — CI
handles those. The only gate it runs is the change-gated `preflight` lint.

## Flags

- `--dry-run` — preview the changelog entry, branch, and conventional PR title; make
  no commits, no push, no `gh` calls. Exit 0.
- `--branch=<name>` — override the auto-derived branch name when on `main` with
  uncommitted changes.
- `--issue=<ID>` — prefix the auto-derived slug with a Linear issue ID (e.g.
  `--issue=ASW-7` → `asw-7-<slug>`, lower-cased). Ignored if `--branch` is given.
- `--ready` — open the PR ready-for-review instead of draft (default is draft).
- `--merge-when-ready` — after create/update, enable `gh pr merge --auto --squash`.
- `--worktree=<branch-or-path>` — `cd` into a worktree before running. Resolved via
  `git worktree list --porcelain`; errors if it matches no worktree.

## Arguments

$ARGUMENTS
