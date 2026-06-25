---
name: linear-sync
description: >-
  Transition the Linear issues linked to the current branch through their
  workflow states (In Progress / In Review / Done) — resolve live state IDs by
  team name, extract issue IDs from the branch, and apply the transition
  idempotently. Use when starting work on an issue, when a PR opens or updates,
  during branch cleanup, or whenever a branch's Linear issues need their state
  synced. Resolves state IDs by team name (not key — keys go stale on rename),
  reads the team name and issue-ID prefixes from config.json, and skips any issue
  already at or past the target state.
license: MIT
compatibility: >-
  Requires the Linear MCP server (the `mcp__linear-server__*` tools). The branch
  read needs the `git` CLI. If the Linear MCP server is unavailable the skill
  cannot run — it has no non-MCP fallback.
metadata:
  version: 0.1.3
allowed-tools: Read, Bash(git:*), mcp__linear-server__get_issue, mcp__linear-server__save_issue, mcp__linear-server__list_issue_statuses
---

# linear-sync

Move the Linear issues linked to the current branch through their workflow
states. This skill is the single source of truth for **how** issues are
transitioned: resolving the live state IDs, extracting issue IDs from a branch
name, and the per-state transition rules. Callers decide **when** and **whether**
to fire it; the mechanics live here once so the rules don't drift across the
ship flow, branch cleanup, and the start-of-work transition.

## Configuration

Two knobs live in [`config.json`](config.json) beside this file. Read it at the
start of a run and use its values throughout. Edit your copied `config.json` to
match the consuming repo:

| Key | Meaning | Default |
| --- | --- | --- |
| `linearTeamName` | Linear team **name** used to resolve the live state IDs. Use the name, not the key — the key is renamed over time but the name is stable. | `"ACME Skunkworks"` |
| `issueKeys` | Team-key prefixes that may appear in branch names. The issue-ID regex is built from these. Keep legacy keys so old branches still match. | `["ASW", "AKW", "SKW"]` |

A neutral [`config.example.json`](config.example.json) ships alongside it as a
template — copy it over `config.json` and fill in your values, or edit
`config.json` directly.

## Resolving state IDs (do this once per run)

Call `mcp__linear-server__list_issue_statuses` with `team: <linearTeamName>`
**once** to resolve the live state IDs for the target state(s).

**Pass the team _name_, not the key.** Linear state IDs are per-team, and a
workspace's team can be renamed over its lifetime (e.g. CAT → WTF → AKW → ASW),
so a hardcoded key goes stale. The team _name_ (`linearTeamName`) does not move.
This is the canonical gotcha for adopters — resolve by name, every run.

## Extracting issue IDs from the branch

Build the issue-ID regex by joining `issueKeys` with `|`:
`\b((?:ASW|AKW|SKW)-\d+)\b` for the defaults above. Match it against the
**upper-cased** branch name — branches like `asw-7-as-acquired` carry the key in
lower case, and a flow such as `--issue=ASW-7` produces upper-case branch names
like `ASW-7-as-acquired`. Keeping the legacy keys means leftover branches from
before a team-key rename are still recognised. Deduplicate the matches. Bogus or
malformed IDs simply error on lookup and are skipped with a warning — no separate
validation pass.

When a caller already has an `issues` list to hand (e.g. a changelog step emits
one), use that instead of re-extracting.

## Transition rules

For each issue ID, call `mcp__linear-server__get_issue` to read its current
state, then apply the rule for the target transition. All transitions are
**idempotent** — an issue already at or past the target state is skipped
silently.

| Target          | Apply when current state is …                           | Skip when current state is …                                | Fired by                     |
| --------------- | ------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------- |
| **In Progress** | `Triage`, `Backlog`, `Todo`                             | `In Progress`, `In Review`, `Done`, `Canceled`, `Duplicate` | Starting work on an issue    |
| **In Review**   | `Triage`, `Backlog`, `Todo`, `In Progress`              | `In Review`, `Done`, `Canceled`, `Duplicate`                | PR open/update (a ship flow) |
| **Done**        | `Triage`, `Backlog`, `Todo`, `In Progress`, `In Review` | `Done`, `Canceled`, `Duplicate`                             | Branch cleanup               |

Apply a transition by calling `mcp__linear-server__save_issue` with
`state: "<target>"` (or the resolved state ID).

> `Canceled` is the Linear API's own US spelling — keep it as-is when referenced
> in code or config.

## Caller responsibilities (when / whether to fire)

The skill owns the mechanics; each caller owns the policy:

- **Start of work** — transition to `In Progress` when work begins on an issue
  (unless already In Progress or further along). Run automatically; no prompt.
- **Ship flow** (PR open/update) — transition linked issues to `In Review`
  automatically after the PR is created or updated. No prompt.
- **Branch cleanup** — transition orphaned issues to `Done` only **after explicit
  confirmation, default no**. Linear's GitHub integration normally handles the
  `Done` transition on PR merge, so this prompt exists only for the rare case
  where the integration didn't fire (e.g. the issue ID was added after merge).

## Standalone vs inside a caller

- **Standalone** — resolve the target state, extract the branch's issue IDs,
  apply the transition, and report which issues moved and which were skipped. The
  default target is **In Progress** (the start-of-work transition that has no
  other home).
- **Inside a caller** — the caller supplies the target (and often the `issues`
  list) and decides whether to prompt; the mechanics above are unchanged.

## Implementation

No supporting scripts — the skill drives the Linear MCP tools directly
(`list_issue_statuses`, `get_issue`, `save_issue`). The only repo-specific inputs
are the team name and the issue-ID prefixes, both read from `config.json`.
