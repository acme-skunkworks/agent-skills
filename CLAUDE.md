# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Writing style

Use **British English** spelling and grammar in all prose you author for this repo: code comments, documentation (this file, ADRs, READMEs, `changelog/*.md`), commit messages, PR titles and bodies, and user-facing strings.

- **Spelling.** Prefer British forms: *colour*, *behaviour*, *organisation*, *centre*, *catalogue*, *recognise*, *analyse*, *licence* (noun) / *license* (verb), *-ise*/*-yse* over *-ize*/*-yze*.
- **Grammar and punctuation.** British conventions where they differ from American: single quotes are acceptable when quoting; place full stops outside closing quotation marks when the quoted phrase is partial; *whilst* and *amongst* are fine; collective nouns may take a plural verb ('the team are' / 'the team is' are both fine — pick whichever reads better).
- **Scope: prose, not code.** This rule applies to text written for humans. It does **not** apply to identifiers, dependency names, third-party API field names, or quoted upstream text that already uses US spelling. Examples of things to leave alone: CSS `color`, `background-color`; package names like `serialize-javascript`; API fields like `analyze_url`; quoted error messages from upstream tools.
- **When in doubt, follow upstream.** If you're touching code that mirrors an external API or library, match the upstream spelling exactly — even in surrounding comments where that name appears. Consistency with the thing being wrapped beats consistency with this rule.

## Repo

Container for shared agent skills, distributed via [skills.sh](https://skills.sh). Each skill lives under `skills/<name>/` as a skills.sh-compatible bundle (with a `SKILL.md` manifest at its root); consumers install via `npx skills add` against this repo's URL.

The root package is `@acme-skunkworks/agent-skills` (`private: true` initially — flipped when there's a reason to publish the root itself). Versioning is via **release-please** (Conventional Commits — ADR 0002, SK-380), mirroring the setup in sibling repos `@acme-skunkworks/eslint-config` and `@acme-skunkworks/markdownlint-config`.

Architectural decisions live under `architecture/` as ADRs (sequentially numbered, immutable once landed). ADR-0001 (forthcoming — ASW-133) settles the deeper questions — skill directory layout, distribution conventions, semver discipline — that this bootstrap deliberately defers.

## Commands

```bash
pnpm install              # install deps (runs husky via the prepare script)
pnpm test                 # vitest — changelog + send-it helper unit tests
pnpm validate:changelog   # validate changelog/<ts>-<slug>.md entries against the schema
pnpm validate:skills      # assert each skills/*/ package.json + SKILL.md metadata.version are consistent (ASW-364)
pnpm changelog:finalise   # enrich + version-stamp dated changelog/ entries (orchestrator-run at release)
```

Versioning runs through **release-please**, driven by Conventional Commits PR titles — there is no `pnpm changeset` here any more (SK-380). The bump is decided by the merged PR title; `release.yml` publishes on a version-vs-tag gate.

Node 22 required (`.nvmrc`, `engines.node: ">=22"`, `engine-strict=true` in `.npmrc`).

## Conventions

- **Conventional Commits.** Commits follow `<type>(<scope>?): <subject>` (e.g. `feat(cleanup-repo): add stale-branch prune step`, `chore: bump tsx`). Commit messages are convention-only (no commitlint), but the **PR title is CI-linted** (`amannn/action-semantic-pull-request` in the standalone `PR Title` workflow, `pr-title.yml`) because the repo squash-merges and that title is the squash subject release-please reads to decide the bump.
- **Draft PRs.** Open PRs as drafts by default; flip to ready when CI is green and the work is review-ready.
- **The PR title decides the release (SK-380).** release-please reads the merged Conventional-Commit PR title: `feat:` → minor, `fix:`/`perf:`/`revert:` → patch, a `!`/`BREAKING CHANGE:` → major; `docs`/`chore`/`ci`/`refactor`/`test`/`build`/`style` cut no release. `/send-it` maps shippable changes to `feat`/`fix`/`feat!` only; release-please still bumps on a manually titled `perf:` or `revert:`. A release-triggering title MUST carry a dated `changelog/*.md` entry — the `📓 Changelog completeness` gate in `build-and-lint` enforces it (no entry → build fails). There are no `.changeset/*.md` files any more. `/send-it` composes the right title from the branch's commits (shippable → `feat`/`fix`/breaking; non-shippable → a non-release type).
- **Single published package.** npm versioning is repo-level: the root `@acme-skunkworks/agent-skills` is the only published package (ADR-0002), with `files: ["skills/"]` as the published surface. There is no `pnpm-workspace.yaml` and no `workspaces` field. Skills carry their own **non-npm** version in `SKILL.md` `metadata.version` (mirrored in the skill's private `package.json`), bumped by hand — `pnpm validate:skills` enforces that parity in CI (the `🧩 Validate skill bundle metadata` step in `build-and-lint`).
- **Skill versioning is non-npm.** Each skill carries its own version in its `package.json` `version` (kept `private: true`) mirrored into `SKILL.md` `metadata.version`, bumped **by hand** per ADR-0001 Decision 2's semver semantics when that skill changes. This label is for consumers/runtime introspection and is decoupled from the root npm release — it is **never** driven by a changeset. See [ADR-0002](architecture/0002-repo-level-npm-versioning.md).
- **Skill bundle metadata contract.** Every `skills/<name>/` ships a `package.json` with `name: "@acme-skunkworks/skill-<name>"` (the `skill-` prefix + directory name), `private: true`, a semver `version` (starts at `0.1.0`), and `repository.directory: "skills/<name>"`; plus a `SKILL.md` whose `name` equals the directory and whose `metadata.version` **matches** the `package.json` version. Full layout in [ADR-0001 Decision 3](architecture/0001-skill-layout.md). `pnpm validate:skills` enforces the naming/`private`/version + `metadata.version` parity rules in CI (the `🧩 Validate skill bundle metadata` step in `build-and-lint`); `skills-ref validate` (the `skill-manifests` job) covers the rest of the spec.
- **Branch naming.** `<linear-id>-<slug>` lower-cased, matching Linear's `gitBranchName` (e.g. `asw-132-set-up-the-agent-skills-repo`).

## Shipping changes (`/send-it`)

`/send-it` (the [`send-it` skill](skills/send-it/SKILL.md), dogfooded via the thin `.claude/commands/send-it.md` shim) is the all-in-one finisher: it commits uncommitted work as atomic Conventional Commits, runs the change-gated lint `preflight`, composes a **Conventional Commits PR title** (the release-please bump signal) and writes or updates a dated `changelog/<ts>-<slug>.md` entry for shippable changes, pushes the branch, opens or updates a draft PR, and transitions linked Linear issues to **In Review**. It is a thin orchestrator that delegates the lint gate, changelog authoring, and Linear writeback to the standalone `preflight` / `changelog` / `linear-sync` skills. Prefer it over hand-rolled `git commit` + `git push` + `gh pr create` flows.

Common invocations:

```bash
/send-it                              # commit + changelog entry + conventional PR title + push + draft PR
/send-it --issue=ASW-132              # same, plus prefix the auto-branch with asw-132-
/send-it --ready                      # open the PR as ready-for-review (not draft)
/send-it --merge-when-ready           # enable gh pr merge --auto --squash after creation
/send-it --worktree=<branch-or-path>  # cd into a worktree first, then run
/send-it --base=<branch>              # target a non-main base (stacked PRs)
/send-it --title="fix(x): …"          # override the derived PR title verbatim
/send-it --skip-preflight             # bypass the lint gate (prints a warning)
```

Because this repo ships many independently-versioned skill bundles, the skill's
`config.json` sets `bundleVersioning`: when a `skills/<name>/` bundle changes without
a version bump, `/send-it` proposes one and (on confirmation) bumps its `package.json`
`version` + `SKILL.md` `metadata.version` in lockstep before composing the PR title.

**`/send-it` is now the shared `send-it` skill (SK-389).** The canonical workflow lives in [`skills/send-it/SKILL.md`](skills/send-it/SKILL.md); this repo dogfoods it through the thin `.claude/commands/send-it.md` shim — the same pattern as `/preflight`, `/changelog`, and `/linear-sync`. The deterministic slug/bump helper is the bundle's own zero-dependency `skills/send-it/scripts/derive-bump.mjs` (Node built-ins, no `tsx`; `infrastructure/send-it/` is gone). Consumers install it with `npx skills add … --skill send-it`, alongside the `preflight` / `changelog` / `linear-sync` skills it delegates to. Rolling the other repos (Octavo + the single-package repos) onto the shared skill and deleting their per-repo copies is the remaining cross-repo work tracked under SK-389.

## Release

`.github/workflows/release.yml` is **publish-only** and runs on every push to `main` (no `workflow_dispatch` — ASW-326). It never opens or merges the release PR. Versioning is owned by the private **road-runner-bot `release-orchestrator`** repo running **release-please**, mirroring `@acme-skunkworks/eslint-config` (ASW-311 / ASW-312 / ASW-320 / SK-380). It is a **build-once-publish-exact 3-job split** (ASW-328): an unprivileged `build` job (`pnpm install` + `npm pack` — no compile step; agent-skills ships skills.sh bundles) packs one tarball and uploads it as an artifact; `release` (npm OIDC) and `publish-github-packages` (GitHub-native provenance attestation) each download and publish that exact tarball, so the npm tarball, the GitHub Packages tarball, and the attested digest are byte-identical and no build-time code runs alongside a publish credential. Non-secret knobs (node-version-file, registry URLs, npm scope) come from `infrastructure/repo-config.yaml` via the `load-repo-config` composite action (allowlist-validated → `GITHUB_OUTPUT`, ASW-330). `files: ["skills/"]` in `package.json` scopes the tarball to the skill bundles. Publishing is dual-registry (public npm + GitHub Packages) and **dormant by design**: both publish scripts guard on `private: true` and `exit 0` while the root package is private, so the full machinery runs green and publishes nothing. (The guard matters because these scripts call raw `npm publish`, which *errors* on a private package rather than skipping it; without the guard the release job would go red.)

### How a release flows

1. A feature PR merges to `main` with a Conventional-Commit title (`feat:`/`fix:`/breaking → release-triggering; `docs`/`chore`/`ci`/… → not). `release.yml` fires; its **version-vs-tag gate** sees `package.json`'s version already tagged (`v<version>` exists), so it's a clean no-op.
2. On its 15-minute cron tick the orchestrator mints a short-lived repo-scoped App token (the bot's private key **never** touches this public repo's CI), runs `release-please release-pr` (which reads the merged Conventional-Commit titles, computes the bump, and bumps `package.json` + `.release-please-manifest.json`) then `pnpm changelog:finalise` (enriches + version-stamps the dated `changelog/` entries), and opens/force-updates the `release-please--branches--main` PR titled `chore(main): release <version>`.
3. The orchestrator waits for the required **`🔬 Build & Lint`** check (the `build-and-lint` job in `validate.yml`, which deliberately runs on the release PR), then squash-merges it (pinned to the gate-checked head SHA — SK-334).
4. That merge re-fires `release.yml`. The version-vs-tag gate now sees a freshly bumped, **untagged** version → it runs the publish path: `build` packs the tarball, then `release` (npm OIDC) + `publish-github-packages` (provenance attestation) publish that exact artifact, plus an explicit idempotent git tag / GitHub release (notes sourced from the dated `changelog/` entry stamped with that version). While `private: true`, both publish legs `exit 0` — green, ships nothing. A `🚨 Notify on release failure` step opens/updates a tracking issue if any step fails (the run is unattended).

- **npm leg.** The `🚀 Publish (npm)` step calls `scripts/publish-via-raw-npm.sh` directly (no `changesets/action` shell now that Changesets is gone — SK-380) — pnpm's own OIDC path fails even with an upgraded npm on `PATH` (eslint-config ASW-174). The wrapper publishes the prebuilt `$TARBALL` from the `build` job via `npm publish "$TARBALL" --access public --provenance` (the upgraded npm), and is idempotent (skips only on a genuine `npm view` hit — exit 0 *with* output — and `exit 0`s early while `private: true`). Auth is OIDC Trusted Publishing — **no `NPM_TOKEN`**. Needs npm ≥ 11.5.1, hence the "Upgrade npm" step (the runner ships npm 10.9.x, which is both too old and broken on self-upgrade). The step is gated on `push` + `refs/heads/main` + the version-vs-tag gate (`should_publish == 'true'`), alongside the branch-restricted `npm-release` environment (ASW-326).
- **GitHub Packages leg.** A separate job (so `packages: write` never coexists with the npm OIDC credential). `actions/attest-build-provenance` signs the exact tarball, then `scripts/publish-to-github-packages.sh` publishes it. Gated on the same `should_publish` + main-only condition (reused via the `release` job's output). It's idempotent against `npm.pkg.github.com`, uses token auth via `GITHUB_TOKEN` (no OIDC; `npm --provenance` is npmjs.org-only, so provenance rides the attestation instead), hard-codes the registry host and fails closed on drift (ASW-330), and carries the same `private: true` `exit 0` guard.

Both publish scripts are exercised by bats tests in `infrastructure/tests/` (run in `validate.yml`'s `infra` job alongside shellcheck); the dated-changelog `.ts` helpers (`infrastructure/scripts/*-changelog.ts`) and the send-it slug/bump helper (`skills/send-it/scripts/derive-bump.mjs`) have vitest unit tests run in `build-and-lint`. Workflow YAML is linted by digest-pinned `yamllint` + `actionlint` (`infrastructure/scripts/ensure-*.sh`, ASW-327) in the `yaml-lint` job.

### One-time setup (out of band, operator)

The orchestrator model needs server-side config that lives outside this repo:

1. **Add `agent-skills` to the orchestrator matrix** — `strategy.matrix.repo` in `release-orchestrator/.github/workflows/orchestrate-releases.yml` (a separate PR in that repo). This is the only orchestrator-side change; there is no central allowlist file.
2. **Install road-runner-bot** on `agent-skills` with `contents: write` + `pull-requests: write`. Its private key stays scoped to the orchestrator repo — never broaden it here.
3. **Create the `npm-release` environment** restricted to `main` (defence-in-depth, ASW-326). Without it the workflow still runs — GitHub auto-creates an *unprotected* environment on first use and publishing stays gated by the explicit `push` + `refs/heads/main` step guards — so this adds the structural branch restriction on top:

   ```bash
   gh api -X PUT repos/acme-skunkworks/agent-skills/environments/npm-release \
     --input - <<<'{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
   gh api -X POST repos/acme-skunkworks/agent-skills/environments/npm-release/deployment-branch-policies \
     -f name=main -f type=branch
   ```

4. **Make `🔬 Build & Lint` a required status check** on `main` (exact name, incl. emoji — the orchestrator polls it verbatim). Add it to a **repo-level** ruleset / branch-protection rule on `agent-skills`, *not* the org-level "Protect main trunk" ruleset (that governs every org repo). The job runs on the `release-please--branches--main` PR (no skip), so the orchestrator's release PRs satisfy it. Keep "Allow GitHub Actions to create and approve pull requests" **off**; enable "Allow auto-merge".

> **60-day caveat.** The orchestrator's schedule auto-disables after 60 days with no commits to the orchestrator repo — releases then stop silently. Keep it alive (a periodic commit, or an external cron trigger).

### Flip-to-public checklist (the deferred first live publish)

When the root — or an extracted package — becomes publishable, the release machinery is already in place; flipping it on is mostly mechanical. The one part that is **not** mechanical is the very first publish: it **cannot go through CI** and must be done by hand (see **Bootstrap publish** below for why and how). npm has no pending-Trusted-Publisher flow, so the package has to exist on the registry *before* the Trusted Publisher allowlist form is even reachable.

1. **Set `private: false`** in `package.json`. `publishConfig` (`access: public`, `provenance: true`, registry) is already present. Note the publish scripts stop short-circuiting the moment this flips — they will publish on the next version-PR merge.
2. **Land a `feat:`/`fix:` (or breaking) PR** so release-please cuts a version (the bootstrap publish ships at that version).
3. **Manual publish #1** — follow the **Bootstrap publish** runbook below: a hand-driven `npm publish` reserves the name on npm. With the default `auth-type=web`, npm opens a browser and your passkey approves the first-publish 2FA (a recovery-code `--otp` is the headless fallback). This step is unavoidable; bypass-2FA tokens don't work for a brand-new package's first publish.
4. **Configure the npm Trusted Publishing allowlist** at `npmjs.com/package/@acme-skunkworks/agent-skills/access` → GitHub Actions. The workflow filename (`release.yml`) and the `acme-skunkworks/agent-skills` repo must match the allowlist entry exactly, or OIDC publish 404s (eslint-config ASW-174). This is only reachable *after* step 3.
5. **CI takes over from publish #2.** The next version-PR merge publishes via OIDC (npm) + GitHub Packages + provenance, with no standing `NPM_TOKEN`. The GitHub Packages leg needs no extra config — `packages: write` and `GITHUB_TOKEN` auth are already wired.

`validate.yml` has four jobs: **`🔬 Build & Lint`** (the required gate — runs on the release PR; hard-gates on the frozen-lockfile install, the vitest unit tests, `pnpm validate:changelog`, `pnpm validate:skills` (the per-skill bundle-metadata guard, ASW-364), and the `📓 Changelog completeness` gate (SK-380 — a `feat`/`fix`/breaking PR title must carry a dated `changelog/` entry)), **`yaml-lint`** (digest-pinned yamllint + actionlint), **`infra`** (shellcheck + bats over the publish scripts), and **`skill-manifests`** (validates every `skills/<name>/SKILL.md`). `yaml-lint`/`infra`/`skill-manifests` are skipped on `release-please--*` so the release PR isn't blocked on them. The Conventional-Commit PR-title lint runs as its own **`PR Title`** workflow (`pr-title.yml`, SHA-pinned `amannn/action-semantic-pull-request`) rather than a `validate.yml` job (SK-401) — the title is the release-please bump signal (SK-380), so its format is linted on every PR (status context `Validate PR title is a Conventional Commit`).

The deeper eslint-config hardening that was deferred during the bootstrap — the build-once 3-job split + provenance attestation, the `load-repo-config` action, the dated-changelog system, and husky — **landed in [ASW-345](https://linear.app/acme-skunkworks/issue/ASW-345)** ahead of the publishing flip. The machinery is fully wired and exercised in CI, but stays dormant (publishing nothing) until `private: false`.

> **While `private: true`, the real `pnpm run release:manual` refuses** — `npm publish` errors `EPRIVATE` ("This package has been marked as private") by design. Note that `pnpm run release:manual:dry` does **not** refuse: on current npm (11.x) the `--dry-run` path skips the private guard and happily simulates the tarball, reporting success. So a green dry-run while still private only proves the tarball packs and your auth works — it does **not** prove the real publish is unblocked. Both scripts are validated end-to-end at flip time once `private: false`; until then they exist only as wiring.

### Manual publish (break-glass — CI-down only, after the package exists)

> **This is break-glass, not a routine path (ASW-331).** Reach for it only when CI/OIDC is genuinely down — every normal release goes through `release.yml` (OIDC, no standing token). The `.env` `NPM_TOKEN` is a long-lived credential, so treat it accordingly:
>
> - **Store it in a secrets manager**, retrieved just-in-time into the shell — not committed to a plaintext `.env` that lingers on disk (`.env` is gitignored, but a secrets manager is the stronger control).
> - **Shortest viable lifetime + a documented rotation cadence**; rotate immediately if a laptop is lost or the token is exposed.
> - It never touches CI (this file forbids `NPM_TOKEN` as a CI secret), and manual publishes are distinguishable from CI ones (no provenance badge), so a manual release can't masquerade as a verified CI one. The only way this token leaks is full local-machine compromise.

For when CI is down. **If you're at an interactive machine, the simplest break-glass is no token at all** — run `pnpm run release:manual` and approve the 2FA in the browser with your passkey (same flow as a bootstrap publish). The `.env` `NPM_TOKEN` path below is for *unattended/headless* break-glass, where there's no browser to complete the passkey challenge.

Token auth setup (one-time, or after rotating your token):

```bash
NPM_TOKEN=$(grep '^NPM_TOKEN=' .env | cut -d'=' -f2-)
npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
npm whoami    # verify
```

The token must be a **Granular Access Token with the "Bypass 2FA" option enabled at creation time**. Without that flag, every publish hits `EOTP` and you're stuck. Tokens are immutable after creation — if you forgot the flag, revoke and regenerate.

Then publish:

```bash
pnpm run release:manual:dry    # simulate — verifies tarball + auth
pnpm run release:manual        # actual publish
```

`--provenance=false` is intentional — provenance attestation requires a GitHub Actions OIDC issuer, which a laptop doesn't have. Manual publishes ship without the provenance badge; CI publishes get it. (agent-skills has no build step, so `release:manual` is a bare `npm publish` — unlike eslint-config's chained `build && publish`.) Use `release:manual:dry` to simulate rather than passing `--dry-run` through `release:manual`.

### Bootstrap publish — read this when setting up a new package

The very first publish of a brand-new npm package **cannot go through CI**. Two reasons that compound:

- npm (unlike PyPI) has no pending-Trusted-Publisher flow. The package must exist on the registry before the Trusted Publisher form is reachable at `npmjs.com/package/<name>/access`.
- npm enforces 2FA at the publish endpoint for the first publish of a new package, irrespective of account/org/token bypass settings. Granular bypass-2FA tokens only honour the bypass on subsequent publishes.

So bootstrap is always: manual first publish → configure Trusted Publisher → CI takes over from publish #2.

**Pre-flight:**

- You belong to the target npm org with publish rights.
- npm CLI ≥ 11.5.1 (`npm install -g npm@latest`).
- Account has 2FA enabled with a **passkey registered** (preferred — it satisfies the first-publish 2FA in the browser). Have **recovery codes generated and saved** too, as the headless fallback.
- An interactive browser is available and `auth-type=web` is in effect (the npm default — check with `npm config get auth-type`). That's what lets npm hand off the publish 2FA to your passkey.
- `package.json` is at the version you want to ship (release-please's release PR bumps `package.json` + `.release-please-manifest.json` and `pnpm changelog:finalise` version-stamps the dated `changelog/` entries; for a hand-driven bootstrap, set the version manually or merge the release PR first).

**Sequence:**

1. Get `package.json` to the target version — normally by merging the release-please release PR (which bumps `package.json` + `.release-please-manifest.json` and runs `pnpm changelog:finalise` to finalise the dated `changelog/<ts>-<slug>.md` entries). There is no root `CHANGELOG.md` (release-please runs with `skip-changelog`); the dated entries are the only changelog.
2. `pnpm run release:manual:dry` — verify tarball + auth. **Note:** dry-run does NOT trigger 2FA enforcement, so a successful dry-run does not predict a successful real publish. It only proves the tarball is valid and your credentials authenticate.
3. `pnpm run release:manual` — the real publish. With `auth-type=web` (the npm default) npm **opens a browser and prompts for 2FA; approve it with your passkey** (Touch ID / Face ID / security key). That satisfies the first-publish 2FA and the package publishes — no `--otp`, no recovery code. This is the normal path on current npm.
4. **Fallback — only if the browser flow isn't available** (headless host, no passkey registered, or an npm too old for web auth): the publish stops at `EOTP`. Pass a **recovery code as the `--otp` value**:

   ```bash
   npm publish --access public --provenance=false --otp=<recovery-code>
   ```

   Generate codes at npmjs.com → Profile → Two-Factor Authentication → Manage Recovery Codes. Each is single-use. The format is a long hex string (not a 6-digit TOTP) — npm accepts it as `--otp` anyway. **If you use one, immediately regenerate recovery codes** — the one you used is burnt; if you transmitted it anywhere (chat, paste buffer with cloud sync, screen share), treat the rest of the set as compromised. (The passkey path in step 3 burns nothing, so there's nothing to regenerate.)

5. Configure Trusted Publisher: `https://www.npmjs.com/package/@acme-skunkworks/agent-skills/access` → GitHub Actions → org, repo, workflow filename (`release.yml`), environment blank.
6. From here on, releases go through CI cleanly.

#### Fallback troubleshooting — things that look like solutions but aren't

These only matter when you're on a headless host (or have no passkey) and stuck on `EOTP` — on an interactive machine the passkey browser flow (step 3) just works and you skip all of this. When you *are* stuck, a recovery-code `--otp` (step 4) is the answer; these are **not**:

- Toggling "Require 2FA for write actions" off in account settings.
- Disabling org-level 2FA enforcement.
- Generating a Granular token with bypass-2FA enabled — works for publish #2+, NOT publish #1.
- `oathtool` for generating TOTP — only works if you have a TOTP secret, and **npm has phased TOTP out of new accounts** (only passkeys + recovery codes are offered now).
- Disabling 2FA entirely — npm's policy *requires* either 2FA or a bypass-2FA token; you can't disable both. And the bypass token doesn't help for publish #1 anyway.

> **Don't disable `auth-type=web` reaching for a recovery code.** `auth-type=web` is the npm default and is precisely what lets a passkey satisfy the publish 2FA in the browser — it is the *primary* path (step 3), not a dead-end. Recovery codes only become "the answer" when no browser/passkey is in play.

## Linear

- Workspace slug: `goose-and-hobbes`. Team key: `ASW` (ACME Skunkworks).
- When starting work on an ASW issue, transition it to `In Progress` via the Linear MCP (`mcp__linear-server__save_issue`) — unless it's already In Progress or further along.
- Transition to `In Review` when the PR opens. `Done` / `Canceled` stay manual or via Linear's GitHub integration on PR merge.

## Out of scope (deferred)

- **commitlint.** No commit-message linting until the repo has enough churn to justify it. Husky + lint-staged landed in [ASW-345](https://linear.app/acme-skunkworks/issue/ASW-345) (`.husky/pre-push` blocks direct `main` pushes, `pre-commit` runs lint-staged, `commit-msg` strips the Claude trailer), but the `commit-msg` hook does **not** enforce Conventional Commits — commit messages stay convention-only. (The **PR title** is a different matter: since SK-380 it's CI-linted by the standalone `PR Title` workflow (`pr-title.yml`), because it's the squash subject release-please reads to decide the bump.)
