// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure
// diff transforms of check-updates (A-616): semver-core comparison and the
// lock-vs-target classification. main()/git I/O stay behind the isCliEntry() guard,
// so importing here runs nothing.
import {
  compareVersions,
  diffLock,
} from "../../../skills/initialise-skills/scripts/check-updates.mjs";
import { describe, expect, it } from "vitest";

describe("compareVersions", () => {
  it("classifies forward bumps by the first differing component", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe("patch");
    expect(compareVersions("1.0.0", "1.3.0")).toBe("minor");
    expect(compareVersions("1.0.0", "2.0.0")).toBe("major");
  });

  it("is 'none' for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe("none");
  });

  it("compares on the release core, ignoring pre-release/build metadata", () => {
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBe("none");
    expect(compareVersions("1.0.0", "1.1.0+build.5")).toBe("minor");
  });

  it("reports a downgrade when the target is older", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe("downgrade");
    expect(compareVersions("1.2.0", "1.1.0")).toBe("downgrade");
  });

  it("is 'unknown' when either side is null or not semver", () => {
    expect(compareVersions(null, "1.0.0")).toBe("unknown");
    expect(compareVersions("1.0.0", null)).toBe("unknown");
    expect(compareVersions("1.0", "1.0.0")).toBe("unknown");
    expect(compareVersions("x", "1.0.0")).toBe("unknown");
  });
});

describe("diffLock", () => {
  it("partitions skills into updates / upToDate / added / removed / downgrades / unknown", () => {
    const diff = diffLock(
      {
        ahead: "2.0.0", // consumer ahead → downgrade
        current: "1.0.0", // equal → upToDate
        gone: "1.0.0", // absent upstream → removed
        stale: "1.0.0", // behind → update (minor)
        weird: "1.0.0", // target unparseable → unknown
      },
      {
        ahead: "1.5.0",
        current: "1.0.0",
        fresh: "0.1.0", // upstream-only → added
        stale: "1.4.0",
        weird: "not-semver",
      },
    );

    expect(diff.updates).toEqual([
      { bump: "minor", from: "1.0.0", name: "stale", to: "1.4.0" },
    ]);
    expect(diff.upToDate).toEqual(["current"]);
    expect(diff.added).toEqual([{ name: "fresh", version: "0.1.0" }]);
    expect(diff.removed).toEqual(["gone"]);
    expect(diff.downgrades).toEqual([
      { from: "2.0.0", name: "ahead", to: "1.5.0" },
    ]);
    expect(diff.unknown).toEqual([
      { from: "1.0.0", name: "weird", to: "not-semver" },
    ]);
  });

  it("returns empty partitions when lock and target match exactly", () => {
    const same = { a: "1.0.0", b: "2.3.4" };
    const diff = diffLock(same, same);
    expect(diff.updates).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.upToDate).toEqual(["a", "b"]);
  });

  it("sorts each partition by name", () => {
    // Reversed insertion order (via fromEntries, which escapes the sort-objects
    // lint rule) so the assertion proves diffLock sorts its output.
    const diff = diffLock(
      Object.fromEntries([
        ["zed", "1.0.0"],
        ["abe", "1.0.0"],
      ]),
      Object.fromEntries([
        ["zed", "1.1.0"],
        ["abe", "1.1.0"],
      ]),
    );
    expect(diff.updates.map((update: { name: string }) => update.name)).toEqual(
      ["abe", "zed"],
    );
  });
});
