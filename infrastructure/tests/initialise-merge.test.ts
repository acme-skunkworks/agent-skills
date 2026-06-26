// Imports the BUNDLE module directly (the distributed `.mjs`).
import {
  classifyKey,
  deepEqual,
  mergeConfig,
  sameSet,
  valuesEqual,
} from "../../skills/initialise-skills/scripts/lib/merge.mjs";
import { describe, expect, it } from "vitest";

function detected(value: unknown): { value: unknown } {
  return { value };
}

describe("deepEqual", () => {
  it("compares primitives, arrays and nested objects", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "b")).toBe(false);
    expect(deepEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(deepEqual(["a", "b"], ["b", "a"])).toBe(false);
    // Intentionally different key orders — exercises deepEqual's
    // key-order-insensitive comparison (the meaningful case here).
    expect(
      deepEqual(
        { root: "skills", manifest: "package.json" },
        { manifest: "package.json", root: "skills" },
      ),
    ).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe("sameSet / valuesEqual", () => {
  it("treats issueKeys order-insensitively but other arrays order-sensitively", () => {
    expect(sameSet(["ASW", "SK"], ["SK", "ASW"])).toBe(true);
    expect(valuesEqual("issueKeys", ["ASW", "SK"], ["SK", "ASW"])).toBe(true);
    expect(
      valuesEqual("packageRoots", ["apps", "packages"], ["packages", "apps"]),
    ).toBe(false);
  });

  it("compares as true sets — duplicates don't mask a difference", () => {
    expect(sameSet(["ASW", "ASW"], ["ASW", "SK"])).toBe(false);
    expect(sameSet(["ASW", "SK"], ["SK", "ASW", "SK"])).toBe(true);
  });
});

describe("classifyKey", () => {
  it("inferred — missing value, detector available", () => {
    expect(
      classifyKey("baseBranch", "main", undefined, detected("develop")),
    ).toEqual({
      status: "inferred",
      write: "develop",
    });
  });

  it("needs-manual-input — missing value, no detector", () => {
    expect(classifyKey("linearTeamName", "Your Team", undefined, null)).toEqual(
      {
        status: "needs-manual-input",
      },
    );
  });

  it("unchanged — existing value equals detected", () => {
    expect(classifyKey("baseBranch", "main", "main", detected("main"))).toEqual(
      {
        status: "unchanged",
      },
    );
  });

  it("inferred — existing value is still the example placeholder, overwrite", () => {
    expect(
      classifyKey(
        "linearWorkspaceSlug",
        "your-workspace-slug",
        "your-workspace-slug",
        detected("goose-and-hobbes"),
      ),
    ).toEqual({ status: "inferred", write: "goose-and-hobbes" });
  });

  it("needs-manual-input — placeholder kept when no detector", () => {
    expect(
      classifyKey(
        "linearTeamName",
        "Your Linear Team",
        "Your Linear Team",
        null,
      ),
    ).toEqual({ keep: "Your Linear Team", status: "needs-manual-input" });
  });

  it("drift — deliberate edit differing from both example and detected", () => {
    expect(
      classifyKey("baseBranch", "main", "trunk", detected("main")),
    ).toEqual({
      detected: "main",
      keep: "trunk",
      status: "drift",
    });
  });

  it("manual-kept — real value, no detector", () => {
    expect(classifyKey("customKey", "placeholder", "real-value", null)).toEqual(
      {
        keep: "real-value",
        status: "manual-kept",
      },
    );
  });

  it("issueKeys reordered is unchanged, not drift", () => {
    expect(
      classifyKey("issueKeys", ["ABC"], ["SK", "ASW"], detected(["ASW", "SK"])),
    ).toEqual({ status: "unchanged" });
  });
});

// A `detect` factory for mergeConfig's tests. Module-scoped because it closes
// over nothing (unicorn/consistent-function-scoping).
function detect(facts: Record<string, unknown> = {}) {
  return (key: string) => {
    const table: Record<string, unknown> = {
      baseBranch: "main",
      issueKeys: ["ASW", "SK"],
      ...facts,
    };
    return key in table ? { value: table[key] } : null;
  };
}

describe("mergeConfig", () => {
  const example = {
    baseBranch: "main",
    issueKeys: ["ABC", "XYZ"],
    linearTeamName: "Your Linear Team",
  };

  it("fills inferred keys, keeps drift, flags manual input", () => {
    const config = {
      baseBranch: "trunk", // deliberate edit → drift
      issueKeys: ["ABC", "XYZ"], // placeholder → inferred
      // linearTeamName absent, no fact → needs-manual-input
    };
    const { changed, data, results } = mergeConfig({
      config,
      detect: detect(),
      example,
    });
    expect(results.baseBranch.status).toBe("drift");
    expect(results.issueKeys.status).toBe("inferred");
    expect(results.linearTeamName.status).toBe("needs-manual-input");
    expect(data.baseBranch).toBe("trunk"); // drift preserved
    expect(data.issueKeys).toEqual(["ASW", "SK"]);
    expect(changed).toBe(true);
  });

  it("injects Linear facts as the detected value", () => {
    const config = {};
    const { data, results } = mergeConfig({
      config,
      detect: detect({ linearTeamName: "ACME Skunkworks" }),
      example,
    });
    expect(results.linearTeamName.status).toBe("inferred");
    expect(data.linearTeamName).toBe("ACME Skunkworks");
  });

  it("acceptDrift overwrites a drifted key with the detected value", () => {
    const config = { baseBranch: "trunk" };
    const { data, results } = mergeConfig({
      acceptDrift: ["baseBranch"],
      config,
      detect: detect(),
      example,
    });
    expect(results.baseBranch.status).toBe("inferred");
    expect(data.baseBranch).toBe("main");
  });

  it("keeps a consumer-added unknown key untouched", () => {
    const config = { extraThing: 42 };
    const { data, results } = mergeConfig({
      config,
      detect: detect(),
      example,
    });
    expect(results.extraThing.status).toBe("unknown-kept");
    expect(data.extraThing).toBe(42);
  });

  it("is idempotent — a second merge writes nothing", () => {
    const config = {};
    const first = mergeConfig({
      config,
      detect: detect({ linearTeamName: "ACME" }),
      example,
    });
    expect(first.changed).toBe(true);
    const second = mergeConfig({
      config: first.data,
      detect: detect({ linearTeamName: "ACME" }),
      example,
    });
    expect(second.changed).toBe(false);
    expect(second.data).toEqual(first.data);
    for (const result of Object.values(second.results)) {
      expect(["unchanged", "unknown-kept", "manual-kept"]).toContain(
        result.status,
      );
    }
  });
});
