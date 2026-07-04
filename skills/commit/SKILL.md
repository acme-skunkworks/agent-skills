---
name: commit
description: >-
  Turn the working tree into logical, atomic Conventional Commits — classify
  uncommitted files as in-scope vs out-of-scope against the branch's merge base,
  show a staging plan, and create one commit per coherent unit (type + optional
  scope + British-English body; `!` / `BREAKING CHANGE:` for breaking changes).
  Never `git add -A`; files that look like they belong to another
  branch/worktree are never staged silently. Use when asked to commit
  uncommitted work, tidy WIP into atomic commits, or as the commit step inside a
  ship flow (e.g. `/send-it`). It commits only — no push, PR, changelog, or
  Linear writeback.
license: MIT
compatibility: >-
  Requires the `git` CLI for status/diff/merge-base analysis and to create the
  commits. Contract-only skill — there is no bundled script and no npm
  dependency; the grouping logic is model-driven and this prose is the source of
  truth.
metadata:
  version: 0.1.0
  author: Rob Easthope
allowed-tools: Read, Bash(git:*)
---

# commit

Turn whatever is uncommitted in the working tree into **logical, atomic
Conventional Commits** — but only the files that belong to *this* branch. The
non-obvious value is the **out-of-scope guard**: multi-worktree and multi-agent
setups can leave stray files in the working tree that belong to another branch,
and this skill never sweeps them into a commit.

This skill is the single source of truth for the commit-grouping contract. It is
invoked two ways:

- **Standalone** (`/commit`) — "commit my WIP nicely." It creates the commits on
  the current branch and stops. It never pushes, opens a PR, writes a changelog,
  or touches Linear.
- **Inside a ship flow** (e.g. `/send-it`) — the commit step that runs before the
  lint gate, so the branch is clean before the changelog/PR work begins. The ship
  flow owns everything after the commits (lint, changelog, push, PR, Linear);
  this skill owns only the staging decision and the commits.

## Configuration

One knob lives in [`config.json`](config.json) beside this skill (a neutral
[`config.example.json`](config.example.json) ships as a template):

| Key | Meaning | Default |
| --- | --- | --- |
| `baseBranch` | The trunk the branch diff is taken against (`origin/<baseBranch>`), used to compute the merge base for scope classification. | `"main"` |

Throughout this document `<base>` is the `baseBranch` value.

When a ship flow delegates to this skill (e.g. `/send-it`), it may direct the
classification against a **different** base for that run — for instance send-it's
`--base` for a stacked PR. Honour the base the caller resolves; fall back to
`config.json` `baseBranch` only for a standalone `/commit` run.

## Process

1. `git status --porcelain`. If clean, there is nothing to commit — say so and
   stop.
2. Inspect the uncommitted files: `git status --porcelain` for the list, `git
   diff` and `git diff --cached` for the hunks.
3. **Filter for branch relevance.** Decide which uncommitted files are in scope:
   - Compute the merge base: `git merge-base HEAD origin/<base>`.
   - Files the branch already touches: `git diff --name-only <merge-base>...HEAD`.
   - **In scope** by default: any uncommitted file already touched on the branch,
     or sitting in a directory the branch already touches, or any uncommitted file
     when the branch has no commits yet (first run on a fresh branch).
   - **Out of scope** (suspicious): uncommitted files in directories the branch
     hasn't touched, when the branch already has its own commits.
4. Show the user the staging plan: in-scope files grouped by proposed commit, plus
   an explicit list of **out-of-scope files** flagged as "uncertain — possibly from
   another branch/worktree." Ask: "Stage in-scope files and create the commits
   below? (yes / no / customise)". Out-of-scope files are never staged
   automatically.
5. Group in-scope files into **logical atomic commits**:
   - One commit per coherent unit (a feature, a bug fix, a refactor, a docs change,
     a tooling tweak). Don't bundle unrelated edits.
   - Use Conventional Commits subjects (`feat:`, `fix:`, `chore:`, `docs:`,
     `refactor:`, `perf:`, `test:`), with a scope when one is obvious
     (`feat(commit): …`).
   - For a **breaking change**, mark it honestly: a `!` after the type/scope
     (`feat(api)!: …`) and/or a `BREAKING CHANGE:` footer in the body. A ship flow
     reads the bump signal back out of these commit messages, so the markers must
     be accurate.
6. On confirmation, create the commits with `git add <specific files>` (**never**
   `git add -A`) and `git commit`. Stage only the files named in the plan;
   out-of-scope files stay in the working tree, untouched. Pass one `-m` per block
   to add a body or footer beyond the subject — `git commit -m "<subject>" -m
   "<body>"`, and for a breaking change `git commit -m "feat(api)!: <subject>" -m
   "BREAKING CHANGE: <what changed and the migration>"` (or `git commit -F
   <message-file>` for a longer body). A bare `git commit -m "<subject>"` is fine
   when no body is needed.

If a pre-commit hook reformats files, the commit still succeeds with the formatted
content.

## Commit-message prose

Author commit subjects and bodies in the consuming repo's documented prose
language. Across this estate that is **British English** (`colour`, `behaviour`,
`-ise`/`-yse`). This governs prose only — never identifiers, dependency names, or
upstream API field names.

## Grouping granularity — per-component splitting is parked

`/commit` groups by **intent** (one commit per coherent change), not by component
or package boundaries. Per-component atomic-commit splitting (attributing files to
a package and cutting a commit per package) stays **parked** (A-374) — no estate
repo does per-component path attribution today. Revisit only if a published
multi-package monorepo doing per-component versioning off squash enters the estate.

## Arguments

$ARGUMENTS
