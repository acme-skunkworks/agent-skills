import { createDetectors } from "../../skills/initialise-skills/scripts/lib/detectors.mjs";
import { parseIssueKeysFromBranches } from "../../skills/initialise-skills/scripts/lib/git.mjs";
import {
  globsFromWorkspacesField,
  parseWorkspaceGlobs,
  rootsFromGlobs,
} from "../../skills/initialise-skills/scripts/lib/workspace.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("parseIssueKeysFromBranches", () => {
  it("extracts and uppercases leading issue keys, de-duplicated and sorted", () => {
    expect(
      parseIssueKeysFromBranches([
        "asw-12-foo",
        "SK-3-bar",
        "asw-99-baz",
        "feature/x",
      ]),
    ).toEqual(["ASW", "SK"]);
  });

  it("ignores branches without a leading <KEY>-<num> and single-letter prefixes", () => {
    expect(parseIssueKeysFromBranches(["main", "v1-release", "x-1-y"])).toEqual(
      [],
    );
  });

  it("returns [] for an empty branch list", () => {
    expect(parseIssueKeysFromBranches([])).toEqual([]);
  });
});

describe("parseWorkspaceGlobs / rootsFromGlobs", () => {
  it("reads the packages: block from pnpm-workspace.yaml and reduces to roots", () => {
    const yaml = [
      "packages:",
      "  - 'apps/*'",
      "  - 'packages/*'",
      "  - services/api",
      "other: 1",
    ].join("\n");
    expect(parseWorkspaceGlobs(yaml)).toEqual([
      "apps/*",
      "packages/*",
      "services/api",
    ]);
    expect(rootsFromGlobs(parseWorkspaceGlobs(yaml))).toEqual([
      "apps",
      "packages",
      "services",
    ]);
  });

  it("ignores '.', '*' and de-duplicates roots", () => {
    expect(rootsFromGlobs(["packages/ui", "packages/core", ".", "*"])).toEqual([
      "packages",
    ]);
  });

  it("ignores negated pnpm exclude globs", () => {
    expect(
      rootsFromGlobs(["!packages/private/*", "apps/*", "packages/*"]),
    ).toEqual(["apps", "packages"]);
  });

  it("returns [] when there is no packages: block", () => {
    expect(parseWorkspaceGlobs("name: thing\nversion: 1")).toEqual([]);
  });

  it("keeps tab-indented list items inside the packages: block", () => {
    const yaml = [
      "packages:",
      "\t- 'apps/*'",
      "\t- 'packages/*'",
      "other: 1",
    ].join("\n");
    expect(parseWorkspaceGlobs(yaml)).toEqual(["apps/*", "packages/*"]);
  });
});

describe("changelog detector", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "init-detect-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("is true when the changelog skill is installed alongside", () => {
    const { detect } = createDetectors({
      installedSkills: new Set(["changelog", "send-it"]),
      repoRoot,
    });
    expect(detect("changelog")).toEqual({ value: true });
  });

  it("is true when a changelog/ directory exists even with no changelog skill", () => {
    mkdirSync(join(repoRoot, "changelog"));
    const { detect } = createDetectors({
      installedSkills: new Set(["send-it"]),
      repoRoot,
    });
    expect(detect("changelog")).toEqual({ value: true });
  });

  it("is false when the repo has neither a changelog skill nor a changelog/ dir", () => {
    const { detect } = createDetectors({
      installedSkills: new Set(["preflight", "send-it"]),
      repoRoot,
    });
    expect(detect("changelog")).toEqual({ value: false });
  });

  it("is false when 'changelog' is a plain file rather than a directory", () => {
    writeFileSync(join(repoRoot, "changelog"), "not a dir\n");
    const { detect } = createDetectors({
      installedSkills: new Set(["send-it"]),
      repoRoot,
    });
    expect(detect("changelog")).toEqual({ value: false });
  });
});

describe("mainBranch detector", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "init-detect-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("mirrors the detected base branch (falls back to main with no git)", () => {
    const { detect } = createDetectors({ repoRoot });
    expect(detect("mainBranch")).toEqual(detect("baseBranch"));
    expect(detect("mainBranch")).toEqual({ value: "main" });
  });
});

describe("globsFromWorkspacesField", () => {
  it("accepts an array form", () => {
    expect(globsFromWorkspacesField(["apps/*", "libs/*"])).toEqual([
      "apps/*",
      "libs/*",
    ]);
  });

  it("accepts the { packages: [...] } object form", () => {
    expect(globsFromWorkspacesField({ packages: ["pkgs/*"] })).toEqual([
      "pkgs/*",
    ]);
  });

  it("returns [] for anything else", () => {
    expect(globsFromWorkspacesField(undefined)).toEqual([]);
    expect(globsFromWorkspacesField("apps/*")).toEqual([]);
  });
});
