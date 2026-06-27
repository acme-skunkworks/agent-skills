import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`). Regression cover
// for SK-460: the fallback used to return a hard-coded `["apps","packages",
// "services"]` regardless of what existed on disk, so a repo with no workspace
// manifest "detected" three phantom roots.
import {
  detectPackageRoots,
  parseWorkspaceGlobs,
  rootsFromGlobs,
  globsFromWorkspacesField,
} from "../../../skills/initialise-skills/scripts/lib/workspace.mjs";

describe("detectPackageRoots", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "workspace-roots-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads roots from pnpm-workspace.yaml (authoritative — not filtered by disk)", () => {
    writeFileSync(
      join(dir, "pnpm-workspace.yaml"),
      'packages:\n  - "apps/*"\n  - "packages/*"\n',
    );
    // The globbed dirs don't exist on disk, but a declaration is authoritative.
    expect(detectPackageRoots(dir)).toEqual(["apps", "packages"]);
  });

  it("reads roots from the package.json workspaces field", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ workspaces: ["modules/*", "tooling/cli"] }),
    );
    expect(detectPackageRoots(dir)).toEqual(["modules", "tooling"]);
  });

  it("pnpm-workspace.yaml wins over the package.json workspaces field", () => {
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ workspaces: ["modules/*"] }),
    );
    expect(detectPackageRoots(dir)).toEqual(["apps"]);
  });

  it("falls back to the default candidates that actually exist on disk", () => {
    // No manifest; only one of the default candidates is present.
    mkdirSync(join(dir, "packages"));
    expect(detectPackageRoots(dir)).toEqual(["packages"]);
  });

  it("returns [] when there is no manifest and no default candidate on disk", () => {
    // The phantom-roots bug: this used to return ["apps","packages","services"].
    expect(detectPackageRoots(dir)).toEqual([]);
  });

  it("ignores a non-directory named like a default candidate", () => {
    // A regular file (or symlink) called `packages` must not leak in as a root —
    // the fallback is strictly directory-backed.
    writeFileSync(join(dir, "packages"), "not a directory\n");
    expect(detectPackageRoots(dir)).toEqual([]);
  });

  it("returns [] for a missing/empty repo root rather than guessing", () => {
    expect(detectPackageRoots(join(dir, "does-not-exist"))).toEqual([]);
  });
});

describe("workspace pure parsers", () => {
  it("parseWorkspaceGlobs reads the packages: block and stops at the next key", () => {
    const yaml = 'packages:\n  - "apps/*"\n  - packages/ui\nonlyBuiltDependencies:\n  - esbuild\n';
    expect(parseWorkspaceGlobs(yaml)).toEqual(["apps/*", "packages/ui"]);
  });

  it("rootsFromGlobs reduces globs to distinct top-level roots, skipping ., *, and negations", () => {
    expect(
      rootsFromGlobs(["apps/*", "packages/ui", ".", "*", "!packages/private/*"]),
    ).toEqual(["apps", "packages"]);
  });

  it("globsFromWorkspacesField accepts both array and { packages } shapes", () => {
    expect(globsFromWorkspacesField(["a/*", "b/*"])).toEqual(["a/*", "b/*"]);
    expect(globsFromWorkspacesField({ packages: ["c/*"] })).toEqual(["c/*"]);
    expect(globsFromWorkspacesField(undefined)).toEqual([]);
  });
});
