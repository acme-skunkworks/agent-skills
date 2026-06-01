---
---

Tooling + docs: settle the versioning model (ADR-0002) — npm versioning stays at the repo level (the root `@acme-skunkworks/agent-skills` is the single Changesets-managed package), and skills carry their own non-npm version in `SKILL.md` `metadata.version`. Adds a `pnpm validate:changesets` CI guard that fails the build on any changeset naming a non-root package, a `pnpm validate:skills` CI guard that enforces each skill's `package.json` naming/`private`/version + `SKILL.md` `metadata.version` parity, centralises the root name in the `/send-it` derive script, and corrects the stale guidance in `CLAUDE.md` and `/send-it`. No consumer-facing or skill change — the published `skills/` tarball is unaffected, so no version bump.
