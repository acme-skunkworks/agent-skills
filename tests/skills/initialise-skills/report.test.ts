// Imports the BUNDLE lib directly (the distributed `.mjs`). Covers the pure
// reconcile-report builder and its human renderer (A-465): aggregation of
// per-key statuses into totals + drift/manual buckets, and the text formatting
// Claude shows the user. No filesystem or git — `buildReport` consumes the merge
// results verbatim.
import {
  buildReport,
  formatHuman,
} from "../../../skills/initialise-skills/scripts/lib/report.mjs";
import { describe, expect, it } from "vitest";

const SKILL_REPORTS = [
  {
    configPath: "skills/changelog/config.json",
    malformed: false,
    name: "changelog",
    results: {
      baseBranch: { status: "inferred", write: "main" },
      changelogDir: { status: "unchanged" },
      issueKeys: { detected: ["XYZ"], keep: ["ABC"], status: "drift" },
      linearWorkspaceSlug: { status: "needs-manual-input" },
    },
  },
];

describe("buildReport", () => {
  it("aggregates totals and collects drift + manual buckets", () => {
    const report = buildReport(SKILL_REPORTS, false);

    expect(report.mode).toBe("dry-run");
    expect(report.totals).toEqual({
      drift: 1,
      inferred: 1,
      "needs-manual-input": 1,
      unchanged: 1,
    });

    expect(report.driftKeys).toEqual([
      {
        configPath: "skills/changelog/config.json",
        detected: ["XYZ"],
        kept: ["ABC"],
        key: "issueKeys",
        skill: "changelog",
      },
    ]);
    expect(report.manualKeys).toEqual([
      {
        configPath: "skills/changelog/config.json",
        key: "linearWorkspaceSlug",
        skill: "changelog",
      },
    ]);
  });

  it("marks a --write run with mode 'write'", () => {
    expect(buildReport(SKILL_REPORTS, true).mode).toBe("write");
  });
});

describe("formatHuman", () => {
  it("renders the dry-run header, per-key details, and trailing guidance", () => {
    const text = formatHuman(buildReport(SKILL_REPORTS, false));

    expect(text).toContain("dry run (no files written)");
    expect(text).toContain("skills/changelog/config.json");
    expect(text).toContain("inferred");
    expect(text).toContain('keeps ["ABC"] vs detected ["XYZ"]');
    expect(text).toContain("1 drifted key(s) kept");
    expect(text).toContain(
      "1 key(s) need manual input: changelog.linearWorkspaceSlug.",
    );
  });

  it("flags an unparseable config and skips its keys", () => {
    const text = formatHuman(
      buildReport(
        [
          {
            configPath: "skills/broken/config.json",
            malformed: true,
            name: "broken",
            results: {},
          },
        ],
        true,
      ),
    );
    expect(text).toContain("wrote inferred values");
    expect(text).toContain("⚠ existing config.json is unparseable — skipped");
  });
});
