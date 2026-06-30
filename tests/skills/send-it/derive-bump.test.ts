import {
  deriveBody,
  deriveBump,
  deriveCategory,
  deriveSlug,
  deriveType,
} from "../../../skills/send-it/scripts/derive-bump.mjs";
import { describe, expect, it } from "vitest";

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
        { body: "BREAKING CHANGE: removes Y", subject: "feat: add x" },
      ]),
    ).toBe("major");
  });

  it("is major on a bang in a conventional-commit subject", () => {
    expect(
      deriveBump([{ body: "", subject: "refactor!: drop legacy API" }]),
    ).toBe("major");
  });

  it("is minor when the first commit is a feat", () => {
    expect(
      deriveBump([
        { body: "", subject: "feat: add new export" },
        { body: "", subject: "fix: typo" },
      ]),
    ).toBe("minor");
  });

  it("is patch when the first commit is a fix even if a later commit is a feat", () => {
    // Documents an intentional asymmetry in deriveBump: only commits[0] is
    // checked for `feat:`, while breaking-change detection scans all commits.
    // The send-it heuristic treats the lead commit as the release intent.
    expect(
      deriveBump([
        { body: "", subject: "fix: stabilise" },
        { body: "", subject: "feat: new export" },
      ]),
    ).toBe("patch");
  });

  it("is minor on a scoped feat", () => {
    expect(deriveBump([{ body: "", subject: "feat(react): add hook" }])).toBe(
      "minor",
    );
  });

  it("is patch on a fix", () => {
    expect(deriveBump([{ body: "", subject: "fix: handle nullable" }])).toBe(
      "patch",
    );
  });

  it("is patch on a docs commit", () => {
    expect(deriveBump([{ body: "", subject: "docs: update readme" }])).toBe(
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
      deriveBody([{ body: "", subject: "feat(react): add useToast" }]),
    ).toBe("add useToast");
  });

  it("strips the bang variant", () => {
    expect(
      deriveBody([{ body: "", subject: "feat!: remove legacy API" }]),
    ).toBe("remove legacy API");
  });

  it("returns an empty string when there are no commits", () => {
    expect(deriveBody([])).toBe("");
  });
});

describe("deriveType", () => {
  it("reads the conventional type, scoped or not", () => {
    expect(deriveType("feat: add x")).toBe("feat");
    expect(deriveType("fix(scope): y")).toBe("fix");
    expect(deriveType("perf!: z")).toBe("perf");
    expect(deriveType("docs: readme")).toBe("docs");
  });

  it("folds a non-conventional subject to chore", () => {
    expect(deriveType("WIP random subject")).toBe("chore");
  });
});

describe("deriveCategory (A-598 — release-type by semantic category, not path)", () => {
  it("treats feat as a release with the feature category", () => {
    expect(deriveCategory([{ body: "", subject: "feat: add export" }])).toEqual(
      {
        breaking: false,
        category: "feature",
        releaseTriggering: true,
        type: "feat",
      },
    );
  });

  it("treats fix and perf as releases (patch category)", () => {
    expect(
      deriveCategory([{ body: "", subject: "fix: handle null" }]),
    ).toMatchObject({ category: "fix", releaseTriggering: true, type: "fix" });
    expect(
      deriveCategory([{ body: "", subject: "perf: cache lookups" }]),
    ).toMatchObject({
      category: "perf",
      releaseTriggering: true,
      type: "perf",
    });
  });

  it("does NOT release on docs/refactor/chore, even though they may touch a shippable path", () => {
    expect(
      deriveCategory([{ body: "", subject: "docs: rewrite SKILL.md" }]),
    ).toMatchObject({
      category: "docs",
      releaseTriggering: false,
      type: "docs",
    });
    expect(
      deriveCategory([{ body: "", subject: "refactor: extract helper" }]),
    ).toMatchObject({ category: "refactor", releaseTriggering: false });
    expect(
      deriveCategory([{ body: "", subject: "chore: bump dep" }]),
    ).toMatchObject({ category: "chore", releaseTriggering: false });
  });

  it("folds ci/build/test/style into the chore category, no release", () => {
    for (const type of ["ci", "build", "test", "style"]) {
      expect(
        deriveCategory([{ body: "", subject: `${type}: tweak` }]),
      ).toMatchObject({ category: "chore", releaseTriggering: false, type });
    }
  });

  it("is a breaking release on a bang or BREAKING CHANGE trailer, regardless of type", () => {
    expect(
      deriveCategory([{ body: "", subject: "feat!: drop legacy" }]),
    ).toMatchObject({ breaking: true, releaseTriggering: true, type: "feat" });
    // A `!` makes even a refactor a (major) release per release-please.
    expect(
      deriveCategory([{ body: "", subject: "refactor!: rip out API" }]),
    ).toMatchObject({
      breaking: true,
      category: "refactor",
      releaseTriggering: true,
    });
    expect(
      deriveCategory([
        { body: "BREAKING CHANGE: removes Y", subject: "fix: patch" },
      ]),
    ).toMatchObject({ breaking: true, releaseTriggering: true });
  });

  it("keys the type/category off the lead commit (mirrors deriveBump/deriveBody)", () => {
    expect(
      deriveCategory([
        { body: "", subject: "docs: notes" },
        { body: "", subject: "feat: later feature" },
      ]),
    ).toMatchObject({ category: "docs", releaseTriggering: false });
  });

  it("defaults to a non-release chore for an empty branch", () => {
    expect(deriveCategory([])).toEqual({
      breaking: false,
      category: "chore",
      releaseTriggering: false,
      type: "chore",
    });
  });

  it("folds a type colliding with an inherited Object key to chore (no prototype leak)", () => {
    // `CATEGORY_BY_TYPE["constructor"]` resolves to Object.prototype.constructor
    // on a plain object; the Object.hasOwn guard must return "chore" instead.
    // (deriveType lower-cases, so `constructor` is the real all-lowercase
    // collision — `toString` becomes the harmless `tostring`.)
    expect(deriveCategory([{ body: "", subject: "constructor: x" }])).toEqual({
      breaking: false,
      category: "chore",
      releaseTriggering: false,
      type: "constructor",
    });
  });
});
