// Derives the deterministic bits the send-it ship flow needs from the branch
// commits. Zero dependencies — Node built-ins only, no build step, no tsx.
// Run: node skills/send-it/scripts/derive-bump.mjs
//
// Under release-please (Conventional Commits) there is no changeset file: the
// release signal is the Conventional Commits PR title. send-it uses these
// derived bits to name the dated changelog/ entry and to compose that title
// (the bump signal release-please reads).
//
// Fields printed as JSON to stdout:
//   slug : branch-name-derived slug (changelog/<ts>-<slug>.md filename)
//   bump : major | minor | patch (drives the PR-title prefix: feat!/feat/fix)
//   body : a one-line draft summary (the ship flow may rewrite this)
//
// Reads from git via `git branch --show-current` and `git log <base>..HEAD`.
// The base ref is `origin/main` (falling back to `main`), overridable via the
// BASE_REF env var. The pure functions are exported for vitest.

import { execSync } from "node:child_process";

const SLUG_MAX = 60;

// Git --format field/record separators (%x1f unit, %x1e record).
const UNIT_SEP = "";
const RECORD_SEP = "";

export function deriveSlug(branch) {
  const cleaned = branch
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  if (cleaned.length <= SLUG_MAX) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, SLUG_MAX);
  const lastHyphen = truncated.lastIndexOf("-");
  return lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated;
}

const BREAKING_SUBJECT = /^[a-z]+(\([^)]+\))?!:/;
const FEAT_SUBJECT = /^feat(\([^)]+\))?:/;

export function deriveBump(commits) {
  if (commits.length === 0) {
    return "patch";
  }

  const anyBreaking = commits.some(
    (commit) =>
      BREAKING_SUBJECT.test(commit.subject) ||
      /BREAKING CHANGE:/.test(commit.body),
  );
  if (anyBreaking) {
    return "major";
  }

  if (FEAT_SUBJECT.test(commits[0].subject)) {
    return "minor";
  }

  return "patch";
}

export function deriveBody(commits) {
  if (commits.length === 0) {
    return "";
  }

  const subject = commits[0].subject;
  return subject.replace(/^[a-z]+(\([^)]+\))?!?:\s*/, "");
}

function resolveBaseRef() {
  const candidates = process.env.BASE_REF
    ? [process.env.BASE_REF]
    : ["origin/main", "main"];
  for (const ref of candidates) {
    try {
      execSync(`git rev-parse --verify ${ref}`, { stdio: "ignore" });
      return ref;
    } catch {
      // ref doesn't exist; try next
    }
  }

  return null;
}

function readGitCommits() {
  const base = resolveBaseRef();
  if (!base) {
    return [];
  }

  const out = execSync(`git log ${base}..HEAD --format=%H%x1f%s%x1f%b%x1e`, {
    encoding: "utf8",
  });
  return out
    .split(RECORD_SEP)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body] = entry.split(UNIT_SEP);
      return { body: body ?? "", hash, subject: subject ?? "" };
    });
}

function readGitBranch() {
  return execSync("git branch --show-current", { encoding: "utf8" }).trim();
}

function main() {
  const branch = readGitBranch();
  const commits = readGitCommits();
  console.log(
    JSON.stringify(
      {
        body: deriveBody(commits),
        bump: deriveBump(commits),
        slug: deriveSlug(branch),
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
