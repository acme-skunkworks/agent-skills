---
title: triage-pr inherit-then-fallback follow-up project routing
release_note: triage-pr follow-ups now inherit the PR's live Linear project when one exists, and otherwise land in the shared Follow-up issues catch-all under an on-demand per-repo milestone — the same fallback in every capturing repo, still fail-closed if that project is missing.
created_at: "2026-08-27T14:19:34Z"
branch: a-1541-audit-estate-triage-pr-configs-follow-ups-fail-closed
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-1541
---

## Changed

- **Inherit-then-fallback capture routing ([A-1541](https://linear.app/rheged-studio/issue/A-1541)).**
  Phase B no longer files every follow-up into a single per-repo
  `followUpProject`. It extracts the PR's Linear id (`issueKeys` /
  `linear-sync` regex), inherits that issue's project when the project is
  live (not completed or canceled), and `relatedTo` the parent (never a
  sub-issue). Otherwise it files under config `followUpProject` — now the
  **catch-all**, the same name in every capturing repo (`Follow-up issues`
  in the Rheged estate) — with an on-demand milestone named after the
  GitHub repo short name (`gh repo view --json name`). Still fail-closed
  if the catch-all is empty or unresolved. Envelope lines show the
  destination before mint. Destination is resolved in Step 9 (before the
  envelope), not only under Step 11. Issue-id extraction stops at the first
  source that matches: upper-cased branch first, else first PR-title match,
  else no parent id.

- **`triage-pr` `0.12.0` → `0.13.0`.** Allowed-tools gain `get_issue`,
  `list_milestones`, and `save_milestone`. Canonical and dogfood configs
  set `followUpProject: "Follow-up issues"`.

- **`initialise-skills` `0.11.1` → `0.11.2`.** `facts.followUpProject` is
  documented as the fallback catch-all, not a per-repo home project. Fleet
  install-profile examples and detector/fleet-update fixtures follow.
