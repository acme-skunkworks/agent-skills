import {
  classifyBundles,
  collectTouchedSkills,
  incrementVersion,
} from "../../skills/send-it/scripts/check-skill-bumps.mjs";
import { describe, expect, it } from "vitest";

// `paths` stub mirrors main()'s closure shape for the classify tests.
function paths(name: string): { manifestPath: string; skillPath: string } {
  return {
    manifestPath: `skills/${name}/package.json`,
    skillPath: `skills/${name}/SKILL.md`,
  };
}

describe("collectTouchedSkills", () => {
  it("picks up skills with a changed file inside the bundle dir", () => {
    expect(
      collectTouchedSkills(
        ["skills/send-it/SKILL.md", "skills/preflight/scripts/preflight.mjs"],
        "skills",
      ),
    ).toEqual(["preflight", "send-it"]);
  });

  it("dedupes multiple changed files in one bundle", () => {
    expect(
      collectTouchedSkills(
        ["skills/send-it/SKILL.md", "skills/send-it/package.json"],
        "skills",
      ),
    ).toEqual(["send-it"]);
  });

  it("ignores files outside the bundle root", () => {
    expect(
      collectTouchedSkills(
        [
          "CLAUDE.md",
          "infrastructure/scripts/validate-skills.ts",
          ".github/x.yml",
        ],
        "skills",
      ),
    ).toEqual([]);
  });

  it("ignores a loose file directly under the root (not inside a bundle)", () => {
    expect(collectTouchedSkills(["skills/README.md"], "skills")).toEqual([]);
  });

  it("tolerates a trailing slash on the configured root", () => {
    expect(
      collectTouchedSkills(["skills/send-it/SKILL.md"], "skills/"),
    ).toEqual(["send-it"]);
  });
});

describe("incrementVersion", () => {
  it("bumps patch", () => {
    expect(incrementVersion("0.1.0", "patch")).toBe("0.1.1");
  });

  it("bumps minor and zeroes patch", () => {
    expect(incrementVersion("0.1.4", "minor")).toBe("0.2.0");
  });

  it("bumps major and zeroes minor + patch", () => {
    expect(incrementVersion("1.4.2", "major")).toBe("2.0.0");
  });

  it("strips a pre-release/build suffix before bumping", () => {
    expect(incrementVersion("1.2.3-rc.1", "patch")).toBe("1.2.4");
    expect(incrementVersion("1.2.3+build.5", "minor")).toBe("1.3.0");
  });

  it("throws on a non-semver core", () => {
    expect(() => incrementVersion("1.2", "patch")).toThrow();
    expect(() => incrementVersion("x.y.z", "patch")).toThrow();
  });

  it("throws on an unknown bump level", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => incrementVersion("1.0.0", "nope")).toThrow();
  });
});

describe("classifyBundles", () => {
  it("flags a changed bundle whose version is unchanged from base", () => {
    const { bumped, unbumped } = classifyBundles(
      ["send-it"],
      { "send-it": { base: "0.1.0", current: "0.1.0" } },
      "minor",
      paths,
    );
    expect(bumped).toEqual([]);
    expect(unbumped).toEqual([
      {
        currentVersion: "0.1.0",
        manifestPath: "skills/send-it/package.json",
        name: "send-it",
        skillPath: "skills/send-it/SKILL.md",
        suggestedBump: "minor",
        suggestedVersion: "0.2.0",
      },
    ]);
  });

  it("treats a moved version as already bumped", () => {
    const { bumped, unbumped } = classifyBundles(
      ["send-it"],
      { "send-it": { base: "0.1.0", current: "0.2.0" } },
      "minor",
      paths,
    );
    expect(unbumped).toEqual([]);
    expect(bumped).toEqual(["send-it"]);
  });

  it("does not flag a newly-added bundle (no base manifest)", () => {
    const { bumped, unbumped } = classifyBundles(
      ["brand-new"],
      { "brand-new": { base: null, current: "0.1.0" } },
      "minor",
      paths,
    );
    expect(unbumped).toEqual([]);
    expect(bumped).toEqual(["brand-new"]);
  });

  it("skips a touched dir that is not a versioned bundle", () => {
    const { bumped, unbumped } = classifyBundles(
      ["not-a-skill"],
      { "not-a-skill": { base: null, current: null } },
      "patch",
      paths,
    );
    expect(unbumped).toEqual([]);
    expect(bumped).toEqual([]);
  });

  it("handles a mix across several bundles", () => {
    const { bumped, unbumped } = classifyBundles(
      ["changelog", "preflight", "send-it"],
      {
        changelog: { base: "1.0.0", current: "1.0.0" }, // unbumped
        preflight: { base: "0.3.0", current: "0.4.0" }, // bumped
        "send-it": { base: "0.1.0", current: "0.1.0" }, // unbumped
      },
      "patch",
      paths,
    );
    expect(bumped).toEqual(["preflight"]);
    expect(unbumped.map((entry) => entry.name)).toEqual([
      "changelog",
      "send-it",
    ]);
    expect(unbumped.map((entry) => entry.suggestedVersion)).toEqual([
      "1.0.1",
      "0.1.1",
    ]);
  });
});
