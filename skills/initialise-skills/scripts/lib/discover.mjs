// Locate the sibling skill bundles installed alongside this one (SK-409).
//
// Where bundles live is install-dependent: `skills add` may vendor them under
// `.claude/skills/`, `.agents/skills/`, or a repo's own `skills/`. We resolve the
// directory that CONTAINS this bundle (two levels up from scripts/lib/initialise
// modules — i.e. the install root holding every sibling bundle dir) from the
// module URL, not from cwd. An explicit override (`--skills-dir`) wins, for tests
// and unusual layouts.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseConfig, readConfig } from "./jsonio.mjs";

// Skills that configure themselves and so must NOT get a generated config.json.
// `preflight` reads an OPTIONAL `preflight.config.json` at the consumer repo ROOT
// (not an in-bundle config.json) and auto-detects base branch + workspaces when
// it is absent — so writing skills/preflight/config.json would create a file it
// never reads. Its config.example.json documents that root-level override only.
// (Future: a skill could declare this in its SKILL.md metadata; hardcoded for now.)
const SELF_CONFIGURING = new Set(["preflight"]);

/**
 * The directory holding sibling bundles: the parent of THIS bundle's own
 * directory. `import.meta.url` here is …/<skillsDir>/initialise-skills/scripts/lib/discover.mjs,
 * so four `dirname` hops reach <skillsDir>.
 * @returns {string}
 */
export function defaultSkillsDir() {
  const here = dirname(fileURLToPath(import.meta.url)); // scripts/lib
  const bundleDir = dirname(dirname(here)); // skills/initialise-skills
  return dirname(bundleDir); // skills/
}

/**
 * @typedef {{
 *   name: string,          // bundle directory name
 *   dir: string,           // absolute bundle dir
 *   configPath: string,    // absolute config.json path (may not exist yet)
 *   example: Record<string, unknown>,  // config.example.json contents (the key set)
 *   config: import('./jsonio.mjs').ParsedConfig,  // existing config.json (exists:false when absent)
 *   malformed: boolean,    // config.json present but unparseable → skip writes
 * }} InstalledSkill
 */

/**
 * Discover every installed skill that ships a `config.example.json` (i.e. has a
 * config surface to reconcile). This bundle itself is skipped (it has no config).
 * @param {string} [skillsDir]
 * @returns {InstalledSkill[]}
 */
export function discoverSkills(skillsDir = defaultSkillsDir()) {
  if (!existsSync(skillsDir)) {
    return [];
  }

  /** @type {InstalledSkill[]} */
  const skills = [];
  const entries = readdirSync(skillsDir, { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  );

  for (const entry of entries) {
    if (SELF_CONFIGURING.has(entry.name)) {
      continue;
    }
    const dir = join(skillsDir, entry.name);
    const examplePath = join(dir, "config.example.json");
    // No config surface → nothing to reconcile (also skips initialise-skills).
    if (!existsSync(examplePath)) {
      continue;
    }

    let example;
    try {
      example = parseConfig(readFileSync(examplePath, "utf8")).data;
    } catch {
      // A malformed example means we can't know the key set — skip the skill.
      continue;
    }

    const configPath = join(dir, "config.json");
    let config;
    let malformed = false;
    try {
      config = readConfig(configPath);
    } catch {
      // config.json exists but is unparseable: don't risk clobbering it.
      config = { exists: true, data: {}, keyOrder: [], indent: 2, trailingNewline: true };
      malformed = true;
    }

    skills.push({ name: entry.name, dir, configPath, example, config, malformed });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}
