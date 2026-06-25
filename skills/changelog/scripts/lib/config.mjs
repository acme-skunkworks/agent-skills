// Load the bundle's config.json (issue-ID prefixes, Linear workspace slug, base
// branch, changelog directory, monorepo package mapping). Resolved relative to
// THIS module — `config.json` sits at the bundle root, two levels up from
// scripts/lib/ — not relative to cwd, which is the consumer repo root where the
// `changelog/` directory lives.
//
// Zero-deps: a plain JSON read. Identity values (`issueKeys`,
// `linearWorkspaceSlug`) have NO default — a foreign repo that silently inherited
// ACME's keys/slug would emit wrong issue links and detection, so a missing
// config or a missing identity key FAILS LOUDLY. Structural conventions
// (`baseBranch`, `changelogDir`, `packageRoots`, `fallbackPackage`) keep generic,
// non-ACME defaults a consumer can override.

import { readFileSync } from "node:fs";

const CONFIG_URL = new URL("../../config.json", import.meta.url);

// Generic, non-ACME structural defaults. Applied only when the key is absent;
// every one is overridable in config.json.
const DEFAULTS = {
  baseBranch: "main",
  changelogDir: "changelog",
  packageRoots: ["apps", "packages", "services"],
  fallbackPackage: "infrastructure",
};

let cached;

function fail(message) {
  const hint = `Set it in ${CONFIG_URL.pathname} (copy config.example.json and fill it in).`;
  throw new Error(`changelog config: ${message} ${hint}`);
}

/**
 * @returns {{
 *   issueKeys: string[],
 *   linearWorkspaceSlug: string,
 *   baseBranch: string,
 *   changelogDir: string,
 *   packageRoots: string[],
 *   fallbackPackage: string,
 * }}
 */
export function loadConfig() {
  if (cached) {
    return cached;
  }

  let raw;
  try {
    raw = readFileSync(CONFIG_URL, "utf8");
  } catch (err) {
    // A missing config.json used to fall back to ACME defaults silently. The
    // identity keys have no safe default, so a foreign repo must be told to
    // create one rather than inherit ACME's values.
    if (err.code === "ENOENT") {
      fail("config.json not found.");
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON in ${CONFIG_URL.pathname}: ${err.message}`);
    throw err;
  }

  // Required identity values — no default; fail loudly so a consuming repo can't
  // silently ship ACME's issue keys or workspace slug.
  if (
    !Array.isArray(parsed.issueKeys) ||
    parsed.issueKeys.length === 0 ||
    !parsed.issueKeys.every((k) => typeof k === "string" && k.length > 0)
  ) {
    fail("`issueKeys` must be a non-empty array of strings.");
  }
  if (
    typeof parsed.linearWorkspaceSlug !== "string" ||
    parsed.linearWorkspaceSlug.length === 0
  ) {
    fail("`linearWorkspaceSlug` must be a non-empty string.");
  }

  cached = { ...DEFAULTS, ...parsed };
  return cached;
}
