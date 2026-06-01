---
"@acme-skunkworks/agent-skills": minor
---

Add the `preflight` skill: the single source of truth for the change-gated,
branch-scoped lint preflight — lint only the categories a branch touched (ESLint /
markdownlint / actionlint) on `origin/<base>...HEAD` changed paths, classify each
violation as introduced (on a branch-changed line) vs pre-existing, and drive the
fix/defer loop via an exit-code contract (0 pass, 1 introduced/blocking, 2
pre-existing only). Bundles the zero-dependency `.mjs` scripts (Node built-ins
only, no build step): `preflight`, `lint-fix`, `classify-lint`, plus shared
`scripts/lib` helpers (`scope`, `diff-lines`, `paths`). Linted workspaces
(`pnpm-workspace.yaml` + each package's `lint` script) and the base branch
(`origin/HEAD`, falling back to `main`) are auto-detected, with an optional
repo-root `preflight.config.json` override, and a local `/preflight` command
wrapper runs the standalone report/fix flow.
