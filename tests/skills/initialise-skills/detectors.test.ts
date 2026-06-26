import { describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`). The two boolean
// detectors return repo-independent constants, so a dummy repoRoot is fine —
// they never touch the filesystem. Regression cover for SK-459: before this,
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
