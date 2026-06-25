#!/usr/bin/env node
// Merge-time half of changelog enrichment.
//
// `affected_packages` is knowable before merge — it's just the set of workspace
// packages the branch diff touches — so the changelog step computes it at write
// time rather than waiting for a privileged post-merge step. This script reads
// the branch diff against the base, maps it through the shared
// `derivePackagesFromPaths` rule, and writes the result into the changelog entry
// for the current branch.
//
// The post-merge-only fields (`merged_at`, `commit`, `merge_strategy`, and
// authoritative `stats`) are deliberately NOT touched here — they're owned by
// the release-orchestrator and stay blank until it fills them.
//
// Env overrides (both optional):
//   BASE_REF    — base to diff against (default: origin/<baseBranch> from config.json)
//   BRANCH_NAME — entry lookup key (default: current branch via git)

import { findEntryByBranch } from "./lib/changelog.mjs";
import { derivePackagesFromPaths } from "./lib/derive-packages.mjs";
import { parseFrontmatter, stringifyFrontmatter } from "./lib/frontmatter.mjs";
import { loadConfig } from "./lib/config.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const config = loadConfig();
const BASE_REF = process.env.BASE_REF?.trim() || `origin/${config.baseBranch}`;

function git(args) {
  let out;
  try {
    out = execFileSync("git", args, { encoding: "utf8" });
  } catch (error) {
    // Most likely cause when run standalone: BASE_REF isn't fetched. In a ship
    // flow the base is fetched before this runs.
    console.error(`git ${args.join(" ")} failed: ${error.message}`);
    process.exit(1);
  }

  return out.trim();
}

function currentBranch() {
  const fromEnv = process.env.BRANCH_NAME?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return git(["rev-parse", "--abbrev-ref", "HEAD"]);
}

function changedPaths(base) {
  // Three-dot: files changed on the branch since it diverged from base, so
  // unrelated churn that landed on base meanwhile doesn't leak in.
  const out = git(["diff", "--name-only", `${base}...HEAD`]);
  return out ? out.split("\n") : [];
}

const branch = currentBranch();
const file = findEntryByBranch(branch, config.changelogDir);
if (!file) {
  console.log(
    `No changelog entry found for branch '${branch}'. Nothing to set.`,
  );
  process.exit(0);
}

const packages = derivePackagesFromPaths(changedPaths(BASE_REF), {
  packageRoots: config.packageRoots,
  fallbackPackage: config.fallbackPackage,
  changelogDir: config.changelogDir,
});

const raw = readFileSync(file, "utf8");
const parsed = parseFrontmatter(raw);
// Always overwrite (not fill-only like the post-merge fields): re-running must
// re-derive affected_packages from the latest branch diff as commits are added.
//
// Rebuild in canonical field order — `affected_packages` immediately before
// `stats` — instead of spreading it on the end. `stringifyFrontmatter` emits in
// insertion order, so a source entry that lacked the `affected_packages: []`
// placeholder would otherwise drift the field after `stats` permanently.
const fm = {};
for (const [key, value] of Object.entries(parsed.data)) {
  if (key === "affected_packages") {
    continue; // re-inserted in its canonical slot below
  }
  if (key === "stats") {
    fm.affected_packages = packages;
  }
  fm[key] = value;
}
if (!("affected_packages" in fm)) {
  // No `stats` key to anchor against; append (a missing `stats` is itself a
  // contract violation the validator will flag).
  fm.affected_packages = packages;
}

writeFileSync(file, stringifyFrontmatter(parsed.content, fm));

console.log(`Set affected_packages on ${file}`);
console.log(`  branch=${branch} base=${BASE_REF}`);
console.log(`  affected_packages=${JSON.stringify(packages)}`);
