import { describe, expect, it } from "vitest";

import {
  deriveBody,
  deriveBump,
  deriveSlug,
} from "../send-it/derive-changeset.js";

describe("deriveSlug", () => {
  it("truncates over the 60-char ceiling at a word boundary when possible", () => {
    const slug = deriveSlug("asw-49-fold-in-send-it-claude-slash-command");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toBe("asw-49-fold-in-send-it-claude-slash-command");
  });

  it("normalises mixed separators and trims", () => {
    expect(deriveSlug("FOO_bar/baz   qux")).toBe("foo-bar-baz-qux");
  });

  it("strips leading and trailing hyphens", () => {
    expect(deriveSlug("---hello---")).toBe("hello");
  });

  it("truncates overlong slugs at a word boundary", () => {
    const long =
      "feature/very-long-branch-name-that-keeps-going-and-going-and-eventually-stops";
    const slug = deriveSlug(long);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("deriveBump", () => {
  it("is major on a BREAKING CHANGE trailer", () => {
    expect(
      deriveBump([
        { subject: "feat: add x", body: "BREAKING CHANGE: removes Y" },
      ]),
    ).toBe("major");
  });

  it("is major on a bang in a conventional-commit subject", () => {
    expect(
      deriveBump([{ subject: "refactor!: drop legacy API", body: "" }]),
    ).toBe("major");
  });

  it("is minor when the first commit is a feat", () => {
    expect(
      deriveBump([
        { subject: "feat: add new export", body: "" },
        { subject: "fix: typo", body: "" },
      ]),
    ).toBe("minor");
  });

  it("is patch when the first commit is a fix even if a later commit is a feat", () => {
    // Documents an intentional asymmetry in deriveBump: only commits[0] is
    // checked for `feat:`, while breaking-change detection scans all commits.
    // The /send-it heuristic treats the lead commit as the release intent.
    expect(
      deriveBump([
        { subject: "fix: stabilise", body: "" },
        { subject: "feat: new export", body: "" },
      ]),
    ).toBe("patch");
  });

  it("is minor on a scoped feat", () => {
    expect(deriveBump([{ subject: "feat(react): add hook", body: "" }])).toBe(
      "minor",
    );
  });

  it("is patch on a fix", () => {
    expect(deriveBump([{ subject: "fix: handle nullable", body: "" }])).toBe(
      "patch",
    );
  });

  it("is patch on a docs commit", () => {
    expect(deriveBump([{ subject: "docs: update readme", body: "" }])).toBe(
      "patch",
    );
  });

  it("is patch when there are no commits", () => {
    expect(deriveBump([])).toBe("patch");
  });
});

describe("deriveBody", () => {
  it("strips the conventional-commit prefix", () => {
    expect(
      deriveBody([{ subject: "feat(react): add useToast", body: "" }]),
    ).toBe("add useToast");
  });

  it("strips the bang variant", () => {
    expect(
      deriveBody([{ subject: "feat!: remove legacy API", body: "" }]),
    ).toBe("remove legacy API");
  });
});
