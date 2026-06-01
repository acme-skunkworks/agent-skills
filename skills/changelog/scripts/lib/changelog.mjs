// Shared helpers for locating changelog entries on disk.
//
// `findEntryByBranch` is the one entry-lookup rule the enrichment scripts share,
// so the rule can't drift between callers — the same reasoning that produced
// derive-packages.mjs.

import { parseFrontmatter } from "./frontmatter.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_CHANGELOG_DIR = "changelog";

/**
 * Find the changelog entry whose frontmatter `branch:` equals `branch`.
 * @param {string} branch the branch name to match against the `branch:` field
 * @param {string} [changelogDir] directory to scan (default: "changelog")
 * @returns {string|null} the matching entry's path, or null if none matches
 */
export function findEntryByBranch(
  branch,
  changelogDir = DEFAULT_CHANGELOG_DIR,
) {
  const files = readdirSync(changelogDir)
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .map((n) => join(changelogDir, n));
  for (const entryPath of files) {
    const { data } = parseFrontmatter(readFileSync(entryPath, "utf8"));
    if (data?.branch === branch) {
      return entryPath;
    }
  }

  return null;
}
