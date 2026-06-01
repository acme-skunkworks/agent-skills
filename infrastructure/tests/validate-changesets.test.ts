import { describe, expect, it } from "vitest";

import {
  ROOT_PACKAGE,
  validateEntry,
} from "../scripts/validate-changesets.js";

const root = (bump: string): string => `---
"${ROOT_PACKAGE}": ${bump}
---

A change.
`;

describe("validateEntry", () => {
  it("passes a root-named changeset", () => {
    expect(validateEntry("asw-1-foo.md", root("minor"))).toEqual([]);
  });

  it("passes an empty-frontmatter (docs-only) changeset", () => {
    const raw = `---
---

Docs-only change, no bump.
`;
    expect(validateEntry("asw-2-docs.md", raw)).toEqual([]);
  });

  it("fails a skill-named changeset with a clear message", () => {
    const raw = `---
"@acme-skunkworks/skill-cleanup-repo": minor
---

Bumps a skill that Changesets cannot see.
`;
    const errors = validateEntry("asw-3-skill.md", raw);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("@acme-skunkworks/skill-cleanup-repo");
    expect(errors[0]).toContain(ROOT_PACKAGE);
  });

  it("flags the offending package when root and a skill are mixed", () => {
    const raw = `---
"${ROOT_PACKAGE}": minor
"@acme-skunkworks/skill-changelog": patch
---

Mixed entry.
`;
    const errors = validateEntry("asw-4-mixed.md", raw);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("@acme-skunkworks/skill-changelog");
  });

  it("rejects an invalid bump level", () => {
    const errors = validateEntry("asw-5-badbump.md", root("massive"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("bump");
  });
});
