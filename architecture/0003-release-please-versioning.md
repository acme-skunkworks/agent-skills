# ADR-0003: release-please replaces Changesets as the version engine

- **Status:** Accepted
- **Date:** 2026-06-23
- **Tracking:** [SK-380](https://linear.app/goose-and-hobbes/issue/SK-380)
- **Supersedes:** [ADR-0002](0002-repo-level-npm-versioning.md) *mechanism* only — Decision 4 (the Changesets package-name guard) in full, and the Changesets-engine framing in Decisions 1–2. ADR-0002's core decision (repo-level npm versioning; the root is the single published package; skills versioned out-of-band) **stands unchanged**.
- **Superseded by:** —

## Context

ADR-0002 settled *what* is versioned — the root `@acme-skunkworks/agent-skills` as a single repo-level package, with skills versioned out-of-band via `SKILL.md metadata.version`. It assumed **Changesets** as the engine that decides the bump: every PR wrote a root-named `.changeset/*.md`, a CI guard (`validate-changesets.ts`) rejected skill-named changesets, and the private `release-orchestrator` ran `changeset version` to cut the version PR.

The `@acme-skunkworks` estate is standardising on **release-please** (Conventional Commits) for cross-repo consistency — the estate-wide ADR 0002 lives in eslint-config, ported to the siblings as SK-371 (eslint-config), SK-379 (markdownlint-config), and **SK-380 (this repo)**. release-please infers the bump from the merged Conventional-Commit **PR title** instead of an explicit changeset file, so the repo squash-merges and the title *is* the release declaration. Keeping Changesets here while the rest of the estate flips would leave one repo with a divergent release flow and a second engine to maintain.

The change is **strand A only**: it swaps the engine that decides the bump. Everything else ADR-0002 fixed — repo-level single package, `files: ["skills/"]` as the published surface, no `pnpm-workspace.yaml`, skills versioned by hand — is untouched.

## Decision

**release-please (Conventional Commits) replaces Changesets as the version engine. The repo-level single-package model from ADR-0002 is unchanged.**

1. **The bump is decided by the merged PR title**, not a changeset file. `feat:` → minor, `fix:` → patch, `!`/`BREAKING CHANGE:` → major; `docs`/`chore`/`ci`/`refactor`/`perf`/`test`/`build`/`style`/`revert` cut no release. release-please reads it (the squash subject), bumps `package.json` + `.release-please-manifest.json`, and opens the `release-please--branches--main` release PR.
2. **`release-please-config.json` is a single-package config** (`packages: { ".": … }`, `release-type: node`, `include-v-in-tag: true`, `skip-changelog: true`). There is **no root `CHANGELOG.md`** — the dated `changelog/` entries are the only changelog, and `release.yml` sources GitHub-release notes from the entry stamped with the release version.
3. **Two CI guards replace the changeset guard.** A SHA-pinned conventional-PR-title lint (`amannn/action-semantic-pull-request`) checks the title format; a changelog-completeness gate (`check-changelog-completeness.ts`) requires a `feat`/`fix`/breaking title to carry a dated `changelog/*.md` entry — restoring the "no changeset → no release" coupling Changesets gave for free. ADR-0002's `validate-changesets.ts` guard and the `pkg` field in `derive-changeset.ts` are removed (there are no changeset files to validate).
4. **`/send-it` composes the PR title** from the branch's derived bump (shippable → `feat`/`fix`/breaking; non-shippable → a non-release type) and writes the dated `changelog/` entry for shippable changes. Shippability is keyed on `files: ["skills/"]`: a change is shippable iff it touches `skills/` or a publish-surface `package.json` key.
5. **The orchestrator runs release-please.** The private `release-orchestrator` swaps `changeset version` for `release-please release-pr` + `changelog:finalise`, then SHA-pinned squash-merges the release PR; the merge re-fires the publish-only `release.yml`, which publishes on a keyless **version-vs-tag** gate (publish iff `package.json`'s version has no matching `v<version>` tag). Landed together: this repo's config first, the orchestrator (release-orchestrator PR #11) immediately after.

## What this means in practice

- **Skills are still versioned out-of-band** (ADR-0002 Decision 3) — `metadata.version` + the private `package.json` version, bumped by hand, enforced by `pnpm validate:skills`. release-please never touches them.
- **One tag / GitHub release per root version**, as before (`v1.1.0`, now `v`-prefixed via `include-v-in-tag`).
- **Mis-typing the PR title is the new failure mode** Changesets used to absorb: a `feat:` on a docs PR cuts a needless minor; a `chore:` on a real fix ships nothing. The PR-title lint guards the format and the completeness gate guards the entry, but the human picking the type is the source of truth.

## Rejected alternatives

- **Keep Changesets here.** Rejected: it leaves this repo as the estate's lone divergent release flow, against the cross-repo-consistency driver of ADR 0002.
- **Adopt release-please's own changelog (`skip-changelog: false`).** Rejected: the dated `changelog/` system (ADR-0002 / ASW-345) is richer (per-change frontmatter, enrichment, Linear links) and is what `release.yml` and consumers already read. release-please runs with `skip-changelog: true` so the two don't collide.

## Consequences

- ADR-0002's Decision 4 is withdrawn and its Decision 1–2 wording ("Changesets-managed", `.changeset/config.json`) is superseded by the release-please equivalents above; **its core decision (repo-level single published package, skills out-of-band) is unchanged**.
- Adding or changing a skill is now: edit the bundle, hand-bump its `metadata.version` + `package.json` `version`, and let `/send-it` set a `feat`/`fix` PR title + write the dated `changelog/` entry (no changeset file).
- A future ADR may revisit per-skill npm publishing if the distribution model changes; this ADR would then be superseded in turn.
