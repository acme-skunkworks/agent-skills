---
"@acme-skunkworks/agent-skills": minor
---

Add the `linear-sync` skill: transition the Linear issues linked to the current branch through their workflow states (In Progress / In Review / Done), resolving state IDs by team **name** (stable across team-key renames) and applying transitions idempotently. Pure Linear-MCP, no supporting scripts. The Linear team name and issue-ID prefixes are configurable via `config.json`, and a local `/linear-sync` command wrapper drives the standalone start-of-work transition.
