---
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
   `reviewBots` and `maxCiRounds`.
2. Follow the skill's Steps 1–10: locate the PR and detect its phase, inspect and
   classify failing checks (in-scope vs base drift), fix in-scope failures one at
   a time **without weakening any gate**, re-watch CI (bounded by `maxCiRounds`),
   then — once the PR is ready — fetch unresolved review threads
   (`node skills/triage-pr/scripts/review-threads.mjs <pr> --bots "<reviewBots>"`),
   validate each finding before changing code, fix the valid ones, decline the
   invalid ones with technical reasoning, and loop until green.
3. **Never flip the PR from draft to ready** — that is the human's call and the
   gate that turns AI review on.

## Flags

- `--ci-only` — run Phase A and stop, even if the PR is ready.
- `--dry-run` — report failing checks and unresolved findings and propose fixes,
  but change nothing (no commits, pushes, or thread replies).

## Notes

- Run the bundled fetcher from the repo root:
  `node skills/triage-pr/scripts/review-threads.mjs`. The `--bots` value is
  `config.reviewBots` joined by commas.
- Only the configured `reviewBots` are actioned; human review comments are
  surfaced in the report but never auto-actioned.
- This command complements `/send-it` (which **opens** the draft PR).

## Arguments

$ARGUMENTS
