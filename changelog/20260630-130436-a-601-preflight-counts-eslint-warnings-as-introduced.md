---
title: preflight blocks only on introduced errors by default, with a blockOnWarnings opt-in
release_note: "preflight no longer counts introduced ESLint warning-severity findings as blocking violations by default. Off by default, only introduced errors (and linters that fail to run) gate the ship — matching pnpm lint / CI, which exit 0 on warnings; introduced warnings are still reported, as a non-blocking notice in the summary. A new blockOnWarnings option in preflight.config.json (default false) restores the old behaviour for repos that want warn-level findings the branch adds to gate as well. markdownlint and actionlint findings always block, since those tools exit non-zero on any finding — the warn/error split is ESLint-only."
version:
created_at: '2026-06-30T13:04:36Z'
merged_at:
branch: a-601-preflight-counts-eslint-warnings-as-introduced-violations
pr:
commit:
merge_strategy:
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - A-601
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Added

- **`blockOnWarnings` config option ([A-601](https://linear.app/acme-skunkworks/issue/A-601)).**
  A new `preflight.config.json` key (default `false`) controls whether introduced ESLint
  warning-severity findings gate the ship. Left off, preflight matches `pnpm lint` / CI
  semantics; set `true` to make warn-level findings the branch adds block as well.

## Changed

- **preflight blocks only on introduced _errors_ by default
  ([A-601](https://linear.app/acme-skunkworks/issue/A-601)).** Previously every introduced
  finding — warnings included — counted toward `introducedCount` and hard-blocked, so a file
  the branch newly brought into the lint surface could fail preflight on warn-level rules even
  though `pnpm lint` and CI stayed green (exit 0 on warnings). Violations now carry a
  `severity` (`error`/`warning`); the blocking set is errors-only unless `blockOnWarnings` is
  set, and introduced warnings surface as a non-blocking notice. The summary gains
  `introducedBlockingCount` / `introducedWarningCount` alongside the existing `introducedCount`.
  markdownlint/actionlint findings are tagged `error` and always block.

- The `preflight` bundle bumps to `0.2.0`.
