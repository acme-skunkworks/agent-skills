import { describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure
// summary assembler (A-465): the machine-readable verdict the ship flow reads —
// blocking/passed flags, per-category status, and the introduced/pre-existing
// violation split, across normal and --dry-run modes. The lint-running half
// (spawning eslint/markdownlint/actionlint) stays behind the CLI guard.
import { buildSummary } from "../../../skills/preflight/scripts/preflight.mjs";

const SCOPE = {
  mergeBase: "abc123",
  codeChanged: true,
  markdownChanged: true,
  workflowsChanged: false,
  eslint: { scripts: [], root: ["eslint.config.js"] },
  markdown: ["README.md"],
  actionlintTargets: [],
};

const CLEAN = { introduced: [], preExisting: [] };

describe("buildSummary", () => {
  it("passes when nothing is introduced and no linter failed", () => {
    const summary = buildSummary(SCOPE, { actionlintStatus: "skipped" }, CLEAN, false);
    expect(summary.passed).toBe(true);
    expect(summary.blocking).toBe(false);
    expect(summary.dryRun).toBe(false);
    expect(summary.categories.eslint).toEqual({
      scripts: [],
      root: ["eslint.config.js"],
    });
    expect(summary.categories.actionlint).toBe("skipped");
  });

  it("blocks on introduced violations and reports their count", () => {
    const summary = buildSummary(
      SCOPE,
      { actionlintStatus: "skipped" },
      { introduced: [{ file: "a.ts" }], preExisting: [] },
      false,
    );
    expect(summary.blocking).toBe(true);
    expect(summary.passed).toBe(false);
    expect(summary.violations.introducedCount).toBe(1);
  });

  it("blocks when a linter failed to run, even with no violations", () => {
    const summary = buildSummary(
      SCOPE,
      { actionlintStatus: "ran", failedLinters: ["eslint:root"] },
      CLEAN,
      false,
    );
    expect(summary.blocking).toBe(true);
    expect(summary.passed).toBe(false);
    expect(summary.results.failedLinters).toEqual(["eslint:root"]);
  });

  it("never marks pre-existing violations deferred under --dry-run", () => {
    const withPreExisting = { introduced: [], preExisting: [{ file: "old.ts" }] };
    expect(
      buildSummary(SCOPE, {}, withPreExisting, false).deferred,
    ).toBe(true);
    expect(
      buildSummary(SCOPE, {}, withPreExisting, true).deferred,
    ).toBe(false);
  });
});
