---
description: Transition the Linear issue(s) linked to the current branch to a target workflow state (default In Progress).
allowed-tools: Read, Bash(git:*), mcp__linear-server__get_issue, mcp__linear-server__save_issue, mcp__linear-server__list_issue_statuses
---

Transition the Linear issue(s) linked to the current branch through their
workflow states. This is the standalone entry point for the [`linear-sync`
skill](../../skills/linear-sync/SKILL.md) — follow that skill's mechanics
(read `config.json`, resolve state IDs by team name, extract issue IDs from the
branch, apply idempotently).

Default target is **In Progress** — the start-of-work transition (per `CLAUDE.md`:
transition an issue to In Progress when you begin work on it). Pass a different
target with `--state=`.

## Process

1. Read the skill's [`config.json`](../../skills/linear-sync/config.json) for
   `linearTeamName` and `issueKeys`.
2. `git branch --show-current` to get the branch; extract issue IDs via the regex
   built from `issueKeys` (e.g. `\b((?:ASW|AKW|SKW)-\d+)\b`) against the
   **upper-cased** branch name.
3. If no Linear issue ID is found, report that and stop — nothing to sync.
4. Resolve the target state ID via `mcp__linear-server__list_issue_statuses` with
   `team: <linearTeamName>` (once).
5. For each issue, read its current state and apply the skill's transition rule
   for the target; skip silently if already at or past it.
6. Report which issues were transitioned and which were skipped.

## Flags

- `--state=<name>` — target state (`In Progress` default; also `In Review`,
  `Done`). For `Done`, confirm first (default no) — Linear's GitHub integration
  normally handles it on merge.

## Notes

- This command syncs Linear state only — no git, changelog, push, or PR actions.
- Inside a ship flow the `In Review` transition fires automatically on PR
  open/update; inside branch cleanup the `Done` transition is prompted. This
  standalone command is mainly for the start-of-work `In Progress` step that has
  no other home.
