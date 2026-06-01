#!/usr/bin/env -S npx tsx
// Validates the pending Changesets entries under `.changeset/`.
//
// This repo versions a SINGLE published package — the root
// `@acme-skunkworks/agent-skills` (ADR-0002). It has no `pnpm-workspace.yaml`
// and no `workspaces` field, so Changesets only ever discovers the root. A
// changeset that names a per-skill package (`@acme-skunkworks/skill-<name>`)
// therefore points at a package Changesets cannot see — it silently no-ops or
// makes `pnpm changeset status` error (ASW-364). Skills carry their own
// non-npm version label in `SKILL.md` `metadata.version` + their private
// `package.json`; that is bumped by hand and never via a changeset.
//
// This guard fails the build loudly the moment a changeset names anything
// other than the root, so a mis-named package can't slip through and quietly
// fail to bump again. Empty-frontmatter (docs-only) changesets pass vacuously.
//
// The pure `validateEntry(name, raw)` returns an array of error strings (empty
// means valid), so it's trivially unit-testable; main() walks the directory.

import matter from "gray-matter";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export const CHANGESET_DIR = ".changeset";

// The only package Changesets manages in this repo. Keep in lockstep with the
// root package.json `name`. ADR-0002 records why this is the sole valid target.
export const ROOT_PACKAGE = "@acme-skunkworks/agent-skills";

const BUMPS = new Set(["major", "minor", "patch"]);

type Frontmatter = Record<string, unknown>;

/**
 * Validate one changeset entry. Returns an array of human-readable error
 * strings (empty means valid).
 */
export function validateEntry(name: string, raw: string): string[] {
  const errors: string[] = [];
  function fail(message: string): void {
    errors.push(`${name}: ${message}`);
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (error) {
    fail(`frontmatter unparseable: ${(error as Error).message}`);
    return errors;
  }

  const fm = (parsed.data ?? {}) as Frontmatter;

  // Empty frontmatter is the sanctioned "docs/tooling-only, no bump" escape
  // hatch — nothing to check.
  for (const [pkg, bump] of Object.entries(fm)) {
    if (pkg !== ROOT_PACKAGE) {
      fail(
        `names package "${pkg}" — only "${ROOT_PACKAGE}" is valid (skills version via SKILL.md metadata.version, not changesets; see ADR-0002)`,
      );
    }

    if (!BUMPS.has(String(bump))) {
      fail(
        `bump for "${pkg}" must be one of: ${[...BUMPS].join(", ")} (got ${JSON.stringify(bump)})`,
      );
    }
  }

  return errors;
}

function listEntries(directory: string): string[] {
  let stat;
  try {
    stat = statSync(directory);
  } catch {
    console.error(`changeset directory not found: ${directory}`);
    process.exit(2);
  }

  if (!stat.isDirectory()) {
    console.error(`${directory} is not a directory`);
    process.exit(2);
  }

  return readdirSync(directory)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => join(directory, name));
}

function main(): void {
  const files = listEntries(CHANGESET_DIR);
  const errors: string[] = [];
  for (const file of files) {
    errors.push(...validateEntry(basename(file), readFileSync(file, "utf8")));
  }

  if (errors.length > 0) {
    console.error(
      `Changeset validation failed with ${errors.length} error(s):\n`,
    );
    for (const message of errors) {
      console.error(`  - ${message}`);
    }

    process.exit(1);
  }

  console.log(
    `Changeset validation passed (${files.length} entr${files.length === 1 ? "y" : "ies"} checked).`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
