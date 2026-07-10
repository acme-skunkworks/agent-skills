---
title: Adopt changelog-core and in-repo post-merge enrich
release_note: Post-merge changelog finalise now runs in-repo via reusable-changelog-enrich and @acme-skunkworks/changelog-core instead of the orchestrator's inline Finalise step.
created_at: '2026-07-10T14:13:13Z'
branch: a-797-phase-3-roll-out-in-repo-enricher-to-agent-skills-npm
category: chore
breaking: false
issues:
  - A-797
---

## Changed

Migrate `agent-skills` onto the in-repo post-merge enricher (Phase 3 · A-797),
following the eslint-config canary:

- Add `@acme-skunkworks/changelog-core` and point CI `validate:changelog` /
  completeness at it.
- Fold `reusable-changelog-enrich.yml` (`mode: finalise`, pinned at A-821 SHA)
  into `pkg-release.yml` with `secrets: inherit` for road-runner-bot write-back.
- Keep `skills/changelog/scripts/*` as the published skill source — CI no longer
  shells out to them for validate/completeness.
