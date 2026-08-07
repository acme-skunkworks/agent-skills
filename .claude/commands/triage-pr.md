---
title: triage-pr
description: Drive a pull request from draft with failing CI to merge-ready — fix in-scope CI failures, then action unresolved AI review feedback.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(gh:*), Bash(git:*), Bash(node:*), Bash(pnpm:*), Bash(npx:*)
---

Take the current branch's pull request from **draft + failing CI** to
**merge-ready**. This is the standalone entry point for the [`triage-pr`
skill](../../skills/triage-pr/SKILL.md) — follow that skill's two-phase process
(Phase A fixes in-scope CI failures while the PR is a draft; Phase B actions
unresolved AI review threads once it is ready), with the constraints below.

## Process

1. Read the skill's [`config.json`](../../skills/triage-pr/config.json) for
   `reviewBots`, `maxCiRounds`, `replyOnAccept`, and `promoteOnGreen`.
2. Follow the skill's Steps 1–12: locate the PR and detect its phase, inspect and
   classify failing checks (in-scope vs base drift vs lint-surface **gated**), fix
   in-scope failures one at a time **without weakening any gate** — never editing lint
   config or adding an ignore directive on your own initiative; classify those as gated
   and report them for the developer's sign-off — re-watch CI (bounded by `maxCiRounds`),
   then — once the PR is ready — fetch review feedback
   (`node skills/triage-pr/scripts/review-threads.mjs <pr> --bots "<reviewBots>"`),
   validate each finding before changing code, fix the valid ones, decline the
   invalid ones with technical reasoning. After each push, **loop back to the CI
   phase** — a push re-fires both CI and AI review — until CI is green and no
   unresolved AI threads remain. **In Phase A**, every remaining red being a
   lint-surface **gated** item ends the phase immediately (CI stays red, so promotion
   is blocked); a gated discovery in **Phase B** goes to the Step 12 re-envelope and
   report instead. Do **not** claim the run is done while any
   required check is still non-terminal; alert the human only at a natural
   stopping point (Step 12, a documented Step 6 Phase-A early stop, or a hard
   blocker / budget exhaustion).
3. **The draft → ready flip is governed by `promoteOnGreen`** (read in step 1) — the
   single control for it. When `true` (the default), an enabled config _is_ the
   authorisation: once Phase A is proven-green (no unresolved human threads, no base
   drift), flip the PR to ready (the gate that turns AI review on) and continue into
   Phase B — don't stop to seek a separate human sign-off. When `false`, stop at green.
   An explicit user prompt, or `--promote` / `--no-promote`, overrides per run. Merge to
   `main` stays the human's call.

## Flags

- `--promote` / `--no-promote` — override the `promoteOnGreen` config for this run:
  force the draft→ready flip on a cleanly-green Phase A, or force stop-at-green.
- `--ci-only` — run Phase A and stop, even if the PR is ready.
- `--dry-run` — report failing checks and unresolved findings and propose fixes,
  but change nothing (no commits, pushes, or thread replies).

## Notes

- Run the bundled fetcher from the repo root:
  `node skills/triage-pr/scripts/review-threads.mjs`. The `--bots` value is
  `config.reviewBots` joined by commas.
- The fetcher returns **three** groups: `unresolvedThreads` (the actionable
  set), `humanThreads` (surface, never auto-action), and `aiSummaryComments` —
  the sticky issue-level review summary. The summary has no `isResolved` and
  never appears in `unresolvedThreads`, so surface it separately; don't skip it.
- Only the configured `reviewBots` are actioned; human review comments are
  surfaced in the report but never auto-actioned.
- This command complements `/send-it` (which **opens** the draft PR).

## Arguments

$ARGUMENTS
