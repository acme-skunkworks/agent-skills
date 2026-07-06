---
title: "fleet-deployment runbook: restore config.json before reconciling on a re-vendor"
release_note: ""
created_at: "2026-07-06T14:31:01Z"
merged_at:
branch: "a-706-skills-add-copy-deletes-the-consumers-per-skill-configjson"
pr:
commit:
merge_strategy:
author: "hello@robeasthope.com"
co_authors: []
category: docs
breaking: false
issues: ["A-706"]
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Fixed

**`docs/fleet-deployment.md`:** corrected the re-vendor guidance, which told
operators the opposite of what happens. Because agent-skills gitignores its
per-skill `config.json` and ships only `config.example.json` ([A-615](https://linear.app/acme-skunkworks/issue/A-615)), the source
bundle carries no `config.json` — so a `npx skills add … --copy` re-vendor is a
clean bundle-directory replacement that **deletes** every existing `config.json` in
the consumer (both the `.claude/skills/` and `.agents/skills/` mirrors). The runbook
previously claimed an upgrade "never touches your own `config.json`" and that there
was "no config reset needed", so an operator following it literally lost every
operator-supplied, no-detector config value (`linearTeamName`,
`linearWorkspaceSlug`, `changelog.packageRoots`, `triage-pr.promoteOnGreen`, …) on
every upgrade — reconcile then silently recreated the configs from scratch ([A-706](https://linear.app/acme-skunkworks/issue/A-706)).

The "Re-install / upgrade behaviour" section now documents the deletion and a
restore-from-trunk step to run **before** reconciling:

```bash
git checkout origin/main -- $(git diff --name-only --diff-filter=D | grep 'config\.json$')
```

The caveat is threaded through the intro flow, Step 1's "Preserve" note, Step 3, and
the checklist. Docs-only — no skill bundle or code changed; the underlying
`skills add --copy` over-deletion (fix options 1–2 in the issue) is deferred.
