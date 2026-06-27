import { describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure
// auto-fix command planner (A-465): run order, the root+scripts eslint merge,
// one `--filter`ed invocation per workspace with changes, and the markdownlint
// tail. The actual spawning stays behind the CLI `main()` guard.
import { planFixCommands } from "../../../skills/preflight/scripts/lint-fix.mjs";

const EMPTY_SCOPE = {
  codeChanged: false,
  markdownChanged: false,
  markdown: [],
  workspaces: {},
  eslint: { scripts: [], root: [] },
};

describe("planFixCommands", () => {
  it("plans nothing when nothing changed", () => {
    expect(planFixCommands(EMPTY_SCOPE)).toEqual([]);
  });

  it("merges scripts + root into a single eslint --fix invocation", () => {
    const commands = planFixCommands({
      ...EMPTY_SCOPE,
      codeChanged: true,
      eslint: { scripts: ["scripts/a.mjs"], root: ["eslint.config.js"] },
    });
    expect(commands).toHaveLength(1);
    expect(commands[0].argv).toEqual([
      "exec",
      "eslint",
      "--fix",
      "--",
      "scripts/a.mjs",
      "eslint.config.js",
    ]);
  });

  it("emits one --filter eslint per workspace with changed files, skipping empty ones", () => {
    const commands = planFixCommands({
      ...EMPTY_SCOPE,
      codeChanged: true,
      workspaces: {
        web: { filter: "@acme/web", prefix: "apps/web/" },
        api: { filter: "@acme/api", prefix: "services/api/" },
      },
      eslint: {
        scripts: [],
        root: [],
        web: ["apps/web/src/x.ts"],
        api: [],
      },
    });
    expect(commands).toHaveLength(1);
    expect(commands[0].argv).toEqual([
      "--filter",
      "@acme/web",
      "exec",
      "eslint",
      "--fix",
      "--",
      "apps/web/src/x.ts",
    ]);
  });

  it("appends a markdownlint --fix command for changed markdown", () => {
    const commands = planFixCommands({
      ...EMPTY_SCOPE,
      markdownChanged: true,
      markdown: ["README.md"],
    });
    expect(commands).toHaveLength(1);
    expect(commands[0].argv).toEqual([
      "exec",
      "markdownlint-cli2",
      "--fix",
      "README.md",
    ]);
  });
});
