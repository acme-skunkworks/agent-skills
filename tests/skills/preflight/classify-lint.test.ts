import { parseMarkdownlintText } from "../../../skills/preflight/scripts/classify-lint.mjs";
import { describe, expect, it } from "vitest";

// Real markdownlint-cli2 v0.22.1 default output (the format preflight parses).
// Banner lines are interleaved with the violation lines and must be ignored.
const SAMPLE = `markdownlint-cli2 v0.22.1 (markdownlint v0.40.0)
Finding: bad.md
Linting: 1 file(s)
Summary: 4 error(s)
bad.md:1 error MD022/blanks-around-headings Headings should be surrounded by blank lines [Expected: 1; Actual: 0; Below] [Context: "# Title"]
bad.md:3 error MD022/blanks-around-headings Headings should be surrounded by blank lines [Expected: 1; Actual: 0; Above] [Context: "## Heading"]
bad.md:4:81 error MD013/line-length Line length [Expected: 80; Actual: 132]`;

describe("parseMarkdownlintText", () => {
  it("parses real markdownlint-cli2 default output and ignores banner lines", () => {
    const violations = parseMarkdownlintText(SAMPLE);
    expect(violations).toHaveLength(3);
    // None of `markdownlint-cli2 vX`, `Finding:`, `Linting:`, `Summary:` parsed.
    expect(
      violations.every((violation) => violation.source === "markdownlint"),
    ).toBe(true);
  });

  it("captures file, line, rule and message for a column-less violation", () => {
    const [first] = parseMarkdownlintText(SAMPLE);
    expect(first).toMatchObject({
      file: "bad.md",
      line: 1,
      ruleId: "MD022/blanks-around-headings",
      source: "markdownlint",
    });
    expect(first.message).toMatch(/^Headings should be surrounded/);
    expect(first.column).toBeUndefined();
  });

  it("captures the column when present", () => {
    const md013 = parseMarkdownlintText(SAMPLE).find(
      (violation) => violation.ruleId === "MD013/line-length",
    );
    expect(md013).toMatchObject({
      column: 81,
      file: "bad.md",
      line: 4,
      message: "Line length [Expected: 80; Actual: 132]",
    });
  });

  it("tolerates output without the severity token (older markdownlint-cli2)", () => {
    const violations = parseMarkdownlintText(
      "README.md:4:81 MD013/line-length Line length [Expected: 80; Actual: 90]",
    );
    expect(violations).toEqual([
      {
        column: 81,
        file: "README.md",
        line: 4,
        message: "Line length [Expected: 80; Actual: 90]",
        ruleId: "MD013/line-length",
        source: "markdownlint",
      },
    ]);
  });

  it("returns [] for empty / whitespace / banner-only output (a clean pass)", () => {
    expect(parseMarkdownlintText("")).toEqual([]);
    expect(parseMarkdownlintText("   \n  ")).toEqual([]);
    expect(
      parseMarkdownlintText(
        "markdownlint-cli2 v0.22.1 (markdownlint v0.40.0)\nFinding: a.md\nLinting: 1 file(s)\nSummary: 0 error(s)",
      ),
    ).toEqual([]);
  });

  it("does not misparse pnpm/npm noise as violations", () => {
    const noise = `npm warn Unknown project config "auto-install-peers".
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "markdownlint-cli2" not found
some-pkg@1.2.3: deprecated do not use`;
    expect(parseMarkdownlintText(noise)).toEqual([]);
  });

  it("handles a file path that itself contains a colon-and-digits", () => {
    const violations = parseMarkdownlintText(
      "docs/v1:2/notes.md:10:5 error MD009/no-trailing-spaces Trailing spaces",
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      column: 5,
      file: "docs/v1:2/notes.md",
      line: 10,
      ruleId: "MD009/no-trailing-spaces",
    });
  });
});
