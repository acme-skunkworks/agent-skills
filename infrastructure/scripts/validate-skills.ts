#!/usr/bin/env -S npx tsx
// Validates the per-skill bundle metadata under `skills/<name>/` (A-364).
//
// Skills are NOT npm-published and NOT Changesets-managed (ADR-0002): each
// carries its own version OUT OF BAND, as a non-npm label. This guard makes
// that contract enforceable instead of merely documented, so the metadata
// can't silently drift across skills. For every `skills/<name>/`:
//
//   - package.json exists, with:
//       name    === `@acme-skunkworks/skill-<name>` (the `skill-` prefix +
//                   directory name — ADR-0001 Decision 1)
//       private === true (accidental-publish guard — these never go to npm)
//       version  is a semver string
//   - SKILL.md exists, with:
//       name             === the directory name (Agent Skills spec)
//       metadata.version === package.json version (the sanctioned mirror —
//                            ADR-0001 Decision 2; the two must agree)
//
// `skills-ref validate` (the skill-manifests CI job) already checks SKILL.md
// against the spec; this guard adds the ACME-specific package.json + version
// parity rules it doesn't cover.
//
// The pure `validateSkill(...)` returns an array of error strings (empty means
// valid), so it's trivially unit-testable; main() walks the directory.

import matter from "gray-matter";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const SKILLS_DIR = "skills";
export const SKILL_SCOPE = "@acme-skunkworks";

const SEMVER_RE =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Validate one skill bundle. `pkgRaw` / `skillRaw` are null when the file is
 * absent. Returns an array of human-readable error strings.
 */
export function validateSkill(
  directory: string,
  pkgRaw: null | string,
  skillRaw: null | string,
): string[] {
  const errors: string[] = [];
  function fail(message: string): void {
    errors.push(`${directory}: ${message}`);
  }

  if (skillRaw === null) {
    fail("missing SKILL.md");
  }

  if (pkgRaw === null) {
    fail("missing package.json");
    return errors;
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
  } catch (error) {
    fail(`package.json is not valid JSON: ${(error as Error).message}`);
    return errors;
  }

  const expectedName = `${SKILL_SCOPE}/skill-${directory}`;
  if (pkg.name !== expectedName) {
    fail(
      `package.json name must be "${expectedName}" (got ${JSON.stringify(pkg.name)})`,
    );
  }

  if (pkg.private !== true) {
    fail('package.json must set "private": true (skills are never published)');
  }

  const pkgVersion = pkg.version;
  if (typeof pkgVersion !== "string" || !SEMVER_RE.test(pkgVersion)) {
    fail(
      `package.json version must be a semver string (got ${JSON.stringify(pkgVersion)})`,
    );
  }

  if (skillRaw === null) {
    return errors;
  }

  let fm: Record<string, unknown>;
  try {
    fm = (matter(skillRaw).data ?? {}) as Record<string, unknown>;
  } catch (error) {
    fail(`SKILL.md frontmatter unparseable: ${(error as Error).message}`);
    return errors;
  }

  if (fm.name !== directory) {
    fail(
      `SKILL.md name must equal the directory name "${directory}" (got ${JSON.stringify(fm.name)})`,
    );
  }

  const metadata = (fm.metadata ?? {}) as Record<string, unknown>;
  const skillVersion = metadata.version;
  if (skillVersion === undefined) {
    fail(
      "SKILL.md metadata.version is missing (mirror the package.json version)",
    );
  } else if (
    typeof pkgVersion === "string" &&
    String(skillVersion) !== pkgVersion
  ) {
    fail(
      `SKILL.md metadata.version (${JSON.stringify(skillVersion)}) must equal package.json version (${JSON.stringify(pkgVersion)})`,
    );
  }

  return errors;
}

/**
 * Every dotted key path in a JSON object (recursing into nested objects, but not
 * arrays — array contents are values, not structure). `{a: 1, b: {c: 2}}` →
 * `["a", "b", "b.c"]`.
 */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(path, ...keyPaths(nested, path));
  }

  return out;
}

/**
 * When a bundle ships BOTH `config.json` and `config.example.json`, their key
 * structures must match — the example is the template a consumer copies over, so a
 * key in one but not the other means an adopter silently gets a stale or
 * incomplete config (A-538). Values may differ (the example carries placeholders);
 * only the key sets are compared, recursively. Skills that ship only one file
 * (e.g. `preflight`, whose config lives at the consumer root) are exempt. `*Raw`
 * are null when the file is absent.
 */
export function configKeyParityErrors(
  directory: string,
  configRaw: null | string,
  exampleRaw: null | string,
): string[] {
  if (configRaw === null || exampleRaw === null) {
    return [];
  }

  const errors: string[] = [];
  let config: unknown;
  let example: unknown;
  try {
    config = JSON.parse(configRaw);
  } catch (error) {
    errors.push(
      `${directory}: config.json is not valid JSON: ${(error as Error).message}`,
    );
  }

  try {
    example = JSON.parse(exampleRaw);
  } catch (error) {
    errors.push(
      `${directory}: config.example.json is not valid JSON: ${(error as Error).message}`,
    );
  }

  if (errors.length > 0) {
    return errors;
  }

  const configKeys = new Set(keyPaths(config));
  const exampleKeys = new Set(keyPaths(example));
  const onlyInConfig = [...configKeys].filter((key) => !exampleKeys.has(key));
  const onlyInExample = [...exampleKeys].filter((key) => !configKeys.has(key));

  if (onlyInConfig.length > 0) {
    errors.push(
      `${directory}: config.json has keys missing from config.example.json: ${onlyInConfig.join(", ")}`,
    );
  }

  if (onlyInExample.length > 0) {
    errors.push(
      `${directory}: config.example.json has keys missing from config.json: ${onlyInExample.join(", ")}`,
    );
  }

  return errors;
}

function listSkillDirectories(directory: string): string[] {
  let stat;
  try {
    stat = statSync(directory);
  } catch {
    console.error(`skills directory not found: ${directory}`);
    process.exit(2);
  }

  if (!stat.isDirectory()) {
    console.error(`${directory} is not a directory`);
    process.exit(2);
  }

  return (
    readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      // A directory is a skill bundle if it has either marker file; a bare dir
      // with neither is ignored (e.g. future non-bundle scaffolding).
      .filter(
        (name) =>
          existsSync(join(directory, name, "SKILL.md")) ||
          existsSync(join(directory, name, "package.json")),
      )
  );
}

function readOrNull(path: string): null | string {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function main(): void {
  const directories = listSkillDirectories(SKILLS_DIR);
  const errors: string[] = [];
  for (const directory of directories) {
    const base = join(SKILLS_DIR, directory);
    errors.push(
      ...validateSkill(
        directory,
        readOrNull(join(base, "package.json")),
        readOrNull(join(base, "SKILL.md")),
      ),
      ...configKeyParityErrors(
        directory,
        readOrNull(join(base, "config.json")),
        readOrNull(join(base, "config.example.json")),
      ),
    );
  }

  if (errors.length > 0) {
    console.error(`Skill validation failed with ${errors.length} error(s):\n`);
    for (const message of errors) {
      console.error(`  - ${message}`);
    }

    process.exit(1);
  }

  console.log(
    `Skill validation passed (${directories.length} skill${directories.length === 1 ? "" : "s"} checked).`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
