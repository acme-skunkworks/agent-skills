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

  try {
    cached = { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_URL, "utf8")) };
  } catch {
    cached = { ...DEFAULTS };
  }

  return cached;
}
