# Skills

Each skill lives in `skills/<name>/` as a [skills.sh](https://skills.sh)-compatible bundle with a `SKILL.md` manifest at its root.

Consumers install a skill from this repo with:

```bash
npx skills add https://github.com/acme-skunkworks/agent-skills --skill <name> --agent claude-code --agent cursor --copy
```

No skills here yet — the first one (`cleanup-repo`) is tracked under [ASW-134](https://linear.app/goose-and-hobbes/issue/ASW-134). The exact bundle layout may be refined by ADR-0001 (ASW-133) once skills.sh's expected structure is double-checked.
