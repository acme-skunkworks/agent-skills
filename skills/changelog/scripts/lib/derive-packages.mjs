// Map a set of changed repo-relative paths to the workspace packages they touch.
//
// Used by the merge-time path (set-affected-packages.mjs, computed from the
// branch diff). Kept as one implementation so the `affected_packages` value
// can't drift if a post-merge counterpart reuses the same rule.
//
// The rule (mirrors a conventional monorepo path→package mapping):
//   apps/<x>/...      -> <x>
//   packages/<x>/...  -> <x>
//   services/<x>/...  -> <x>
//   everything else   -> infrastructure
// The changelog directory itself is skipped — it's touched by every entry and
// would otherwise pin `infrastructure` onto every package list.

/**
 * @param {string[]} paths repo-relative changed paths
 * @returns {string[]} sorted, de-duplicated package names
 */
export function derivePackagesFromPaths(paths) {
  const out = new Set();
  for (const changedPath of paths) {
    const path = changedPath.trim();
    if (!path) {
      continue;
    }

    if (path.startsWith("changelog/")) {
      continue;
    }

    const m =
      /^apps\/([^/]+)\//.exec(path) ??
      /^packages\/([^/]+)\//.exec(path) ??
      /^services\/([^/]+)\//.exec(path);
    out.add(m ? m[1] : "infrastructure");
  }

  return [...out].toSorted();
}
