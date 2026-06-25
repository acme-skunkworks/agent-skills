#!/usr/bin/env node
// initialise-skills CLI (SK-409).
//
// Scans a host repo and reconciles every installed skill's config.json with
// detected facts. Deterministic git/fs detection + a three-way merge live here
// and in lib/; the Linear facts the script can't derive (team name, workspace
// slug) and the confirmation gate are owned by the SKILL.md orchestration, which
// pipes those facts — and any per-key drift opt-ins — in as stdin JSON.
//
//   node scripts/initialise.mjs [--dry-run|--write] [--json]
//                               [--repo-root <path>] [--skills-dir <path>]
//   echo '{"facts":{"linearTeamName":"…"},"acceptDrift":{"changelog":["baseBranch"]}}' \
//     | node scripts/initialise.mjs --write --json
//
// Exit codes: 0 success; 2 usage/IO error.

import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

import { createDetectors } from "./lib/detectors.mjs";
import { discoverSkills } from "./lib/discover.mjs";
import { mergeConfig } from "./lib/merge.mjs";
import { serialiseConfig } from "./lib/jsonio.mjs";
import { buildReport, formatHuman } from "./lib/report.mjs";

/** A value-taking flag given as the last argument has no value — fail clearly
 * rather than letting `undefined` flow into the detectors. */
function requireValue(flag, value) {
  if (value === undefined) {
    console.error(`initialise-skills: ${flag} requires a value`);
    process.exit(2);
  }
  return value;
}

function parseArgs(argv) {
  const opts = { write: false, json: false, repoRoot: process.cwd(), skillsDir: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--write") opts.write = true;
    else if (arg === "--dry-run") opts.write = false;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--repo-root") opts.repoRoot = requireValue(arg, argv[++i]);
    else if (arg === "--skills-dir") opts.skillsDir = requireValue(arg, argv[++i]);
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else {
      console.error(`initialise-skills: unknown argument "${arg}"`);
      process.exit(2);
    }
  }
  return opts;
}

/**
 * Read `{ facts, acceptDrift }` from stdin when it is piped (not a TTY). Returns
 * empty defaults otherwise, so an interactive dry-run needs no input.
 */
function readStdinPayload() {
  if (process.stdin.isTTY) {
    return { facts: {}, acceptDrift: {} };
  }
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    return { facts: {}, acceptDrift: {} };
  }
  if (!raw.trim()) {
    return { facts: {}, acceptDrift: {} };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`initialise-skills: could not parse stdin JSON: ${err.message}`);
    process.exit(2);
  }
  return {
    facts: parsed.facts && typeof parsed.facts === "object" ? parsed.facts : {},
    acceptDrift: parsed.acceptDrift && typeof parsed.acceptDrift === "object" ? parsed.acceptDrift : {},
  };
}

/** Drift keys accepted for a given skill: keyed by skill name or its config path. */
function acceptedDriftFor(skill, acceptDrift, repoRoot) {
  const rel = relative(repoRoot, skill.configPath);
  return [...new Set([...(acceptDrift[skill.name] ?? []), ...(acceptDrift[rel] ?? [])])];
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log("Usage: node scripts/initialise.mjs [--dry-run|--write] [--json] [--repo-root <p>] [--skills-dir <p>]");
    return;
  }

  const { facts, acceptDrift } = readStdinPayload();
  const skills = discoverSkills(opts.skillsDir);
  const { detect } = createDetectors({ repoRoot: opts.repoRoot, linearFacts: facts });

  const skillReports = [];
  for (const skill of skills) {
    if (skill.malformed) {
      skillReports.push({
        name: skill.name,
        configPath: relative(opts.repoRoot, skill.configPath),
        malformed: true,
        results: {},
      });
      continue;
    }

    const accepted = acceptedDriftFor(skill, acceptDrift, opts.repoRoot);
    const { results, data, changed } = mergeConfig({
      example: skill.example,
      config: skill.config.data,
      detect,
      acceptDrift: accepted,
    });

    if (opts.write && changed) {
      const text = serialiseConfig(skill.config, data, Object.keys(skill.example));
      try {
        writeFileSync(skill.configPath, text);
      } catch (err) {
        console.error(`initialise-skills: could not write ${skill.configPath}: ${err.message}`);
        process.exit(2);
      }
    }

    skillReports.push({
      name: skill.name,
      configPath: relative(opts.repoRoot, skill.configPath),
      malformed: false,
      results,
    });
  }

  const report = buildReport(skillReports, opts.write);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatHuman(report));
  }
}

main();
