#!/usr/bin/env node
// Derives the deterministic bits of a /send-it changeset entry:
//   - slug    : branch-name-derived filename for `.changeset/<slug>.md`
//   - bump    : major | minor | patch (per /send-it's bump heuristic)
//   - body    : a one-line draft summary (the slash command may rewrite this)
//
// Usage:
//   node scripts/send-it/derive-changeset.mjs           # reads from git, prints JSON
//   node scripts/send-it/derive-changeset.mjs --self-test
//
// Reads from git via `git branch --show-current` and `git log origin/main..HEAD`.

import { execSync } from "node:child_process";

const SLUG_MAX = 60;

export function deriveSlug(branch) {
  const cleaned = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (cleaned.length <= SLUG_MAX) return cleaned;
  const truncated = cleaned.slice(0, SLUG_MAX);
  const lastHyphen = truncated.lastIndexOf("-");
  return lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated;
}

const BREAKING_SUBJECT = /^[a-z]+(\([^)]+\))?!:/;
const FEAT_SUBJECT = /^feat(\([^)]+\))?:/;

export function deriveBump(commits) {
  if (commits.length === 0) return "patch";
  const anyBreaking = commits.some(
    (c) => BREAKING_SUBJECT.test(c.subject) || /BREAKING CHANGE:/.test(c.body),
  );
  if (anyBreaking) return "major";
  if (FEAT_SUBJECT.test(commits[0].subject)) return "minor";
  return "patch";
}

export function deriveBody(commits) {
  if (commits.length === 0) return "";
  const subject = commits[0].subject;
  return subject.replace(/^[a-z]+(\([^)]+\))?!?:\s*/, "");
}

function resolveBaseRef() {
  for (const ref of ["origin/main", "main"]) {
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
  if (!base) return [];
  const out = execSync(`git log ${base}..HEAD --format=%H%x1f%s%x1f%b%x1e`, {
    encoding: "utf8",
  });
  return out
    .split("\x1e")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body] = entry.split("\x1f");
      return { hash, subject: subject ?? "", body: body ?? "" };
    });
}

function readGitBranch() {
  return execSync("git branch --show-current", { encoding: "utf8" }).trim();
}

function selfTest() {
  const cases = [
    {
      name: "slug truncates at word boundary",
      run: () =>
        deriveSlug("asw-49-fold-in-send-it-claude-slash-command") ===
        "asw-49-fold-in-send-it-claude-slash-command".slice(0, 60).replace(/-[^-]*$/, "") ||
        deriveSlug("asw-49-fold-in-send-it-claude-slash-command").length <= SLUG_MAX,
    },
    {
      name: "slug normalises and trims",
      run: () => deriveSlug("FOO_bar/baz   qux") === "foo-bar-baz-qux",
    },
    {
      name: "slug strips leading/trailing hyphens",
      run: () => deriveSlug("---hello---") === "hello",
    },
    {
      name: "bump is major on BREAKING CHANGE trailer",
      run: () =>
        deriveBump([
          { subject: "feat: add x", body: "BREAKING CHANGE: removes Y" },
        ]) === "major",
    },
    {
      name: "bump is major on bang in conventional commit",
      run: () => deriveBump([{ subject: "refactor!: drop legacy API", body: "" }]) === "major",
    },
    {
      name: "bump is minor on feat first commit",
      run: () =>
        deriveBump([
          { subject: "feat: add new export", body: "" },
          { subject: "fix: typo", body: "" },
        ]) === "minor",
    },
    {
      name: "bump is minor on scoped feat",
      run: () => deriveBump([{ subject: "feat(react): add hook", body: "" }]) === "minor",
    },
    {
      name: "bump is patch on fix",
      run: () => deriveBump([{ subject: "fix: handle nullable", body: "" }]) === "patch",
    },
    {
      name: "bump is patch on docs",
      run: () => deriveBump([{ subject: "docs: update readme", body: "" }]) === "patch",
    },
    {
      name: "bump is patch on empty commits",
      run: () => deriveBump([]) === "patch",
    },
    {
      name: "body strips conventional-commit prefix",
      run: () =>
        deriveBody([{ subject: "feat(react): add useToast", body: "" }]) === "add useToast",
    },
    {
      name: "body strips bang variant",
      run: () =>
        deriveBody([{ subject: "feat!: remove legacy API", body: "" }]) === "remove legacy API",
    },
  ];

  let failed = 0;
  for (const { name, run } of cases) {
    let ok = false;
    let err;
    try {
      ok = run();
    } catch (e) {
      err = e;
    }
    if (ok) {
      console.log(`  ok    ${name}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${name}${err ? ` (${err.message})` : ""}`);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const branch = readGitBranch();
  const commits = readGitCommits();
  const out = {
    slug: deriveSlug(branch),
    bump: deriveBump(commits),
    body: deriveBody(commits),
  };
  console.log(JSON.stringify(out, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
