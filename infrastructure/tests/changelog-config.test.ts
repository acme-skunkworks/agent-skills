import { describe, expect, it } from "vitest";

// Imports the BUNDLE loader directly (the distributed `.mjs`). `parseConfig` is
// exported so the fail-loud contract is testable without filesystem setup.
import { parseConfig } from "../../skills/changelog/scripts/lib/config.mjs";

const VALID = {
  issueKeys: ["ASW"],
  linearWorkspaceSlug: "goose-and-hobbes",
};

const raw = (obj: unknown) => JSON.stringify(obj);

describe("parseConfig", () => {
  it("merges structural defaults over a minimal valid config", () => {
    expect(parseConfig(raw(VALID))).toEqual({
      issueKeys: ["ASW"],
      linearWorkspaceSlug: "goose-and-hobbes",
      baseBranch: "main",
      changelogDir: "changelog",
      packageRoots: ["apps", "packages", "services"],
      fallbackPackage: "infrastructure",
    });
  });

  it("lets config override the structural defaults", () => {
    const out = parseConfig(
      raw({ ...VALID, changelogDir: "history", packageRoots: ["modules"] }),
    );
    expect(out.changelogDir).toBe("history");
    expect(out.packageRoots).toEqual(["modules"]);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseConfig("{ not json")).toThrow();
  });

  it("fails loudly when issueKeys is missing", () => {
    expect(() => parseConfig(raw({ linearWorkspaceSlug: "x" }))).toThrow(
      /issueKeys/,
    );
  });

  it("fails loudly on an empty issueKeys array", () => {
    expect(() =>
      parseConfig(raw({ ...VALID, issueKeys: [] })),
    ).toThrow(/issueKeys/);
  });

  it("fails loudly when issueKeys contains a non-string", () => {
    expect(() =>
      parseConfig(raw({ ...VALID, issueKeys: ["ASW", 7] })),
    ).toThrow(/issueKeys/);
  });

  it("fails loudly when linearWorkspaceSlug is missing or empty", () => {
    expect(() => parseConfig(raw({ issueKeys: ["ASW"] }))).toThrow(
      /linearWorkspaceSlug/,
    );
    expect(() =>
      parseConfig(raw({ ...VALID, linearWorkspaceSlug: "" })),
    ).toThrow(/linearWorkspaceSlug/);
  });

  it("fails loudly on a mistyped structural key (packageRoots as string)", () => {
    expect(() =>
      parseConfig(raw({ ...VALID, packageRoots: "apps" })),
    ).toThrow(/packageRoots/);
  });

  it("fails loudly on a mistyped baseBranch", () => {
    expect(() =>
      parseConfig(raw({ ...VALID, baseBranch: 3 })),
    ).toThrow(/baseBranch/);
  });

  it("includes an actionable hint pointing at the config source", () => {
    expect(() => parseConfig(raw({}), "/some/path/config.json")).toThrow(
      /\/some\/path\/config\.json/,
    );
  });
});
