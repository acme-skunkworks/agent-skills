# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo

Container for shared agent skills, distributed via [skills.sh](https://skills.sh). Each skill lives under `skills/<name>/` as a skills.sh-compatible bundle (with a `SKILL.md` manifest at its root); consumers install via `npx skills add` against this repo's URL.

The root package is `@acme-skunkworks/agent-skills` (`private: true` initially — flipped when there's a reason to publish the root itself). Versioning is via Changesets, mirroring the setup in sibling repos `@acme-skunkworks/eslint-config` and `@acme-skunkworks/markdownlint-config`.

Architectural decisions live under `architecture/` as ADRs (sequentially numbered, immutable once landed). ADR-0001 (forthcoming — ASW-133) settles the deeper questions — skill directory layout, distribution conventions, semver discipline — that this bootstrap deliberately defers.

## Commands

```bash
pnpm install              # install deps
pnpm changeset            # interactive changeset (or hand-write .changeset/<slug>.md)
pnpm changeset status     # show pending changesets and what would be released
pnpm changeset version    # consume pending changesets, bump versions, write CHANGELOG
```

Node 22 required (`.nvmrc`, `engines.node: ">=22"`, `engine-strict=true` in `.npmrc`).

## Conventions

- **Conventional Commits.** Commits follow `<type>(<scope>?): <subject>` (e.g. `feat(cleanup-repo): add stale-branch prune step`, `chore: bump @changesets/cli`). Enforced by convention only for now — no commitlint until the repo has enough churn to justify it.
- **Draft PRs.** Open PRs as drafts by default; flip to ready when CI is green and the work is review-ready.
- **Changesets per behavioural change.** Every PR that ships a skill change or a new skill includes a `.changeset/<slug>.md`. Tooling-only PRs (CI tweaks, dependency bumps that don't affect consumers) can skip.
- **Branch naming.** `<linear-id>-<slug>` lower-cased, matching Linear's `gitBranchName` (e.g. `asw-132-set-up-the-agent-skills-repo`).

## Release

`.github/workflows/release.yml` runs on every push to `main`. It uses `changesets/action` to either open a "release: version packages" PR (when pending changesets exist) or — once that PR merges — bump versions, tag, and call `pnpm changeset publish`. Publishing is a no-op while `package.json` is `private: true`; if the root or any extracted package becomes publishable, configure npm Trusted Publishing and flip `private` to `false`.

The `validate.yml` PR gate runs `pnpm changeset status` against the base branch. It's `continue-on-error` because chore-only PRs legitimately have no changeset; a missing changeset is a soft signal, not a hard fail. Manifest-lint for `skills/<name>/SKILL.md` joins this job with the first skill.

## Linear

- Workspace slug: `goose-and-hobbes`. Team key: `ASW` (ACME Skunkworks).
- When starting work on an ASW issue, transition it to `In Progress` via the Linear MCP (`mcp__linear-server__save_issue`) — unless it's already In Progress or further along.
- Transition to `In Review` when the PR opens. `Done` / `Canceled` stay manual or via Linear's GitHub integration on PR merge.

## Out of scope (deferred)

- **Husky / lint-staged / commitlint.** Lands with the first skill, not the bootstrap — the lint-config sibling repos have the setup to crib from.
- **Manifest lint for `skills/<name>/SKILL.md`.** Joins `validate.yml` with skill #1.
- **`/send-it` slash command.** Octavo's `/send-it` is tied to that repo's changelog infrastructure; a slimmer flavour for this repo is a future refinement, not bootstrap work.
