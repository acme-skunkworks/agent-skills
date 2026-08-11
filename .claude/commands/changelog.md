---
title: changelog
description: Author, refresh, or repair the changelog entry for the current branch and validate it — no commit, push, or PR.
allowed-tools: Write, Read, Edit, Glob, Grep, Bash(git:*), Bash(node:*), Bash(pnpm:*)
---

Author, refresh, or repair the changelog entry for the current branch, then
validate it. This is the standalone entry point for the [`changelog`
skill](../../skills/changelog/SKILL.md) — follow that skill's steps, with the
standalone constraints below.

Standalone means: **write/refresh and validate the entry, but do not commit, push,
or open a PR.** The entry is left **uncommitted** in the working tree for the user
to review and commit themselves.

## Process

Follow the `changelog` skill end to end (it reads `skills/changelog/config.json`
for `issueKeys`, `linearWorkspaceSlug`, and `baseBranch`):

1. `git fetch origin <base>` so the branch diff is accurate (`<base>` from
   `config.json` `baseBranch`; default `main`).
2. Detect an existing entry for this branch → update vs create mode.
3. Analyse the log + diff; derive metadata (issues, author, co-authors, category,
   breaking, release_note). Respect field ownership — `created_at` is sacred;
   `stats` and the post-merge fields stay blank (owned by the release step).
4. Generate the grouped, categorised body (`## Breaking` first when applicable).
5. Write or update `changelog/YYYYMMDD-HHMMSS-<slug>.md`, then run
   `node skills/changelog/scripts/set-affected-packages.mjs` and
   `node skills/changelog/scripts/add-links.mjs`.
6. Validate: `node skills/changelog/scripts/validate-changelog.mjs` (and, if the
   repo uses pnpm, `node skills/changelog/scripts/preflight-changelog-ci.mjs`
   first). If validation fails, fix the entry and retry — do not leave a malformed
   entry.

Report the entry path, whether it was created or updated, and the validation
result. Remind the user the entry is uncommitted.

## Notes

- This command covers the **changelog** entry only. The commit, push, PR creation,
  and any Linear writeback are part of a ship flow (e.g. `/send-it`), not this
  command.
- `pr:` is not back-filled here — there is no PR. A ship flow back-fills it once a
  PR exists.
- Re-running is idempotent: it updates the existing entry, preserving `created_at`
  and the filename.
