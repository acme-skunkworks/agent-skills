---
title: "Correct release-status default and align changelog/release docs to changelog-core"
release_note: "release-status now defaults its required check to GO/NO GO, and the changelog/release docs describe the in-repo changelog-core enrichment model."
version:
created_at: "2026-07-13T18:13:33Z"
merged_at:
branch: "a-948-docs-update-changelogrelease-docs-skills-to-the-changelog"
pr:
commit:
author: "rob@acmeskunkworks.io"
co_authors: []
category: fix
breaking: false
issues: ["A-948"]
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Fixed

- **`release-status`:** the skill defaulted `requiredCheck` to the decommissioned
  `🔬 Build & Lint` check, so a repo relying on the default reported the required
  check as not-found. Default it to the `GO/NO GO` aggregator that replaced it
  ([A-437](https://linear.app/acme-skunkworks/issue/A-437) /
  [A-596](https://linear.app/acme-skunkworks/issue/A-596)) — updated in the
  `DEFAULTS` constant, `config.example.json`, and the docs.

## Changed

- Rewrote the changelog/release documentation across `CLAUDE.md`, the root
  `changelog/README.md`, and the `changelog` + `send-it` skill bundles to describe
  the current model: post-merge enrichment runs **in-repo** via the shared
  `reusable-changelog-enrich.yml` (`mode: enrich` / `mode: finalise`) powered by
  `@acme-skunkworks/changelog-core`, written back as `road-runner-bot[bot]`. The
  release-orchestrator's inline finalise step and the daily `enrich-changelogs.yml`
  cron are retired ([A-801](https://linear.app/acme-skunkworks/issue/A-801)).
- Dropped `merge_strategy` from the changelog contract, schema, and field lists
  ([A-802](https://linear.app/acme-skunkworks/issue/A-802)), and removed the now
  unused `changelog:finalise` / `changelog:enrich` npm aliases. The bundled
  finalise/enrich/completeness `.mjs` remain as published skill source.
