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
  it("infers promoteOnGreen=true (auto-promotion is the default-on opt-out model)", () => {
    const { detect, has } = detectorsFor();
    expect(has("promoteOnGreen")).toBe(true);
    expect(detect("promoteOnGreen")).toEqual({ value: true });
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

// A-567: triage-pr's opt-in follow-up capture keys are repo-independent
// structural defaults — they emit a value (never null) so they aren't flagged
// needs-manual-input, with empty label/project meaning "unset".
describe("createDetectors — triage-pr follow-up capture defaults", () => {
  it("infers empty followUpLabel / followUpProject and a Backlog state", () => {
    const { detect, has } = detectorsFor();
    expect(has("followUpLabel")).toBe(true);
    expect(detect("followUpLabel")).toEqual({ value: "" });
    expect(detect("followUpProject")).toEqual({ value: "" });
    expect(detect("followUpState")).toEqual({ value: "Backlog" });
  });

  it("never returns null for any of the three (so none flags needs-manual-input)", () => {
    const { detect } = detectorsFor();
    expect(detect("followUpLabel")).not.toBeNull();
    expect(detect("followUpProject")).not.toBeNull();
    expect(detect("followUpState")).not.toBeNull();
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

// A-461: affected_packages is monorepo-only. The detector mirrors the
// packageRoots workspace signal so single-package repos get `false` (field
// omitted) and genuine monorepos get `true`. It always emits a value (never
// null) so it is never flagged needs-manual-input.
describe("createDetectors — affectedPackages", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "detectors-affected-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("infers false when no workspace config is detected (single package)", () => {
    const { detect, has } = createDetectors({ repoRoot: dir });
    expect(has("affectedPackages")).toBe(true);
    expect(detect("affectedPackages")).toEqual({ value: false });
  });

  it("infers true when a pnpm workspace is present (monorepo)", () => {
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');
    const { detect } = createDetectors({ repoRoot: dir });
    expect(detect("affectedPackages")).toEqual({ value: true });
  });
});
