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
  let names;
  try {
    names = readdirSync(changelogDir);
  } catch (err) {
    // A repo with no `changelog/` directory yet means "no entry found", not a
    // crash — callers (e.g. set-affected-packages.mjs) already handle null.
    if (err.code === "ENOENT") {
      return null;
    }
    throw err;
  }

  const files = names
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .map((n) => join(changelogDir, n));
  for (const entryPath of files) {
    let data;
    try {
      ({ data } = parseFrontmatter(readFileSync(entryPath, "utf8")));
    } catch (err) {
      // Rethrow with the offending file named — the raw parser error carries no
      // filename, so a malformed entry anywhere in the corpus is hard to locate.
      throw new Error(
        `Failed to parse changelog frontmatter in ${entryPath}: ${err.message}`,
      );
    }
    if (data?.branch === branch) {
      return entryPath;
    }
  }

  return null;
}
