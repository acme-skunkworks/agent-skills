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
import { fileURLToPath } from "node:url";
import { argv } from "node:process";

/**
 * Rebuild an entry's frontmatter with `affected_packages` set, in canonical
 * field order (`affected_packages` immediately before `stats`).
 *
 * Guards against a destructive overwrite: if `data` is empty or lacks the
 * expected `branch` key — which is what `parseFrontmatter` returns when the
 * entry has no parseable frontmatter — throw rather than clobber the file with
 * just `affected_packages`.
 *
 * @param {Record<string, unknown>} data parsed frontmatter data
 * @param {string[]} packages derived affected packages
 * @returns {Record<string, unknown>} the rebuilt frontmatter object
 */
export function buildAffectedPackagesFrontmatter(data, packages) {
  if (!data || typeof data !== "object" || !("branch" in data)) {
    throw new Error(
      "Refusing to write affected_packages: entry frontmatter is empty or " +
        "missing the `branch` key — parsing likely failed. Writing would " +
        "overwrite the entry with only affected_packages.",
    );
  }

  const fm = {};
  for (const [key, value] of Object.entries(data)) {
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

  return fm;
}

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

function main() {
  const config = loadConfig();
  const BASE_REF =
    process.env.BASE_REF?.trim() || `origin/${config.baseBranch}`;

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
  // Rebuild in canonical field order via the guarded helper, which refuses to
  // write when the parse yielded empty/branch-less data (a destructive overwrite).
  const fm = buildAffectedPackagesFrontmatter(parsed.data, packages);

  writeFileSync(file, stringifyFrontmatter(parsed.content, fm));

  console.log(`Set affected_packages on ${file}`);
  console.log(`  branch=${branch} base=${BASE_REF}`);
  console.log(`  affected_packages=${JSON.stringify(packages)}`);
}

// Only run when invoked as a CLI, not when imported (e.g. by unit tests
// exercising `buildAffectedPackagesFrontmatter`).
if (argv[1] && fileURLToPath(import.meta.url) === argv[1]) {
  main();
}
