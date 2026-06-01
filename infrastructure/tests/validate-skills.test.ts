import { describe, expect, it } from "vitest";

import { validateSkill } from "../scripts/validate-skills.js";

const pkg = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({
    name: "@acme-skunkworks/skill-cleanup-repo",
    version: "0.1.0",
    private: true,
    ...over,
  });

// Build the SKILL.md frontmatter as explicit YAML so gray-matter parses it
// the same way it parses the real bundles.
const yamlSkill = (name: string, version: string | null): string => {
  const versionLine = version === null ? "" : `\n  version: ${version}`;
  return `---\nname: ${name}\nmetadata:${versionLine || "\n  other: x"}\n---\n\n# body\n`;
};

describe("validateSkill", () => {
  it("passes a well-formed bundle", () => {
    expect(
      validateSkill("cleanup-repo", pkg(), yamlSkill("cleanup-repo", "0.1.0")),
    ).toEqual([]);
  });

  it("flags a missing package.json", () => {
    const errors = validateSkill("cleanup-repo", null, yamlSkill("cleanup-repo", "0.1.0"));
    expect(errors.some((e) => e.includes("missing package.json"))).toBe(true);
  });

  it("flags a missing SKILL.md", () => {
    const errors = validateSkill("cleanup-repo", pkg(), null);
    expect(errors.some((e) => e.includes("missing SKILL.md"))).toBe(true);
  });

  it("rejects a name that doesn't match the dir + skill- prefix", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg({ name: "@acme-skunkworks/cleanup-repo" }),
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(errors.some((e) => e.includes("@acme-skunkworks/skill-cleanup-repo"))).toBe(true);
  });

  it("rejects private: false", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg({ private: false }),
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(errors.some((e) => e.includes("private"))).toBe(true);
  });

  it("rejects a non-semver version", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg({ version: "v1" }),
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(errors.some((e) => e.includes("semver"))).toBe(true);
  });

  it("flags a SKILL.md name that doesn't equal the dir", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg(),
      yamlSkill("wrong-name", "0.1.0"),
    );
    expect(errors.some((e) => e.includes("directory name"))).toBe(true);
  });

  it("flags metadata.version drift from package.json version", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg({ version: "0.2.0" }),
      yamlSkill("cleanup-repo", "0.1.0"),
    );
    expect(errors.some((e) => e.includes("must equal package.json version"))).toBe(true);
  });

  it("flags a missing metadata.version", () => {
    const errors = validateSkill(
      "cleanup-repo",
      pkg(),
      yamlSkill("cleanup-repo", null),
    );
    expect(errors.some((e) => e.includes("metadata.version is missing"))).toBe(true);
  });
});
