---
title: triage-pr human envelope for Phase B AI dispositions
release_note: triage-pr now waits for AI reviewers after a green promote, verifies findings, and halts for one same-session human envelope before applying accepts, declines, or Linear follow-ups — with a slow-bot micro-gate and re-envelope on later review rounds.
created_at: '2026-08-03T17:42:58Z'
merged_at: ''
branch: a-1179-feattriage-pr-auto-phase-a-then-halt-for-a-human-envelope-on
pr: null
commit: ''
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - A-1179
stats:
  files_changed: 13
  loc_added: 365
  loc_removed: 321
  commits:
---

## Added

- **Human envelope (default on, [A-1179](https://linear.app/acme-skunkworks/issue/A-1179)).**
  After Phase A proves green and (optionally) promotes, Phase B hybrid-waits for
  configured review bots, verify-then-proposes dispositions, and halts for one
  batch `[y/N]` before accept / decline / Linear write (proposed-defer threads
  are marked `defer-pending` when the plan is presented so restarts do not
  re-emit them). `--auto-apply` /
  `humanEnvelope: false` restores legacy auto Phase B. Re-envelopes when new bot
  findings appear after apply.

- **Hybrid review settle + slow-bot micro-gate.** `reviewIdleMinutes` /
  `reviewWaitMaxMinutes` (defaults 5 / 20). Fetcher emits `botsReported` /
  `botsMissing` (sticky-marker headlines and/or unresolved/deferred threads —
  not bare first-candidate acks) so a timed-out wait can ask proceed / wait
  longer / abort before the envelope.

- **initialise-skills detectors** for `humanEnvelope`, `reviewIdleMinutes`, and
  `reviewWaitMaxMinutes` so consumer reconcile does not flag them
  needs-manual-input.

## Changed

- triage-pr bundle `0.8.3` → `0.9.1`; initialise-skills `0.10.8` → `0.10.9`.

## Fixed

- Auto-apply and envelope paths now document `defer-pending` marking before the
  Linear gate / while the human decides.
- Hybrid settle no longer treats early "reviewing now" acks as bot headlines;
  thread-only bots count as reported.
