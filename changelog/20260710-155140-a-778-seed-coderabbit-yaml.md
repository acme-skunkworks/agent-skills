---
title: Seed estate .coderabbit.yaml
release_note: agent-skills now carries the estate `.coderabbit.yaml` as a repo-owned copy (A-778).
created_at: '2026-07-10T15:51:40Z'
branch: a-778-remove-the-coderabbityaml-fan-out-from-fanout-configyml
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - A-778
---

## Added

- Repo-root `.coderabbit.yaml` seeded from the estate reference profile
  ([A-778](https://linear.app/acme-skunkworks/issue/A-778)). The file is
  repo-owned — the orchestrator no longer fans it out.
