---
title: Strip erroneous skill-config gitignore rules in consumers
release_note: initialise-skills now removes inherited .claude/.agents skill config.json ignore rules so consumers can commit runnable config for CI and fresh clones (A-812).
created_at: '2026-07-10T17:25:52Z'
merged_at: '2026-07-10T17:42:09Z'
branch: a-812-harden-initialise-skills-strip-skill-config-ignore
pr: 127
commit: 33dcf48
merge_strategy:
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - A-812
stats:
  files_changed: 8
  loc_added: 427
  loc_removed: 31
---

## Fixed

- `initialise-skills` strips erroneous `.claude/skills/*/config.json` and
  `.agents/skills/*/config.json` ignore rules (and the accompanying comment
  block) from a consumer's root `.gitignore`
  ([A-812](https://linear.app/acme-skunkworks/issue/A-812)). Those patterns
  belong only in the agent-skills **source** repo (`skills/*/config.json`,
  A-615) and as a template-seed guard — in a consumer the resolved
  `config.json` must be committed.
- The source-repo `skills/*/config.json` gitignore is left untouched.

## Changed

- Documented the source vs consumer config contract in
  `skills/initialise-skills/SKILL.md` and `docs/fleet-deployment.md`.
- Bumped `initialise-skills` to `0.10.7`.
