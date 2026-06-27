// Zero-dep git helpers for host-repo fact detection (A-409).
//
// `detectBaseBranch` mirrors the logic in the preflight bundle
// (skills/preflight/scripts/lib/scope.mjs) — duplicated rather than imported
// because installed bundles are vendored independently and must not reach across
// each other. Keep the two in sync if the detection rule changes.
//
// The pure parsers (`parseIssueKeysFromBranches`) take their input as arguments
// so they are unit-testable without a real repository; only the thin `git*`
// wrappers shell out.

import { spawnSync } from "node:child_process";

const DEFAULT_BASE_BRANCH = "main";

/**
 * Resolve the default branch from `origin/HEAD` (e.g. main, master, develop),
 * falling back to `main` when the symbolic ref is absent.
 * @param {string} root
 * @returns {string}
 */
export function detectBaseBranch(root) {
  const result = spawnSync(
    "git",
    ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim().replace(/^refs\/remotes\/origin\//, "");
  }

  return DEFAULT_BASE_BRANCH;
}

/**
 * All branch names known to the repo (local + remote), one per line, stripped of
 * the `*`, worktree `+`, leading `remotes/<remote>/` and `HEAD ->` decorations
 * `git branch -a` adds. Returns [] when git fails (e.g. no repo).
 * @param {string} root
 * @returns {string[]}
 */
export function listBranchNames(root) {
  const result = spawnSync(
    "git",
    ["branch", "-a", "--format=%(refname:short)"],
    { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    return [];
  }

  return (
    result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      // Drop the symbolic `origin/HEAD -> origin/main` style entries.
      .filter((name) => !name.includes("->"))
      // Strip a leading remote name so `origin/asw-1-foo` is read as `asw-1-foo`.
      .map((name) => name.replace(/^[^/]+\//, ""))
  );
}

/**
 * Extract Linear-style issue-key prefixes from a list of branch names. A key is
 * the leading `<KEY>-<number>` segment (e.g. `asw-12-add-thing` → `ASW`).
 * Uppercase-normalised and de-duplicated, sorted for stable output. Requires the
 * key be 2+ letters to avoid matching `v1-...`-style branches.
 * @param {string[]} branches
 * @returns {string[]}
 */
export function parseIssueKeysFromBranches(branches) {
  const keys = new Set();
  for (const branch of branches) {
    const match = /^([A-Za-z]{2,})-\d+/.exec(branch);
    if (match) {
      keys.add(match[1].toUpperCase());
    }
  }

  return [...keys].toSorted();
}

/**
 * Convenience: detect issue keys straight from the repo's branch list.
 * @param {string} root
 * @returns {string[]}
 */
export function detectIssueKeys(root) {
  return parseIssueKeysFromBranches(listBranchNames(root));
}
