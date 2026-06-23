---
title: "Add the linear-sync skill"
release_note: "Adds a linear-sync skill that transitions a branch's Linear issues through their workflow states."
version:
created_at: "2026-06-01T17:09:29Z"
merged_at:
branch: "asw-352-port-the-linear-sync-skill-into-the-shared-agent-skills-repo"
pr:
commit:
merge_strategy:
author: "rob@acmeskunkworks.io"
co_authors: []
category: feature
breaking: false
issues: ["ASW-352"]
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Added

- New `linear-sync` skill under `skills/linear-sync/`: transitions the Linear
  issues linked to the current branch through their workflow states (In Progress
  / In Review / Done), resolving live state IDs by team **name** (stable across
  team-key renames) and applying each transition idempotently. Pure Linear-MCP —
  no supporting scripts.
- The Linear team name and issue-ID prefixes are parameterised via `config.json`
  (with a neutral `config.example.json` template), mirroring the `cleanup-repo`
  bundle.
- A local `/linear-sync` command wrapper drives the standalone start-of-work
  transition (default target In Progress).
