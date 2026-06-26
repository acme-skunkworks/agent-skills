import { describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`), so the published
// triage-pr bundle stays test-free whilst the symmetric reply/resolve +
// idempotency logic is still covered in CI. The `gh` mutation layer is not
// exercised here — only the pure planning/formatting functions, which is exactly
// the surface SK-410's "verifiable without spamming a real PR" criterion needs.
import {
  SUMMARY_MARKER,
  THREAD_MARKER,
  buildConsolidatedComment,
  buildReplyBody,
  findExistingAckComment,
  hasMarker,
  parseArgs,
  parseReplyOnAccept,
  planThreadResponses,
} from "../../../skills/triage-pr/scripts/respond-threads.mjs";

describe("planThreadResponses — symmetric accept/decline", () => {
  it("accepts → reply-resolve referencing the fixing sha + marker", () => {
    const [action] = planThreadResponses([
      { decision: "accept", sha: "abc1234", threadId: "T1" },
    ]);
    expect(action.kind).toBe("reply-resolve");
    expect(action.body).toContain("abc1234");
    expect(action.body).toContain(THREAD_MARKER);
  });

  it("declines → reply-resolve carrying the technical reasoning", () => {
    const [action] = planThreadResponses([
      { decision: "decline", reason: "Breaks the public API.", threadId: "T2" },
    ]);
    expect(action.kind).toBe("reply-resolve");
    expect(action.body).toContain("Breaks the public API.");
  });

  it("outdated → resolve-only with no reply body", () => {
    const [action] = planThreadResponses([
      { decision: "outdated", threadId: "T3" },
    ]);
    expect(action.kind).toBe("resolve-only");
    expect(action).not.toHaveProperty("body");
  });
});

describe("planThreadResponses — replyOnAccept knob", () => {
  it("replyOnAccept:false → accept resolves silently (no reply)", () => {
    const [action] = planThreadResponses(
      [{ decision: "accept", sha: "abc1234", threadId: "T1" }],
      { replyOnAccept: false },
    );
    expect(action.kind).toBe("resolve-only");
  });

  it("declines still reply even when replyOnAccept is false", () => {
    const [action] = planThreadResponses(
      [{ decision: "decline", reason: "Out of scope.", threadId: "T2" }],
      { replyOnAccept: false },
    );
    expect(action.kind).toBe("reply-resolve");
  });
});

describe("planThreadResponses — guardrails and idempotency", () => {
  it("never auto-actions a human thread", () => {
    const [action] = planThreadResponses([
      { decision: "accept", isHuman: true, sha: "abc1234", threadId: "H1" },
    ]);
    expect(action).toEqual({ kind: "skip", threadId: "H1", why: "human" });
  });

  it("skips a thread already carrying our marker (no double-post)", () => {
    const [action] = planThreadResponses([
      {
        comments: [{ author: "me", body: `Addressed in x.\n\n${THREAD_MARKER}` }],
        decision: "accept",
        sha: "feed123",
        threadId: "T_done",
      },
    ]);
    expect(action).toEqual({
      kind: "skip",
      threadId: "T_done",
      why: "already-handled",
    });
  });

  it("acts on a thread whose only comment lacks our marker", () => {
    const [action] = planThreadResponses([
      {
        comments: [{ author: "coderabbitai", body: "nit: rename this" }],
        decision: "accept",
        sha: "feed123",
        threadId: "T_fresh",
      },
    ]);
    expect(action.kind).toBe("reply-resolve");
  });

  it("throws on an unknown decision", () => {
    expect(() =>
      planThreadResponses([{ decision: "maybe", threadId: "T?" }]),
    ).toThrow(/unknown decision/);
  });
});

describe("buildReplyBody — validation + no sycophancy", () => {
  it("requires a sha for an accept", () => {
    expect(() => buildReplyBody({ decision: "accept" })).toThrow(/sha/);
  });

  it("requires reasoning for a decline", () => {
    expect(() =>
      buildReplyBody({ decision: "decline", reason: "   " }),
    ).toThrow(/reasoning/);
  });

  it("states facts without praise", () => {
    const body = buildReplyBody({ decision: "accept", sha: "abc1234" });
    expect(body).toMatch(/^Addressed in abc1234\./);
    expect(body).not.toMatch(/great|absolutely right|excellent/i);
  });
});

describe("buildConsolidatedComment — issue-level acknowledgement", () => {
  const findings = [
    {
      reference: "abc1234",
      status: "accepted",
      title: "Read missing from allowed-tools",
    },
    { reference: "YAGNI", status: "declined", title: "Add a retry wrapper" },
    { reference: "SK-411", status: "out-of-scope", title: "Refactor fetch" },
  ];

  it("maps each finding to its outcome + reference and carries the marker", () => {
    const body = buildConsolidatedComment(findings);
    expect(body).toContain(
      "| Read missing from allowed-tools | Accepted | `abc1234` |",
    );
    expect(body).toContain("| Add a retry wrapper | Declined | YAGNI |");
    expect(body).toContain("| Refactor fetch | Out of scope | SK-411 |");
    expect(body).toContain(SUMMARY_MARKER);
  });

  it("escapes pipes so a title/reason can't break the table", () => {
    const body = buildConsolidatedComment([
      { reference: "a|b", status: "declined", title: "x|y" },
    ]);
    expect(body).toContain("| x\\|y | Declined | a\\|b |");
  });

  it("throws on an unknown status", () => {
    expect(() =>
      buildConsolidatedComment([{ status: "dunno", title: "x" }]),
    ).toThrow(/unknown finding status/);
  });
});

describe("findExistingAckComment — upsert detection", () => {
  it("returns the marker-bearing comment so it is edited in place", () => {
    const found = findExistingAckComment([
      { body: "lgtm", id: 1, user: "human" },
      { body: `### summary\n${SUMMARY_MARKER}`, id: 2, user: "me" },
    ]);
    expect(found?.id).toBe(2);
  });

  it("returns null when no prior summary exists", () => {
    expect(
      findExistingAckComment([{ body: "lgtm", id: 1, user: "human" }]),
    ).toBeNull();
  });

  it("does not mistake a thread reply marker for the summary", () => {
    expect(
      findExistingAckComment([{ body: THREAD_MARKER, id: 9, user: "me" }]),
    ).toBeNull();
  });
});

describe("hasMarker", () => {
  it("matches a specific marker and the any-marker form", () => {
    expect(hasMarker(`x ${THREAD_MARKER}`, THREAD_MARKER)).toBe(true);
    expect(hasMarker(`x ${SUMMARY_MARKER}`)).toBe(true);
    expect(hasMarker("plain text")).toBe(false);
  });
});

describe("arg parsing", () => {
  it("parses flags, camel-cases keys, and reads --dry-run", () => {
    const o = parseArgs([
      "--thread",
      "PRRT_1",
      "--reply-on-accept",
      "false",
      "--dry-run",
    ]);
    expect(o).toMatchObject({
      dryRun: true,
      replyOnAccept: "false",
      thread: "PRRT_1",
    });
  });

  it("throws when a flag lacks a value", () => {
    expect(() => parseArgs(["--thread"])).toThrow(/requires a value/);
  });

  it("parseReplyOnAccept defaults true and rejects non-booleans", () => {
    expect(parseReplyOnAccept(undefined)).toBe(true);
    expect(parseReplyOnAccept("false")).toBe(false);
    expect(() => parseReplyOnAccept("yes")).toThrow();
  });
});
