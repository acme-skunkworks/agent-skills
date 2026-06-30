---
title: Cover tests/** in the ESLint lint surface so the consolidated skill tests are linted again
release_note: Restores ESLint coverage of the consolidated skill tests under tests/**, which silently dropped out of the lint surface when the suite was moved, and dissolves a preflight false-positive that blocked any branch touching a test file. Developer-tooling only — no consumer-facing change.
created_at: '2026-06-30T12:14:15Z'
merged_at:
branch: a-599-cover-tests-in-eslint-lint-surface
pr:
commit:
merge_strategy:
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - A-599
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Fixed

- **The consolidated skill tests under `tests/**` are linted again ([A-599](https://linear.app/acme-skunkworks/issue/A-599)).** When the skill
  test suite was consolidated into `tests/skills/**`, the `pnpm lint` glob and
  `tsconfig.eslint.json` were left pointing at the old `infrastructure/tests/**` location, so the
  moved tests fell out of the lint surface entirely — CI's `🔬 Build & Lint` stayed green whilst
  linting none of them, a silent regression of coverage those files previously had. Both the
  `lint`/`lint:fix` globs and the type-aware `tsconfig.eslint.json` `include` now span
  `tests/**/*.ts`.
- **`preflight` no longer false-blocks on a test-file change.** Because the moved tests were
  outside the ESLint typed project, any branch editing one tripped a `parserOptions.project`
  startup parse error, which preflight classified as a blocking "linter failed to run" even though
  `pnpm lint` (the CI command) exited 0. Bringing `tests/**` into the project resolves the parse
  error by construction, so preflight runs the files cleanly.

## Changed

- **Paid down the lint debt the broadened surface revealed.** The previously-unlinted test files
  had accumulated drift (import ordering, formatting, short identifiers, arrow-vs-declaration
  style, two redundant `\s*` quantifiers flagged for super-linear backtracking). These were
  brought into line with the shared config — mechanical, behaviour-preserving changes only, with
  no alteration to what any test asserts. One load-bearing frontmatter fixture whose key order is
  semantically significant was restored after an over-eager auto-sort.
