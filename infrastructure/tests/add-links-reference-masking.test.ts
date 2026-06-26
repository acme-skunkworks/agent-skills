import { describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`). `rewriteBody`
// uses the bundle's own config.json (workspace `acme-skunkworks`, keys ASW/AKW).
import { rewriteBody } from "../../skills/changelog/scripts/add-links.mjs";

describe("rewriteBody — reference-style link masking (bug 4)", () => {
  it("does not rewrite inside a numbered reference label `[ASW-123][1]`", () => {
    const body = "See [ASW-123][1] for detail.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("does not rewrite inside a collapsed reference label `[ASW-123][]`", () => {
    const body = "See [ASW-123][] for detail.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("does not rewrite inside a named reference label `[ASW-123][ref]`", () => {
    const body = "See [ASW-123][ref] for detail.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("is idempotent on a second run over reference-style labels", () => {
    const body = "Closes [ASW-123][1] and [AKW-7][].";
    const once = rewriteBody(body);
    expect(once).toBe(body);
    expect(rewriteBody(once)).toBe(once);
  });

  it("still links a bare ID alongside a reference-style label", () => {
    const body = "Closes ASW-9, tracked in [ASW-123][1].";
    expect(rewriteBody(body)).toBe(
      "Closes [ASW-9](https://linear.app/goose-and-hobbes/issue/ASW-9), tracked in [ASW-123][1].",
    );
  });

  it("is idempotent on an already-linked inline ID (regression guard)", () => {
    const body =
      "[ASW-123](https://linear.app/goose-and-hobbes/issue/ASW-123)";
    expect(rewriteBody(body)).toBe(body);
    expect(rewriteBody(rewriteBody(body))).toBe(body);
  });

  it("does not rewrite the companion reference definition line", () => {
    const body =
      "See [ASW-123][] for detail.\n\n[ASW-123]: https://example.com/whatever\n";
    expect(rewriteBody(body)).toBe(body);
  });

  it("is idempotent across a collapsed reference usage and its definition", () => {
    const body =
      "See [ASW-123][] for detail.\n\n[ASW-123]: https://example.com/whatever\n";
    const once = rewriteBody(body);
    expect(once).toBe(body);
    expect(rewriteBody(once)).toBe(once);
  });

  it("does not rewrite a reference definition indented up to three spaces", () => {
    const body =
      "See [ASW-123][] for detail.\n\n   [ASW-123]: https://example.com/whatever\n";
    expect(rewriteBody(body)).toBe(body);
    expect(rewriteBody(rewriteBody(body))).toBe(body);
  });

  it("still links a bare ID in prose while leaving the definition intact", () => {
    const body =
      "Closes ASW-9.\n\n[ASW-123]: https://example.com/whatever\n";
    expect(rewriteBody(body)).toBe(
      "Closes [ASW-9](https://linear.app/goose-and-hobbes/issue/ASW-9).\n\n[ASW-123]: https://example.com/whatever\n",
    );
  });
});
