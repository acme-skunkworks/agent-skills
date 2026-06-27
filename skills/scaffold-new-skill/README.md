# scaffold-new-skill

Generate a spec-compliant skeleton for a new `skills/<name>/` bundle in the
agent-skills repo, so new skills start consistent with the bundle contract and
stop drifting. Every artefact the generator writes passes the same
`pnpm validate:skills` gate (ADR-0001, A-364) the moment it lands.

## Install

From any consumer repo:

```bash
npx skills add https://github.com/acme-skunkworks/agent-skills --skill scaffold-new-skill --agent claude-code --copy
```

`--copy` writes real files so the bundle is portable. Don't use `-g` /
`--global` — the install should live in the consumer repo.

## Configure

The shipped [`config.json`](config.json) carries the defaults the generator
stamps into a new skill:

| Key | Meaning | Default |
| --- | --- | --- |
| `scope` | The npm scope used in the generated `package.json` name (`<scope>/skill-<name>`). | `"@acme-skunkworks"` |
| `author` | The default author string for the generated `SKILL.md` `metadata.author` and `package.json`. | `"Rob Easthope"` |

A neutral [`config.example.json`](config.example.json) ships alongside as a
template; its key set is identical to `config.json`.

## Usage

Preview what would be written (creates nothing):

```bash
node skills/scaffold-new-skill/scripts/scaffold.mjs --name=my-new-skill --dry-run
```

Generate the skeleton:

```bash
node skills/scaffold-new-skill/scripts/scaffold.mjs --name=my-new-skill
```

This writes `skills/my-new-skill/` (`SKILL.md`, `package.json`,
`config.json` + `config.example.json`, `scripts/my-new-skill.mjs`, `README.md`)
plus a `tests/skills/my-new-skill/my-new-skill.test.ts` stub. The generator
refuses to overwrite a `skills/<name>/` that already has content.

Flags:

- `--name=<kebab>` — the skill (and directory) name. Required for a real run.
- `--author="…"` — override the default author for this skill.
- `--root=<dir>` — write under `<dir>` instead of the current directory.
- `--dry-run` — print the file list, write nothing.
- `--self-test` — run the built-in offline assertions.
- `--help` (alias `-h`) — print usage.

After generating, fill in the `TODO` placeholders in the new `SKILL.md`, entry
script, config, and test stub, then run `pnpm validate:skills && pnpm test`.

## Requirements

- Node.js ≥22 (per the package's `engines`), for the bundled generator.
