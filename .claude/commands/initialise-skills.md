---
title: initialise-skills
description: Scan the host repo and reconcile every installed skill's config.json with detected facts — base branch, package roots, changelog dir, Linear issue keys, review bots — plus the Linear team name / workspace slug. Dry-run first, idempotent, never clobbers deliberate edits.
allowed-tools: Read, Bash(node:*), Bash(git:*), mcp__linear-server__list_teams, mcp__linear-server__get_team
---

Populate and keep accurate this repo's per-skill `config.json` files. This is the
standalone entry point for the [`initialise-skills`
skill](../../skills/initialise-skills/SKILL.md) — follow that skill end to end
(dry run → fetch Linear facts → confirm → write → confirm idempotency).

## Process

Follow the skill's steps. In this repo the sibling bundles live under `skills/`,
so the script auto-detects them when run from the repo root:

1. Dry run: `node skills/initialise-skills/scripts/initialise.mjs --dry-run --json`
   and parse the report (`skills[]`, `driftKeys`, `manualKeys`, `totals`).
2. For each `needs-manual-input` Linear key, fetch the team name / workspace slug
   via the Linear MCP (`mcp__linear-server__list_teams`), else ask. This repo's
   values are team **Rheged Studio**, workspace slug **rheged-studio**.
3. Present the diff and gate on confirmation. For each `drift` key, ask whether to
   accept the detected value (per-key opt-in) and collect an `acceptDrift` map.
4. Write, piping `{ facts, acceptDrift }` as stdin JSON to
   `node skills/initialise-skills/scripts/initialise.mjs --write --json`.
5. Re-run the dry run to confirm every key is now `unchanged` (idempotent).

## Notes

- `preflight` is skipped by design — it self-detects base branch + workspaces and
  reads an optional root-level `preflight.config.json`, not an in-bundle config.
- Never writes without confirmation; never clobbers a deliberate edit (drift is
  kept unless you opt in); preserves each file's key order and formatting.
- If the Linear MCP server is unavailable, skip the team/slug fetch and flag those
  keys for manual input — everything else is still detected.

## Arguments

$ARGUMENTS
