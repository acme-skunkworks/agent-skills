// Imports the BUNDLE script directly (the distributed `.mjs`), so the published
// triage-pr bundle stays test-free whilst the pure fetch/transform logic is still
// covered in CI. The `gh` network layer is not exercised here — only `buildResult`,
// which is exactly the surface that needs verifying without hitting a real PR.
// DEFER_PENDING_MARKER is imported from the write-side script (its source of
// truth) rather than redeclared, so the test can't drift from the real marker.
import { DEFER_PENDING_MARKER } from "../../../skills/triage-pr/scripts/respond-threads.mjs";
import { buildResult } from "../../../skills/triage-pr/scripts/review-threads.mjs";
import { describe, expect, it } from "vitest";

function ids(threads: Array<{ threadId: string }>) {
  return threads.map((thread) => thread.threadId);
}

function summaryIds(comments: Array<{ commentId: string }>) {
  return comments.map((comment) => comment.commentId);
}

// A raw GraphQL review-thread node (bot logins come back without `[bot]`).
function threadNode(
  id: string,
  {
    author = "coderabbitai",
    body = "nit",
    extraComments = [] as string[],
  } = {},
) {
  return {
    comments: {
      nodes: [
        { author: { login: author }, body },
        ...extraComments.map((text) => ({
          author: { login: "RobEasthope" },
          body: text,
        })),
      ],
    },
    id,
    isOutdated: false,
    isResolved: false,
    line: 1,
    path: "a.ts",
  };
}

describe("buildResult — deferred bucket", () => {
  it("routes a bot thread carrying the defer marker into deferredThreads", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [
        threadNode("T_plain"),
        threadNode("T_deferred", {
          extraComments: [`Noted as out of scope.\n\n${DEFER_PENDING_MARKER}`],
        }),
      ],
    });

    expect(ids(result.deferredThreads)).toEqual(["T_deferred"]);
    expect(ids(result.unresolvedThreads)).toEqual(["T_plain"]);
  });

  it("keeps a plain unresolved bot thread out of the deferred bucket", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [threadNode("T_plain")],
    });

    expect(result.deferredThreads).toHaveLength(0);
    expect(ids(result.unresolvedThreads)).toEqual(["T_plain"]);
  });

  it("never routes a human thread into the deferred bucket, even if marked", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [
        threadNode("T_human", {
          author: "alice",
          extraComments: [`stray\n\n${DEFER_PENDING_MARKER}`],
        }),
      ],
    });

    expect(result.deferredThreads).toHaveLength(0);
    expect(ids(result.humanThreads)).toEqual(["T_human"]);
    expect(result.unresolvedThreads).toHaveLength(0);
  });

  it("always returns the deferredThreads array (empty when none)", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      threadNodes: [],
    });

    expect(result.deferredThreads).toEqual([]);
  });
});

describe("buildResult — review-submission summaries", () => {
  it("surfaces a bot's BUGBOT_REVIEW review body as an AI summary", () => {
    const result = buildResult({
      bots: ["cursor"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      reviewNodes: [
        {
          author: { login: "cursor" },
          body: "<!-- BUGBOT_REVIEW -->\nCursor Bugbot has reviewed your changes and found 2 potential issues.",
          id: "REV_summary",
          state: "COMMENTED",
        },
      ],
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["REV_summary"]);
  });

  it("excludes Bugbot's 'not enabled' upsell issue comment", () => {
    const result = buildResult({
      bots: ["cursor"],
      commentNodes: [
        {
          author: { login: "cursor" },
          body: "Bugbot is not enabled for your account, so this pull request was not reviewed.",
          id: "IC_upsell",
        },
      ],
      isDraft: false,
      number: 7,
      reviewNodes: [],
      threadNodes: [],
    });

    expect(result.aiSummaryComments).toHaveLength(0);
  });

  it("prefers the review-body summary over the upsell when both are present", () => {
    const result = buildResult({
      bots: ["cursor"],
      commentNodes: [
        {
          author: { login: "cursor" },
          body: "Bugbot is not enabled for your account, so this pull request was not reviewed.",
          id: "IC_upsell",
        },
      ],
      isDraft: false,
      number: 7,
      reviewNodes: [
        {
          author: { login: "cursor" },
          body: "<!-- BUGBOT_REVIEW -->\nfound 1 potential issue.",
          id: "REV_summary",
          state: "COMMENTED",
        },
      ],
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["REV_summary"]);
  });

  it("prefers a re-review's newer summary over an earlier one with the same marker", () => {
    const result = buildResult({
      bots: ["cursor"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      reviewNodes: [
        {
          author: { login: "cursor" },
          body: "<!-- BUGBOT_REVIEW -->\nfound 3 potential issues.",
          id: "REV_old",
          state: "COMMENTED",
        },
        {
          author: { login: "cursor" },
          body: "<!-- BUGBOT_REVIEW -->\nfound 1 potential issue.",
          id: "REV_new",
          state: "COMMENTED",
        },
      ],
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["REV_new"]);
  });

  it("never treats a blank review body as a summary", () => {
    const result = buildResult({
      bots: ["cursor"],
      commentNodes: [],
      isDraft: false,
      number: 7,
      reviewNodes: [
        { author: { login: "cursor" }, body: "", id: "REV_blank" },
        { author: { login: "cursor" }, body: "   \n ", id: "REV_ws" },
      ],
      threadNodes: [],
    });

    expect(result.aiSummaryComments).toHaveLength(0);
  });

  it("leaves issue-comment summaries unchanged when no reviews are present", () => {
    const result = buildResult({
      bots: ["coderabbitai"],
      commentNodes: [
        {
          author: { login: "coderabbitai" },
          body: "<!-- use_sticky_comment -->\n## Walkthrough",
          id: "IC_sticky",
        },
      ],
      isDraft: false,
      number: 7,
      threadNodes: [],
    });

    expect(summaryIds(result.aiSummaryComments)).toEqual(["IC_sticky"]);
  });
});
