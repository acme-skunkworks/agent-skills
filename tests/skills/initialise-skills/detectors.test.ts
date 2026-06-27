import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`). The two boolean
// detectors return repo-independent constants, so a dummy repoRoot is fine —
// they never touch the filesystem. Regression cover for A-459: before this,
// triage-pr's `promoteOnGreen` / `replyOnAccept` had no detector and were
// reported `needs-manual-input` on every `initialise-skills` run.
import { createDetectors } from "../../../skills/initialise-skills/scripts/lib/detectors.mjs";

const detectorsFor = () => createDetectors({ repoRoot: "/nonexistent" });

describe("createDetectors — triage-pr boolean defaults", () => {
  it("infers promoteOnGreen=false (auto-promotion is opt-in)", () => {
    const { detect, has } = detectorsFor();
    expect(has("promoteOnGreen")).toBe(true);
    expect(detect("promoteOnGreen")).toEqual({ value: false });
  });

  it("infers replyOnAccept=true (matches triage-pr's own default)", () => {
    const { detect, has } = detectorsFor();
    expect(has("replyOnAccept")).toBe(true);
    expect(detect("replyOnAccept")).toEqual({ value: true });
  });

  it("never returns null for either key (so neither flags needs-manual-input)", () => {
    const { detect } = detectorsFor();
    expect(detect("promoteOnGreen")).not.toBeNull();
    expect(detect("replyOnAccept")).not.toBeNull();
  });
});

// Regression cover for A-460: packageRoots must signal "couldn't detect" (null)
// when there's no workspace manifest and none of the default candidates exist,
// rather than reporting a fabricated `["apps","packages","services"]`.
describe("createDetectors — packageRoots", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "detectors-roots-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when no manifest and no default candidate exists on disk", () => {
    const { detect } = createDetectors({ repoRoot: dir });
    expect(detect("packageRoots")).toBeNull();
  });

  it("returns the declared roots when a pnpm workspace is present", () => {
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');
    const { detect } = createDetectors({ repoRoot: dir });
    expect(detect("packageRoots")).toEqual({ value: ["apps"] });
  });

  it("does not throw deriving shippablePaths when packageRoots is null", () => {
    // No package.json `files`, no manifest → packageRoots is null; shippablePaths
    // must null-guard rather than dereference `.value` on null.
    const { detect } = createDetectors({ repoRoot: dir });
    expect(() => detect("shippablePaths")).not.toThrow();
    expect(detect("shippablePaths")).toEqual({ value: [] });
  });
});
