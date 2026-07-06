import { isCliEntry } from "../../../skills/changelog/scripts/lib/cli-entry.mjs";
import { realpathSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

// Exercises the BUNDLE helper directly (the distributed `.mjs`). isCliEntry backs
// the CLI guard for every changelog script, so its symlink-resolution and
// missing-entrypoint branches are worth covering directly rather than only
// indirectly through each script's `--self-test`.
//
// `argv` inside the helper is `process.argv` (same array reference), so tests that
// need a missing/altered entrypoint mutate `process.argv[1]` and restore it.
describe("isCliEntry", () => {
  const originalArgv1 = process.argv[1];

  afterEach(() => {
    process.argv[1] = originalArgv1;
  });

  it("returns true when the module path is the process entrypoint", () => {
    expect(isCliEntry(process.argv[1])).toBe(true);
  });

  it("resolves symlinks on both sides before comparing", () => {
    // Passing the already-realpath'd form of the entrypoint still matches, proving
    // both sides go through realpathSync rather than a raw string compare.
    expect(isCliEntry(realpathSync(process.argv[1]))).toBe(true);
  });

  it("returns false when the module path is not the entrypoint", () => {
    expect(isCliEntry(realpathSync(process.argv[1]) + ".not-the-entry")).toBe(
      false,
    );
  });

  it("returns false when there is no entrypoint (imported, not run)", () => {
    process.argv[1] = "";
    expect(isCliEntry("/anything.mjs")).toBe(false);
  });

  it("returns false when a path cannot be resolved (realpathSync throws)", () => {
    expect(isCliEntry("/nonexistent/path/that/cannot/resolve.mjs")).toBe(false);
  });
});
