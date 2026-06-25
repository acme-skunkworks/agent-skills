import { describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`). `rewriteBody`
// reads the bundle's own config.json (workspace `goose-and-hobbes`, keys
// ASW/AKW/SKW/SK). Reference-style label masking is covered against the bundle
// in infrastructure/tests/add-links-reference-masking.test.ts; this suite
// covers the issue-key rewrite happy path plus inline-code / fenced-block
// masking and the splitFrontmatter contract.
import {
  rewriteBody,
  splitFrontmatter,
} from "../../../skills/changelog/scripts/add-links.mjs";

const url = (id: string) => `https://linear.app/goose-and-hobbes/issue/${id}`;

describe("rewriteBody — issue-key linking (happy path)", () => {
  it("links a bare issue ID for each configured team key", () => {
    expect(rewriteBody("Closes ASW-12.")).toBe(
      `Closes [ASW-12](${url("ASW-12")}).`,
    );
    expect(rewriteBody("Closes AKW-3.")).toBe(
      `Closes [AKW-3](${url("AKW-3")}).`,
    );
    expect(rewriteBody("Closes SKW-9.")).toBe(
      `Closes [SKW-9](${url("SKW-9")}).`,
    );
    expect(rewriteBody("Closes SK-401.")).toBe(
      `Closes [SK-401](${url("SK-401")}).`,
    );
  });

  it("links several IDs in one body", () => {
    expect(rewriteBody("ASW-1 and SK-2 both landed.")).toBe(
      `[ASW-1](${url("ASW-1")}) and [SK-2](${url("SK-2")}) both landed.`,
    );
  });

  it("leaves unknown team keys untouched", () => {
    const body = "ZZ-9 is not a configured key.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("is idempotent — a second pass does not double-link", () => {
    const once = rewriteBody("Closes ASW-12.");
    expect(rewriteBody(once)).toBe(once);
  });
});

describe("rewriteBody — masking", () => {
  it("does not link an ID inside inline code", () => {
    const body = "Run `validate ASW-12` before merge.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("does not link an ID inside a fenced code block", () => {
    const body = "```\nbranch ASW-12 created\n```\n";
    expect(rewriteBody(body)).toBe(body);
  });

  it("does not re-link an already-linked inline ID", () => {
    const body = `See [ASW-12](${url("ASW-12")}) for detail.`;
    expect(rewriteBody(body)).toBe(body);
  });

  it("links a bare ID whilst leaving a fenced/inline-code occurrence masked", () => {
    const body = "Closes ASW-12; see `ASW-12` and:\n```\nASW-12\n```\n";
    expect(rewriteBody(body)).toBe(
      `Closes [ASW-12](${url("ASW-12")}); see \`ASW-12\` and:\n` +
        "```\nASW-12\n```\n",
    );
  });
});

describe("splitFrontmatter", () => {
  it("splits leading frontmatter from the body", () => {
    const raw = "---\ntitle: x\n---\n## Added\n\n- A change\n";
    expect(splitFrontmatter(raw)).toEqual({
      fm: "---\ntitle: x\n---\n",
      body: "## Added\n\n- A change\n",
    });
  });

  it("returns the whole string as body when there is no frontmatter", () => {
    const raw = "## Added\n\n- A change\n";
    expect(splitFrontmatter(raw)).toEqual({ fm: "", body: raw });
  });
});
