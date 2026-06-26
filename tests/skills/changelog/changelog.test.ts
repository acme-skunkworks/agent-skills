import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`). The parse-error
// context path (a malformed entry naming the offending file) is covered against
// the bundle in infrastructure/tests/changelog-frontmatter.test.ts; this suite
// covers the happy-path lookup behaviour of findEntryByBranch.
import { findEntryByBranch } from "../../../skills/changelog/scripts/lib/changelog.mjs";

describe("findEntryByBranch — happy paths", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "changelog-find-happy-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the path of the entry whose branch matches", () => {
    const a = join(dir, "20260101-000000-alpha.md");
    const b = join(dir, "20260102-000000-beta.md");
    writeFileSync(a, "---\nbranch: feature-alpha\n---\nbody\n");
    writeFileSync(b, "---\nbranch: feature-beta\n---\nbody\n");
    expect(findEntryByBranch("feature-beta", dir)).toBe(b);
    expect(findEntryByBranch("feature-alpha", dir)).toBe(a);
  });

  it("returns null when no entry matches the branch", () => {
    writeFileSync(
      join(dir, "20260101-000000-alpha.md"),
      "---\nbranch: feature-alpha\n---\nbody\n",
    );
    expect(findEntryByBranch("nope", dir)).toBeNull();
  });

  it("ignores README.md and non-markdown files when scanning", () => {
    writeFileSync(join(dir, "README.md"), "---\nbranch: feature-alpha\n---\n");
    writeFileSync(join(dir, "notes.txt"), "branch: feature-alpha\n");
    // The only real entry is for a different branch.
    writeFileSync(
      join(dir, "20260101-000000-real.md"),
      "---\nbranch: real-branch\n---\nbody\n",
    );
    expect(findEntryByBranch("feature-alpha", dir)).toBeNull();
    expect(findEntryByBranch("real-branch", dir)).toBe(
      join(dir, "20260101-000000-real.md"),
    );
  });

  it("returns null for an empty changelog directory", () => {
    expect(findEntryByBranch("anything", dir)).toBeNull();
  });

  it("returns null when the changelog directory does not exist", () => {
    const missing = join(dir, "does-not-exist");
    expect(findEntryByBranch("anything", missing)).toBeNull();
  });
});
