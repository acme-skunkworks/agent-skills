// Load the bundle's config.json (issue-ID prefixes, Linear workspace slug, base
// branch). Resolved relative to THIS module — `config.json` sits at the bundle
// root, two levels up from scripts/lib/ — not relative to cwd, which is the
// consumer repo root where the `changelog/` directory lives.
//
// Zero-deps: a plain JSON read with sensible ACME defaults if the file is
// missing or unreadable, so a partially-configured bundle still runs.

import { readFileSync } from "node:fs";

const CONFIG_URL = new URL("../../config.json", import.meta.url);

const DEFAULTS = {
  issueKeys: ["ASW", "AKW", "SKW"],
  linearWorkspaceSlug: "goose-and-hobbes",
  baseBranch: "main",
};

let cached;

/**
 * @returns {{ issueKeys: string[], linearWorkspaceSlug: string, baseBranch: string }}
 */
export function loadConfig() {
  if (cached) {
    return cached;
  }

  let raw;
  try {
    raw = readFileSync(CONFIG_URL, "utf8");
  } catch (err) {
    // A missing file is fine — fall back to defaults so a partially-configured
    // bundle still runs. Any other read error (e.g. EACCES) is real: surface it.
    if (err.code === "ENOENT") {
      cached = { ...DEFAULTS };
      return cached;
    }
    throw err;
  }

  // A present-but-malformed config is a mistake the author needs to see, not
  // something to mask by silently reverting to ACME defaults.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON in ${CONFIG_URL.pathname}: ${err.message}`);
    throw err;
  }
  cached = { ...DEFAULTS, ...parsed };
  return cached;
}
