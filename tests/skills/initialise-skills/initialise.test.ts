import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Imports the BUNDLE CLI directly (the distributed `.mjs`). Covers the pure
// argument/stdin helpers (A-465): flag parsing, the lenient acceptDrift coercion,
// and the per-skill drift-key resolution that keys off either the skill name or
// its repo-relative config path. `main()` stays behind the isCliEntry() guard, so
// importing here runs nothing.
import {
  acceptedDriftFor,
  asKeyList,
  parseArgs,
} from "../../../skills/initialise-skills/scripts/initialise.mjs";

describe("parseArgs", () => {
  it("defaults to a dry run reporting in human form", () => {
    const options = parseArgs([]);
    expect(options.write).toBe(false);
    expect(options.json).toBe(false);
    expect(options.skillsDir).toBeUndefined();
  });

  it("reads --write, --json, and value-taking flags", () => {
    const options = parseArgs([
      "--write",
      "--json",
      "--repo-root",
      "/repo",
      "--skills-dir",
      "/repo/skills",
    ]);
    expect(options).toMatchObject({
      write: true,
      json: true,
      repoRoot: "/repo",
      skillsDir: "/repo/skills",
    });
  });

  it("lets a later --dry-run override an earlier --write", () => {
    expect(parseArgs(["--write", "--dry-run"]).write).toBe(false);
  });

  it("sets help and ignores the rest", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
  });
});

describe("asKeyList", () => {
  it("keeps only string members of an array", () => {
    expect(asKeyList(["a", 1, "b", null])).toEqual(["a", "b"]);
  });

  it("returns an empty list for non-array input", () => {
    expect(asKeyList(undefined)).toEqual([]);
    expect(asKeyList("baseBranch")).toEqual([]);
  });
});

describe("acceptedDriftFor", () => {
  const skill = {
    name: "changelog",
    configPath: join("/repo", "skills/changelog/config.json"),
  };

  it("unions drift keys addressed by skill name and by relative config path", () => {
    const accepted = acceptedDriftFor(
      skill,
      {
        changelog: ["baseBranch", "issueKeys"],
        "skills/changelog/config.json": ["issueKeys", "changelogDir"],
      },
      "/repo",
    );
    expect(accepted.toSorted()).toEqual([
      "baseBranch",
      "changelogDir",
      "issueKeys",
    ]);
  });

  it("returns an empty list when nothing addresses the skill", () => {
    expect(acceptedDriftFor(skill, { other: ["x"] }, "/repo")).toEqual([]);
  });
});
