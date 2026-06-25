import { describe, expect, it } from "vitest";

import { parseIssueKeysFromBranches } from "../../skills/initialise-skills/scripts/lib/git.mjs";
import {
  globsFromWorkspacesField,
  parseWorkspaceGlobs,
  rootsFromGlobs,
} from "../../skills/initialise-skills/scripts/lib/workspace.mjs";

describe("parseIssueKeysFromBranches", () => {
  it("extracts and uppercases leading issue keys, de-duplicated and sorted", () => {
    expect(
      parseIssueKeysFromBranches(["asw-12-foo", "SK-3-bar", "asw-99-baz", "feature/x"]),
    ).toEqual(["ASW", "SK"]);
  });

  it("ignores branches without a leading <KEY>-<num> and single-letter prefixes", () => {
    expect(parseIssueKeysFromBranches(["main", "v1-release", "x-1-y"])).toEqual([]);
  });

  it("returns [] for an empty branch list", () => {
    expect(parseIssueKeysFromBranches([])).toEqual([]);
  });
});

describe("parseWorkspaceGlobs / rootsFromGlobs", () => {
  it("reads the packages: block from pnpm-workspace.yaml and reduces to roots", () => {
    const yaml = ["packages:", "  - 'apps/*'", "  - 'packages/*'", "  - services/api", "other: 1"].join("\n");
    expect(parseWorkspaceGlobs(yaml)).toEqual(["apps/*", "packages/*", "services/api"]);
    expect(rootsFromGlobs(parseWorkspaceGlobs(yaml))).toEqual(["apps", "packages", "services"]);
  });

  it("ignores '.', '*' and de-duplicates roots", () => {
    expect(rootsFromGlobs(["packages/ui", "packages/core", ".", "*"])).toEqual(["packages"]);
  });

  it("returns [] when there is no packages: block", () => {
    expect(parseWorkspaceGlobs("name: thing\nversion: 1")).toEqual([]);
  });
});

describe("globsFromWorkspacesField", () => {
  it("accepts an array form", () => {
    expect(globsFromWorkspacesField(["apps/*", "libs/*"])).toEqual(["apps/*", "libs/*"]);
  });

  it("accepts the { packages: [...] } object form", () => {
    expect(globsFromWorkspacesField({ packages: ["pkgs/*"] })).toEqual(["pkgs/*"]);
  });

  it("returns [] for anything else", () => {
    expect(globsFromWorkspacesField(undefined)).toEqual([]);
    expect(globsFromWorkspacesField("apps/*")).toEqual([]);
  });
});
