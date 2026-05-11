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
├── .changeset/              # pending changesets + config
├── .claude/commands/
│   └── send-it.md           # all-in-one finisher (stopgap until the send-it skill ships)
├── .github/workflows/
│   ├── release.yml          # changesets/action — "Version Packages" PR + release tags
│   └── validate.yml         # PR gate: pnpm changeset status (manifest lint joins later)
├── architecture/            # ADRs (sequentially numbered, immutable)
├── scripts/send-it/         # deterministic helpers for /send-it
├── skills/                  # one folder per skill
├── CLAUDE.md
├── LICENSE
├── README.md
└── package.json
```

The `skills/<name>/` convention may be refined by ADR-0001 (tracked in [ASW-133](https://linear.app/goose-and-hobbes/issue/ASW-133)) once skills.sh's expected layout is double-checked.

## Architecture decisions

ADRs land under `architecture/` as `NNNN-<slug>.md`. ADR-0001 — the foundational decision record for skill layout, distribution conventions, and semver discipline — is forthcoming.

## Contributing

See [CLAUDE.md](./CLAUDE.md) for the conventions (Conventional Commits, draft PRs, Changesets per behavioural change).
