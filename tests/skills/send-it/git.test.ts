// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure,
// git-free base-ref candidate logic (A-532): derive-bump / check-skill-bumps must
// honour config.json's baseBranch, not the hardcoded origin/main → main chain, so a
// consumer whose trunk is `develop` diffs against the right base. The git-backed
// resolveBaseRef itself needs a live repo and is exercised by the skill end-to-end.
import { baseRefCandidates } from "../../../skills/send-it/scripts/lib/git.mjs";
import { describe, expect, it } from "vitest";

describe("baseRefCandidates", () => {
  it("collapses to the original chain when baseBranch is main", () => {
    expect(baseRefCandidates("main", undefined)).toEqual([
      "origin/main",
      "main",
    ]);
  });

  it("probes the configured trunk before the origin/main fallback", () => {
    expect(baseRefCandidates("develop", undefined)).toEqual([
      "origin/develop",
      "develop",
      "origin/main",
      "main",
    ]);
  });

  it("puts BASE_REF first as a per-run override", () => {
    expect(baseRefCandidates("develop", "upstream/release")).toEqual([
      "upstream/release",
      "origin/develop",
      "develop",
      "origin/main",
      "main",
    ]);
  });

  it("de-duplicates when BASE_REF already names a default candidate", () => {
    expect(baseRefCandidates("main", "origin/main")).toEqual([
      "origin/main",
      "main",
    ]);
  });

  it("falls back to main for an empty or blank baseBranch", () => {
    expect(baseRefCandidates("", undefined)).toEqual(["origin/main", "main"]);
    expect(baseRefCandidates("   ", undefined)).toEqual([
      "origin/main",
      "main",
    ]);
  });
});
