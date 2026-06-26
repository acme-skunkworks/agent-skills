// Detector registry keyed by config-KEY NAME, not by skill (SK-409).
//
// One detector per config key serves every skill that uses it — `baseBranch`
// covers changelog + send-it + preflight; `issueKeys` covers changelog +
// cleanup-repo + linear-sync. A key in a skill's config.example.json with NO
// entry here is reported as `needs-manual-input`; the merge then leaves it for
// the user (or a Linear MCP fact) to supply.
//
// Each detector returns `{ value }` when it can determine the key, or `null`
// when it cannot (→ needs-manual-input). Detectors read host-repo state via the
// shared context; results are memoised so a key shared by several skills is only
// computed once.

import { detectBaseBranch, detectIssueKeys } from "./git.mjs";
import { detectPackageRoots } from "./workspace.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fixed defaults that don't depend on the host repo.
 */
const SHIPPABLE_MANIFEST_KEYS = ["name", "version", "files", "publishConfig"];
const REVIEW_BOTS = ["claude", "cursor", "coderabbitai"];
const MAX_CI_ROUNDS = 5;

/**
 * Detect the published surface from the root package.json `files` field (the
 * paths npm would ship), else fall back to detected workspace roots, else [].
 * @param {string} repoRoot
 * @param {string[]} packageRoots
 * @returns {string[]}
 */
function detectShippablePaths(repoRoot, packageRoots) {
  const pkgFile = join(repoRoot, "package.json");
  if (existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
      if (Array.isArray(pkg.files) && pkg.files.length > 0) {
        // Preserve explicit manifest entries verbatim — `files` lists what npm
        // ships, which can be individual files (README.md) or globs
        // (dist/**/*.js), not just directories. Appending "/" would mangle them.
        return pkg.files.filter((file) => typeof file === "string");
      }
    } catch {
      // fall through
    }
  }

  // Only the directory-based fallback gets a synthesised trailing slash.
  return packageRoots.map((root) => (root.endsWith("/") ? root : `${root}/`));
}

/**
 * Whether the repo ships multiple independently-versioned skill bundles under a
 * top-level dir (the signal that `bundleVersioning` is relevant). Looks for a
 * directory containing at least one subdir with a SKILL.md.
 * @param {string} repoRoot
 * @returns {string | null} the bundle root dir, or null
 */
function detectBundleRoot(repoRoot) {
  for (const candidate of ["skills", "packages"]) {
    const directory = join(repoRoot, candidate);
    if (!existsSync(directory)) {
      continue;
    }

    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    const hasBundle = entries.some(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(directory, entry.name, "SKILL.md")),
    );
    if (hasBundle) {
      return candidate;
    }
  }

  return null;
}

/**
 * Build a memoised `detect(key)` for a host repo.
 * @param {object} params
 * @param {string} params.repoRoot host repo root the detectors scan
 * @param {{ linearTeamName?: string, linearWorkspaceSlug?: string, issueKeys?: string[] }} [params.linearFacts]
 *   facts the script cannot derive from git/fs (supplied by Claude via the Linear MCP)
 * @returns {{ detect: (key: string) => ({ value: unknown } | null), has: (key: string) => boolean }}
 */
export function createDetectors({ linearFacts = {}, repoRoot }) {
  const cache = new Map();

  const registry = {
    baseBranch: () => ({ value: detectBaseBranch(repoRoot) }),
    bundleVersioning: () => {
      const root = detectBundleRoot(repoRoot);
      return root
        ? { value: { manifest: "package.json", root, skillFile: "SKILL.md" } }
        : null;
    },
    // changelogDir / fallbackPackage are structural conventions with sound
    // generic defaults (mirroring the changelog bundle's own DEFAULTS) — emit
    // them confidently rather than flagging for manual input.
    changelogDir: () => ({ value: "changelog" }),
    fallbackPackage: () => ({ value: "infrastructure" }),
    issueKeys: () => {
      const fromFacts = linearFacts.issueKeys;
      if (Array.isArray(fromFacts) && fromFacts.length > 0) {
        return { value: fromFacts };
      }

      const keys = detectIssueKeys(repoRoot);
      return keys.length > 0 ? { value: keys } : null;
    },
    linearTeamName: () =>
      linearFacts.linearTeamName ? { value: linearFacts.linearTeamName } : null,
    linearWorkspaceSlug: () =>
      linearFacts.linearWorkspaceSlug
        ? { value: linearFacts.linearWorkspaceSlug }
        : null,
    maxCiRounds: () => ({ value: MAX_CI_ROUNDS }),
    packageRoots: () => ({ value: detectPackageRoots(repoRoot) }),
    // Protect the detected default branch, not a hard-coded "main", so a
    // master/develop repo gets a consistent result.
    protectedBranches: () => ({ value: [detect("baseBranch").value] }),
    reviewBots: () => ({ value: [...REVIEW_BOTS] }),
    shippableManifestKeys: () => ({ value: [...SHIPPABLE_MANIFEST_KEYS] }),
    // Reuse the memoised packageRoots detection rather than re-reading
    // pnpm-workspace.yaml a second time.
    shippablePaths: () => ({
      value: detectShippablePaths(repoRoot, detect("packageRoots").value),
    }),
    // preflight self-detects its workspace map at runtime; never write it.
    workspaces: () => null,
  };

  function detect(key) {
    if (cache.has(key)) {
      return cache.get(key);
    }

    const detector = registry[key];
    const result = detector ? detector() : null;
    cache.set(key, result);
    return result;
  }

  return { detect, has: (key) => key in registry };
}
