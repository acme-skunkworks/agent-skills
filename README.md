# agent-skills

Shared agent skills for Claude Code and Cursor, distributed as [skills.sh](https://skills.sh)-compatible bundles. Each skill lives under `skills/<name>/` with a `SKILL.md` manifest at its root.

## Installing a skill

From any consumer repo:

```bash
npx skills add https://github.com/acme-skunkworks/agent-skills --skill <name> --agent claude-code --agent cursor --copy
```

`--copy` writes real files (not symlinks) so the skill is portable across machines. Don't use `-g` / `--global` — installs should live in the consumer repo.

## Repo layout

```
.
├── .claude/commands/
│   └── send-it.md           # all-in-one finisher (stopgap until the send-it skill ships)
├── .github/
│   ├── actions/
│   │   └── load-repo-config/ # infrastructure/repo-config.yaml → step outputs
│   └── workflows/
│       ├── release.yml       # publish-only: build → npm (OIDC) → GitHub Packages (dormant)
│       └── validate.yml      # PR gate: build & lint, changelog validation, PR-title lint, infra tests
├── .husky/                  # git hooks (block main pushes; lint-staged; strip Claude trailer)
├── architecture/            # ADRs (sequentially numbered, immutable)
├── changelog/               # dated per-change release-note entries (the repo's only changelog)
├── release-please-config.json      # release-please packages config (single root package)
├── .release-please-manifest.json   # release-please version manifest
├── infrastructure/
│   ├── repo-config.yaml      # non-secret CI/release knobs
│   ├── scripts/              # changelog .ts helpers + ensure-*.sh tool bootstraps
│   ├── send-it/              # deterministic helpers for /send-it
│   └── tests/                # bats (publish scripts) + vitest (changelog)
├── scripts/                 # publish wrappers (npm OIDC + GitHub Packages)
├── skills/                  # one folder per skill
├── CLAUDE.md
├── LICENSE
├── README.md
└── package.json
```

The `skills/<name>/` convention may be refined by ADR-0001 (tracked in [A-133](https://linear.app/goose-and-hobbes/issue/A-133)) once skills.sh's expected layout is double-checked.

## Architecture decisions

ADRs land under `architecture/` as `NNNN-<slug>.md`. ADR-0001 — the foundational decision record for skill layout, distribution conventions, and semver discipline — is forthcoming.

## Contributing

See [CLAUDE.md](./CLAUDE.md) for the conventions (Conventional Commits, draft PRs, release-please versioning driven by the PR title).
