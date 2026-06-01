#!/usr/bin/env node
// Unresolved-review-feedback fetcher for the triage-pr skill.
//
// Fetches a pull request's review feedback via `gh api graphql` and prints
// minimal JSON, so Phase B can triage findings without pulling whole comment
// payloads into context. Two shapes of feedback are surfaced separately because
// they live in different GitHub objects:
//
//   - unresolvedThreads : inline review threads with `isResolved == false`,
//                         raised by a configured review bot. Each is trimmed to
//                         { threadId, path, line, isOutdated, author, comments }.
//   - humanThreads      : the same, for threads NOT raised by a review bot —
//                         surfaced so a human isn't silently dropped, but the
//                         skill does not auto-action them.
//   - aiSummaryComments : issue-level comments authored by a review bot (the
//                         sticky `track_progress` / `use_sticky_comment` summary).
//                         These are NOT review threads and have no `isResolved`,
//                         so the reviewThreads query never returns them.
//
// The network layer (gh) is kept separate from the pure transform so the
// transform is unit-tested by `--self-test` with no network access.
//
// Usage:
//   node review-threads.mjs <pr-number-or-url>                 # minimal JSON to stdout
//   node review-threads.mjs <pr> --bots "a[bot],b[bot]"        # override review-bot logins
//   node review-threads.mjs <pr> --repo owner/name             # set repo explicitly
//   node review-threads.mjs <pr> --include-resolved            # keep resolved threads too
//   node review-threads.mjs --self-test                        # run built-in fixtures

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Common AI review-bot logins. GitHub's GraphQL API returns bot logins WITHOUT
// the `[bot]` suffix (e.g. `claude`, `coderabbitai`), whereas the REST API and
// many docs show the suffixed form (`claude[bot]`). `botMatches` normalises both
// sides, so a consumer's config can use either form.
const DEFAULT_BOTS = ["claude", "cursor", "coderabbitai", "github-actions"];

// ---- pure transform (no network) ----------------------------------------

/** Strip a trailing `[bot]` suffix so a login compares equal in either form. */
function normaliseBot(login) {
  return String(login ?? "").replace(/\[bot\]$/, "");
}

/** Build a suffix-insensitive predicate matching a login against the bot list. */
function makeBotMatcher(bots) {
  const set = new Set(bots.map(normaliseBot));
  return (login) => set.has(normaliseBot(login));
}

/** Reduce raw GraphQL comment nodes to the minimal `{ author, body }`. */
function trimComments(commentNodes) {
  return (commentNodes ?? []).map((c) => ({
    author: c.author?.login ?? "unknown",
    body: c.body ?? "",
  }));
}

/** Reduce a raw review-thread node to its minimal shape for the report. */
function shapeThread(node) {
  const comments = trimComments(node.comments?.nodes);
  return {
    threadId: node.id,
    path: node.path ?? null,
    line: node.line ?? node.originalLine ?? null,
    isOutdated: Boolean(node.isOutdated),
    author: comments[0]?.author ?? "unknown",
    comments,
  };
}

/**
 * Build the minimal result from raw GraphQL nodes. Splitting bot threads from
 * human threads honours the skill's "AI bots only" contract while still
 * surfacing human threads for the report.
 */
export function buildResult({
  number,
  isDraft,
  threadNodes,
  commentNodes,
  bots,
  includeResolved = false,
}) {
  const isBot = makeBotMatcher(bots);
  const unresolvedThreads = [];
  const humanThreads = [];

  for (const node of threadNodes ?? []) {
    if (!includeResolved && node.isResolved) continue;
    const thread = shapeThread(node);
    if (isBot(thread.author)) unresolvedThreads.push(thread);
    else humanThreads.push(thread);
  }

  const aiSummaryComments = (commentNodes ?? [])
    .filter((c) => isBot(c.author?.login))
    .map((c) => ({
      commentId: c.id,
      author: c.author?.login ?? "unknown",
      body: c.body ?? "",
    }));

  return {
    pr: number,
    isDraft: Boolean(isDraft),
    unresolvedThreads,
    humanThreads,
    aiSummaryComments,
  };
}

// ---- argument parsing ----------------------------------------------------

/** Parse argv into `{ pr, bots, repo, includeResolved }`; throws on a flag missing its value, an unknown `--flag`, or a malformed `--repo`. */
export function parseArgs(argv) {
  const opts = { bots: DEFAULT_BOTS, repo: null, includeResolved: false, pr: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--include-resolved") opts.includeResolved = true;
    else if (arg === "--bots") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) {
        throw new Error("--bots requires a comma-separated list of bot logins");
      }
      opts.bots = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (opts.bots.length === 0) {
        throw new Error("--bots requires at least one non-empty bot login");
      }
    } else if (arg === "--repo") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) {
        throw new Error("--repo requires an owner/name value");
      }
      if (!/^[^/\s]+\/[^/\s]+$/.test(value)) {
        throw new Error("--repo must be exactly owner/name");
      }
      opts.repo = value;
    } else if (!arg.startsWith("--") && opts.pr === null) opts.pr = arg;
    else if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
  }
  return opts;
}

/** Accept a bare number or a full PR URL; return `{ number, repo }`. */
export function resolvePr(prArg, repoArg) {
  if (prArg == null) throw new Error("no PR number or URL given");
  const urlMatch = String(prArg).match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
  );
  if (urlMatch) {
    return { number: Number(urlMatch[3]), repo: `${urlMatch[1]}/${urlMatch[2]}` };
  }
  const number = Number(prArg);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`not a PR number or URL: ${prArg}`);
  }
  return { number, repo: repoArg };
}

// ---- network layer (gh) --------------------------------------------------

/** Run a `gh` command and return stdout; 30s timeout so a stalled call can't hang. */
function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30_000, // don't hang forever if a gh call stalls
  });
}

/** Run a GraphQL query via `gh api graphql`, typing each variable as -f/-F. */
function ghGraphQL(query, variables) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "number" || typeof value === "boolean") {
      args.push("-F", `${key}=${value}`);
    } else {
      args.push("-f", `${key}=${value}`);
    }
  }
  return JSON.parse(gh(args));
}

/** Return the current repository as `owner/name`. */
function detectRepo() {
  return gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
}

const THREADS_QUERY = `query($owner:String!,$name:String!,$number:Int!,$cursor:String){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      isDraft
      reviewThreads(first:100, after:$cursor){
        pageInfo{ hasNextPage endCursor }
        nodes{
          id isResolved isOutdated path line originalLine
          comments(first:100){ nodes{ author{ login } body } }
        }
      }
    }
  }
}`;

const COMMENTS_QUERY = `query($owner:String!,$name:String!,$number:Int!,$cursor:String){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      comments(first:100, after:$cursor){
        pageInfo{ hasNextPage endCursor }
        nodes{ id author{ login } body }
      }
    }
  }
}`;

/**
 * Page through a PR sub-connection, collecting every node. Also returns
 * `isDraft`, which is meaningful only for queries that select it (the threads
 * query) and `undefined` otherwise — callers read it from the threads call alone.
 */
function fetchAll(query, owner, name, number, pick) {
  const nodes = [];
  let cursor = null;
  let isDraft;
  do {
    const data = ghGraphQL(query, { owner, name, number, cursor });
    const pr = data.data.repository.pullRequest;
    if (pr.isDraft !== undefined) isDraft = pr.isDraft;
    const conn = pick(pr);
    nodes.push(...conn.nodes);
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (cursor);
  return { nodes, isDraft };
}

/** Fetch a PR's review threads and issue comments from GitHub. */
function fetchFromGitHub(number, repo) {
  const nameWithOwner = repo ?? detectRepo();
  const parts = nameWithOwner.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`could not resolve repo: ${nameWithOwner}`);
  }
  const [owner, name] = parts;
  const threads = fetchAll(THREADS_QUERY, owner, name, number, (pr) => pr.reviewThreads);
  const comments = fetchAll(COMMENTS_QUERY, owner, name, number, (pr) => pr.comments);
  return { isDraft: threads.isDraft, threadNodes: threads.nodes, commentNodes: comments.nodes };
}

// ---- self-test -----------------------------------------------------------

/** Run the built-in fixtures (no network) and exit non-zero on any failure. */
function selfTest() {
  // GraphQL returns bot logins WITHOUT the `[bot]` suffix (e.g. `cursor`,
  // `claude`, `coderabbitai`), so the fixtures use the bare form.
  const threadNodes = [
    {
      id: "T_bot_unresolved",
      isResolved: false,
      isOutdated: false,
      path: "skills/x/SKILL.md",
      line: 42,
      comments: { nodes: [{ author: { login: "cursor" }, body: "nit: typo" }] },
    },
    {
      id: "T_bot_resolved",
      isResolved: true,
      isOutdated: false,
      path: "a.ts",
      line: 1,
      comments: { nodes: [{ author: { login: "claude" }, body: "done" }] },
    },
    {
      id: "T_bot_outdated",
      isResolved: false,
      isOutdated: true,
      path: "b.ts",
      line: null,
      originalLine: 9,
      comments: { nodes: [{ author: { login: "claude" }, body: "moved" }] },
    },
    {
      id: "T_human",
      isResolved: false,
      isOutdated: false,
      path: "c.ts",
      line: 3,
      comments: { nodes: [{ author: { login: "alice" }, body: "please rename" }] },
    },
  ];
  const commentNodes = [
    { id: "IC_summary", author: { login: "coderabbitai" }, body: "## Review summary" },
    { id: "IC_human", author: { login: "bob" }, body: "lgtm" },
  ];
  const bots = DEFAULT_BOTS;

  const result = buildResult({
    number: 7,
    isDraft: false,
    threadNodes,
    commentNodes,
    bots,
  });
  const withResolved = buildResult({
    number: 7,
    isDraft: false,
    threadNodes,
    commentNodes,
    bots,
    includeResolved: true,
  });

  const ids = (arr) => arr.map((t) => t.threadId);
  const cases = [
    {
      name: "unresolved bot thread is included",
      ok: ids(result.unresolvedThreads).includes("T_bot_unresolved"),
    },
    {
      name: "resolved bot thread is excluded by default",
      ok: !ids(result.unresolvedThreads).includes("T_bot_resolved"),
    },
    {
      name: "--include-resolved keeps the resolved bot thread",
      ok: ids(withResolved.unresolvedThreads).includes("T_bot_resolved"),
    },
    {
      name: "outdated flag and originalLine fallback are preserved",
      ok:
        result.unresolvedThreads.find((t) => t.threadId === "T_bot_outdated")
          ?.isOutdated === true &&
        result.unresolvedThreads.find((t) => t.threadId === "T_bot_outdated")
          ?.line === 9,
    },
    {
      name: "human thread goes to humanThreads, not unresolvedThreads",
      ok:
        ids(result.humanThreads).includes("T_human") &&
        !ids(result.unresolvedThreads).includes("T_human"),
    },
    {
      name: "comments are trimmed to author + body only",
      ok: result.unresolvedThreads.every((t) =>
        t.comments.every(
          (c) => Object.keys(c).sort().join(",") === "author,body",
        ),
      ),
    },
    {
      name: "thread author is taken from the first comment",
      ok:
        result.unresolvedThreads.find((t) => t.threadId === "T_bot_unresolved")
          ?.author === "cursor",
    },
    {
      name: "sticky AI summary comment is picked up",
      ok: result.aiSummaryComments.some((c) => c.commentId === "IC_summary"),
    },
    {
      name: "human issue comment is not treated as an AI summary",
      ok: !result.aiSummaryComments.some((c) => c.commentId === "IC_human"),
    },
  ];

  // A config entry written with the `[bot]` suffix must still match the bare
  // login GraphQL returns (and vice versa).
  const normalised = buildResult({
    number: 7,
    isDraft: false,
    threadNodes: [
      {
        id: "T_norm",
        isResolved: false,
        isOutdated: false,
        path: "d.ts",
        line: 1,
        comments: { nodes: [{ author: { login: "claude" }, body: "x" }] },
      },
    ],
    commentNodes: [],
    bots: ["claude[bot]"],
  });
  cases.push({
    name: "config '[bot]' suffix matches a bare GraphQL login",
    ok: ids(normalised.unresolvedThreads).includes("T_norm"),
  });

  // argument + PR-resolution parsing
  const parsed = parseArgs(["123", "--bots", "x[bot], y[bot]", "--include-resolved"]);
  cases.push({
    name: "parseArgs reads pr, bots (trimmed), and --include-resolved",
    ok:
      parsed.pr === "123" &&
      parsed.includeResolved === true &&
      parsed.bots.join(",") === "x[bot],y[bot]",
  });
  const fromUrl = resolvePr("https://github.com/acme/widgets/pull/88", null);
  cases.push({
    name: "resolvePr parses owner/repo/number from a PR URL",
    ok: fromUrl.number === 88 && fromUrl.repo === "acme/widgets",
  });
  const fromNumber = resolvePr("12", "acme/widgets");
  cases.push({
    name: "resolvePr accepts a bare number with --repo",
    ok: fromNumber.number === 12 && fromNumber.repo === "acme/widgets",
  });
  cases.push({
    name: "resolvePr throws on a non-number, non-URL string",
    ok: (() => {
      try {
        resolvePr("abc", null);
        return false;
      } catch {
        return true;
      }
    })(),
  });
  cases.push({
    name: "parseArgs throws when --bots has no value",
    ok: (() => {
      try {
        parseArgs(["123", "--bots"]);
        return false;
      } catch {
        return true;
      }
    })(),
  });
  cases.push({
    name: "parseArgs throws when --repo has no value",
    ok: (() => {
      try {
        parseArgs(["123", "--repo"]);
        return false;
      } catch {
        return true;
      }
    })(),
  });
  cases.push({
    name: "parseArgs throws on an unknown --flag",
    ok: (() => {
      try {
        parseArgs(["123", "--nope"]);
        return false;
      } catch {
        return true;
      }
    })(),
  });
  cases.push({
    name: "parseArgs throws on a malformed --repo (extra segments)",
    ok: (() => {
      try {
        parseArgs(["123", "--repo", "acme/widgets/extra"]);
        return false;
      } catch {
        return true;
      }
    })(),
  });

  let failed = 0;
  for (const { name, ok } of cases) {
    if (ok) {
      console.log(`  ok    ${name}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${name}`);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---- main ----------------------------------------------------------------

/** CLI entry: parse args, fetch from GitHub, and print the minimal JSON. */
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) {
    selfTest();
    return;
  }
  let opts;
  let pr;
  try {
    opts = parseArgs(argv);
    pr = resolvePr(opts.pr, opts.repo);
  } catch (e) {
    console.error(`review-threads: ${e.message}`);
    process.exit(2);
  }
  try {
    const { isDraft, threadNodes, commentNodes } = fetchFromGitHub(pr.number, pr.repo);
    const result = buildResult({
      number: pr.number,
      isDraft,
      threadNodes,
      commentNodes,
      bots: opts.bots,
      includeResolved: opts.includeResolved,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    // Non-zero exit so the skill can tell "couldn't fetch" from "no findings".
    console.error(`review-threads: failed to fetch from GitHub — ${e.message}`);
    process.exit(1);
  }
}

// Detect "run directly as a CLI" vs "imported as a module". A raw
// `import.meta.url === file://${argv[1]}` string compare breaks two ways:
// `import.meta.url` percent-encodes characters such as spaces, and the ESM
// loader symlink-resolves it whereas `process.argv[1]` is left untouched (e.g.
// macOS /var → /private/var, pnpm's symlinked store). Normalise both sides
// through realpath before comparing.
function isCliEntry() {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(process.argv[1])
    );
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main();
}
