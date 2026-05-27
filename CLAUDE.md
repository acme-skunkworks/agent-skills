# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Writing style

Use **British English** spelling and grammar in all prose you author for this repo: code comments, documentation (this file, ADRs, READMEs, `.changeset/*.md`), commit messages, PR titles and bodies, and user-facing strings.

- **Spelling.** Prefer British forms: *colour*, *behaviour*, *organisation*, *centre*, *catalogue*, *recognise*, *analyse*, *licence* (noun) / *license* (verb), *-ise*/*-yse* over *-ize*/*-yze*.
- **Grammar and punctuation.** British conventions where they differ from American: single quotes are acceptable when quoting; place full stops outside closing quotation marks when the quoted phrase is partial; *whilst* and *amongst* are fine; collective nouns may take a plural verb ('the team are' / 'the team is' are both fine — pick whichever reads better).
- **Scope: prose, not code.** This rule applies to text written for humans. It does **not** apply to identifiers, dependency names, third-party API field names, or quoted upstream text that already uses US spelling. Examples of things to leave alone: CSS `color`, `background-color`; package names like `serialize-javascript`; API fields like `analyze_url`; quoted error messages from upstream tools.
- **When in doubt, follow upstream.** If you're touching code that mirrors an external API or library, match the upstream spelling exactly — even in surrounding comments where that name appears. Consistency with the thing being wrapped beats consistency with this rule.

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

## Shipping changes (`/send-it`)

`/send-it` (`.claude/commands/send-it.md` plus `scripts/send-it/`) is the all-in-one finisher: it commits uncommitted work as atomic Conventional Commits, writes or updates a `.changeset/<slug>.md`, pushes the branch, opens or updates a draft PR, and transitions linked Linear issues to **In Review**. Prefer it over hand-rolled `git commit` + `git push` + `gh pr create` flows.

Common invocations:

```bash
/send-it                              # commit + changeset + push + draft PR
/send-it --issue=ASW-132              # same, plus prefix the auto-branch with asw-132-
/send-it --ready                      # open the PR as ready-for-review (not draft)
/send-it --merge-when-ready           # enable gh pr merge --auto --squash after creation
/send-it --worktree=<branch-or-path>  # cd into a worktree first, then run
```

**`/send-it` here is a stopgap.** It was cloned from `@acme-skunkworks/eslint-config`'s `/send-it` and lightly adapted. The whole point of the Agent Skills project is to extract `/send-it` into a single reusable skill so the per-repo copies disappear. When that skill ships, this slash command and `scripts/send-it/` get deleted and replaced by `npx skills add … --skill send-it`. Tracked in the Agent Skills Linear project.

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
