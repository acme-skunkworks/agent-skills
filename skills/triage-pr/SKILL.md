---
name: triage-pr
description: >-
  Drive a pull request from draft with failing CI to merge-ready. While the PR
  is a draft, inspect and fix in-scope CI failures (lint, changeset status,
  manifest-lint, build, tests) using the gh CLI and GitHub Actions logs — never
  weakening CI config to greenwash. After the PR is marked ready-for-review,
  fetch the unresolved AI review threads (Claude Code Review, Bugbot), validate
  each finding against the codebase before changing anything, fix the valid
  ones, decline the invalid ones with technical reasoning, then re-watch CI
  until green. Use when asked to triage a PR, fix failing CI or red checks on a
  PR, address or respond to PR review comments, action Bugbot or Claude review
  feedback, get a PR green, or take a draft PR to merge-ready. Handles
  base-branch drift and in-scope merge conflicts; escalates ambiguous ones.
license: MIT
compatibility: >-
  Requires the `gh` CLI (authenticated — `gh auth status` must pass) and `git`.
  The bundled review-thread fetcher needs Node.js >=22 (ES modules).
  Designed for repositories whose AI review runs only on
  ready-for-review PRs (draft-gated), so Phase A and Phase B do not overlap.
metadata:
  version: 0.1.0
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(gh:*), Bash(git:*), Bash(node:*), Bash(pnpm:*), Bash(npx:*)
---

# triage-pr

Take a pull request from **draft + failing CI** to **merge-ready**, in two
phases, choosing the phase from the PR's draft state:

- **Phase A — while the PR is a draft:** inspect failing checks, pull GitHub
  Actions logs, and fix failures **in PR scope only**. Loop until CI is green or
  report blockers.
- **Phase B — after the PR is ready-for-review:** AI review is gated on
  `draft == false`, so once a human flips the PR, reviewers (Claude Code Review,
  Bugbot) post feedback. Fetch the **unresolved** findings, validate each
  against the codebase before changing anything, fix the valid ones, decline the
  invalid ones with technical reasoning, then loop back through Phase A.

This skill complements `/send-it` (which **opens** the draft PR). It **never
flips the PR from draft to ready** — that is the human's call (and the gate that
turns AI review on). See [`references/review-discipline.md`](references/review-discipline.md)
for the full review-reception and verification rules folded into Phase B.

## Configuration

Two knobs live in [`config.json`](config.json) beside this file. Read it at the
start of a run and use its values throughout. Edit your copied `config.json` to
match the consuming repo's review bots.

| Key | Meaning | Default |
| --- | --- | --- |
| `reviewBots` | GitHub login names whose comments and threads are treated as first-class AI review feedback. Matched against `author.login`; the `[bot]` suffix is normalised, so `claude` and `claude[bot]` both match (the GraphQL API returns the bare form). Edit to match your install — review-bot logins vary per repo. | `["claude", "cursor", "coderabbitai", "github-actions"]` |
| `maxCiRounds` | Maximum Phase-A re-watch iterations before stopping and reporting blockers. Bounds the fix-and-watch loop so it can't spin forever. | `5` |

Only the configured `reviewBots` are actioned in Phase B. Human review comments
are surfaced in the final report but never auto-actioned, replied to, or
resolved — leave those for the human.

## Usage modes

**Auto** — detect the current branch's PR and its phase, then run:

```bash
triage-pr
```

**Explicit PR** — operate on a specific PR by number or URL:

```bash
triage-pr 123
```

**CI only** — run Phase A and stop, even if the PR is ready:

```bash
triage-pr --ci-only
```

**Dry run** — report failing checks and unresolved findings and propose fixes,
but change nothing (no commits, no pushes, no thread replies):

```bash
triage-pr --dry-run
```

## Process

### Step 1 — Locate the PR and detect the phase

```bash
gh pr view <pr> --json number,isDraft,state,headRefName,baseRefName,mergeable,mergeStateStatus,statusCheckRollup
```

- Resolve the PR from the argument, or from the current branch when none is
  given. If `gh pr view` finds no PR, stop and tell the user to open one with
  `/send-it` first.
- `isDraft == true` → **Phase A only**. When CI is green, report and stop (do not
  attempt Phase B; AI review has not run yet, and this skill never flips the PR
  to ready).
- `isDraft == false` → **Phase A** (confirm/clear CI), then **Phase B**.
- Record `baseRefName` for the drift checks and `mergeStateStatus` for conflict
  detection.

### Step 2 — Phase A: inspect failing checks

```bash
gh pr checks <pr>
```

For each failed Actions check, resolve its run ID from the check's `detailsUrl`
(in `statusCheckRollup`) and read the failing step's logs:

```bash
gh run view <run-id> --log-failed
```

Capture the **actual failing command and error lines**, not just the check name.
You are diagnosing a root cause, not pattern-matching a label.

### Step 3 — Phase A: classify each failure (in-scope vs upstream)

```bash
git fetch origin <base>
git diff --name-only origin/<base>...HEAD   # files this PR actually touches
```

- **In-scope** — the failure names files in this PR's diff, or is a lint / test /
  build failure reproducible on the branch head. Fix it (Step 4).
- **Upstream / base drift** — the job also fails on `origin/<base>` independent of
  this diff, **or** `mergeStateStatus == BEHIND`, **or** the error names files the
  PR never touched. Remedy is to rebase/merge the base (Step 5), **not** to edit
  the failing code.
- A failure that can only be "fixed" by weakening a gate is never in-scope — see
  **Important rules**.

### Step 4 — Phase A: fix in-scope failures, one at a time

- Apply the smallest fix that addresses the **root cause** within the PR's scope.
- Re-run the **specific** failing command locally and read its exit code before
  claiming it fixed (e.g. `pnpm lint`, `pnpm changeset status`,
  `npx skills-ref validate ./skills/<name>`, the failing test). Evidence before
  claims — never assert a fix on "should" or "probably".
- Commit with a Conventional Commit subject, then push. One fix → one
  verification → next fix.

### Step 5 — Phase A: handle base-branch drift

Only when Step 3 classified the failure as upstream/behind:

```bash
git fetch origin <base>
git merge origin/<base>      # or rebase, per the repo's convention
```

- Clean merge → push and re-watch (Step 6).
- Conflict → go to **Merge conflicts** below.

### Step 6 — Phase A: re-watch CI until green or budget exhausted

```bash
gh pr checks <pr> --watch
```

- After each push, watch the rollup to completion. Still red → loop back to
  Step 2.
- **Bound the loop** by `maxCiRounds`. When exhausted, stop and report the
  remaining failures as blockers rather than looping forever.
- Green **and draft** → report green and **stop**.
- Green **and ready** → continue to Phase B.

### Step 7 — Phase B: fetch unresolved review feedback

Run the bundled fetcher. Its path is **relative to this skill's own directory**
(the one holding this `SKILL.md` and `config.json`) — resolve it from there, not
from the consuming repo's root, or the run fails with `ENOENT`. The `--bots`
value is `config.reviewBots` joined by commas:

```bash
node scripts/review-threads.mjs <pr> --bots "claude,cursor,coderabbitai,github-actions"
```

It prints minimal JSON with three groups:

- `unresolvedThreads` — inline review threads (`isResolved == false`) raised by a
  configured `reviewBot`, trimmed to `{threadId, path, line, isOutdated, author,
  comments}`. This is the actionable set.
- `humanThreads` — the same shape, for unresolved threads **not** raised by a
  review bot. Surface these in the report for the human; do not auto-action them.
- `aiSummaryComments` — the sticky issue-level summary the review action posts via
  `track_progress` / `use_sticky_comment`. Surface it **separately**: it is an
  issue comment, **not** a review thread, so it has no `isResolved` and never
  appears in `unresolvedThreads`. Missing it would mean missing the headline
  review.

Resolved threads are filtered out so the context stays small. Empty
`unresolvedThreads` **and** no AI summary → report "no actionable AI review
feedback" and skip to Step 10.

### Step 8 — Phase B: validate each finding before touching code

Apply the six-step reception (full rules in
[`references/review-discipline.md`](references/review-discipline.md)):

1. **READ** the finding in full — body plus the cited file and line.
2. **UNDERSTAND** what it claims and why; restate it for yourself.
3. **VERIFY** it against the actual codebase. Open the cited lines and confirm
   the issue is real and not already handled. Never trust the bot's framing.
4. **EVALUATE** — is it correct, in-scope, and not a YAGNI or architecture
   violation?
5. **RESPOND** — for a decline, reply on the thread with concise **technical
   reasoning** and resolve it; for an accepted finding, note the planned fix. No
   sycophancy ("You're absolutely right!", "Great point!") — state facts.
6. **IMPLEMENT** accepted findings one at a time (Step 9).

Reply and resolve:

```bash
gh api graphql -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread { isResolved } } }' -f id='<threadId>'
```

### Step 9 — Phase B: apply accepted fixes, then re-run Phase A

- Implement each accepted finding on its own; after each, freshly run the proving
  command and read its output and exit code before claiming it works.
- Commit and push, then **return to Step 2** — a new push re-fires CI, and AI
  review re-fires too (the PR is ready), producing fresh threads and an updated
  sticky comment.
- Loop Phase B ↔ Phase A until CI is green **and** no unresolved AI threads
  remain (or every remaining one has been declined with reasoning and resolved).

### Step 10 — Report

Summarise:

- Checks fixed, each with the failing command it addressed.
- Findings accepted and fixed.
- Findings declined, each with the technical reasoning given.
- Base merges/rebases performed.
- Remaining blockers (if `maxCiRounds` was exhausted).
- Final CI state, with the proving command's output.
- Any **human** review comments, surfaced for the human to handle.
- A reminder that the PR's draft/ready state is unchanged — the human flips it.

## Merge conflicts

- Resolve **only** when the resolution is unambiguous and within the PR's scope
  (e.g. both sides touched disjoint hunks, or this branch's intent clearly
  supersedes).
- **Abort and ask the human** when intent is ambiguous: both sides changed the
  same logical thing, the conflict reaches files outside the PR's scope, or
  resolving needs a product decision. Run `git merge --abort` and report the
  conflicting files.
- Never resolve a conflict by deleting the other side's work just to make it
  compile.

## Important rules

- **Never greenwash.** Never edit `.github/workflows/*`, disable or loosen a lint
  rule, delete or skip a test, or relax a CI threshold to make a check pass. Fix
  the code, or report the failure as a blocker.
- **In-scope only.** Fix what this PR's diff is responsible for; don't fix
  unrelated repo problems.
- **Validate before implementing.** Never apply a review suggestion without first
  verifying it against the codebase.
- **AI bots only.** Action only the configured `reviewBots`; surface human
  comments but leave them for the human.
- **No sycophancy.** Decline with technical reasoning, not flattery.
- **Evidence before claims.** Never say CI is green or a fix works without freshly
  running the proving command and reading its exit code.
- **Never flip draft → ready.** This skill only reads the draft state to choose a
  phase; promoting the PR is the human's call.
- **Bounded loops.** Stop after `maxCiRounds` and escalate.

## Error handling

- `gh auth status` fails → stop and tell the user to run `gh auth login`.
- No PR for the branch → stop with "open one with `/send-it` first".
- `gh run view --log-failed` unavailable (logs expired or run purged) → report
  the failing check by name without guessing its cause; do not fabricate a fix.
- The review-thread fetcher exits non-zero (rate limit, permissions, GraphQL
  error) → report it and fall back to `gh pr view <pr> --json reviews,comments`.
  Never treat "couldn't fetch" as "no findings".
- A finding cites a file or line that no longer exists (outdated thread) → note it
  as outdated and resolve it without a code change.
- `resolveReviewThread` fails on permissions → fall back to a plain reply with the
  reasoning rather than aborting.

## Arguments

$ARGUMENTS
