#!/usr/bin/env node
import { parseFrontmatter } from "./lib/frontmatter.mjs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const CHANGELOG_DIR = "changelog";
const FILENAME_RE = /^(\d{8})-(\d{6})-([a-z0-9-]+)\.md$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SHA7_RE = /^[0-9a-f]{7}$/;
const ISSUE_RE = /^[A-Z]{2,}-\d+$/;
const CATEGORIES = new Set([
  "chore",
  "docs",
  "feature",
  "fix",
  "perf",
  "refactor",
]);
const MERGE_STRATEGIES = new Set(["merge", "rebase", "squash"]);
const SECTION_RE = /^##\s+(Breaking|Added|Changed|Fixed)\b/m;
const BREAKING_RE = /^##\s+Breaking\b/m;

const REQUIRED = [
  "title",
  "created_at",
  "branch",
  "author",
  "category",
  "breaking",
  "co_authors",
];

const errors = [];
function fail(file, msg) {
  errors.push(`${file}: ${msg}`);
}

function isInt(v) {
  return typeof v === "number" && Number.isInteger(v);
}

function isNonNegInt(v) {
  return isInt(v) && v >= 0;
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function validateEntry(file, raw) {
  const name = basename(file);

  if (!FILENAME_RE.test(name)) {
    fail(
      file,
      "filename must match YYYYMMDD-HHMMSS-<slug>.md (slug: [a-z0-9-]+)",
    );
    return;
  }

  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch (error) {
    fail(file, `frontmatter unparseable: ${error.message}`);
    return;
  }

  const fm = parsed.data ?? {};
  const body = parsed.content ?? "";

  for (const key of REQUIRED) {
    if (!(key in fm)) {
      fail(file, `missing required field: ${key}`);
    }
  }

  if (
    "title" in fm &&
    (typeof fm.title !== "string" || fm.title.trim() === "")
  ) {
    fail(file, "title must be a non-empty string");
  }

  if (
    "release_note" in fm &&
    fm.release_note !== null &&
    typeof fm.release_note !== "string"
  ) {
    fail(file, "release_note must be a string or null when present");
  }

  if ("created_at" in fm) {
    const v =
      typeof fm.created_at === "string"
        ? fm.created_at
        : (fm.created_at?.toISOString?.() ?? "");
    if (!ISO_UTC_RE.test(v)) {
      fail(
        file,
        `created_at must be ISO 8601 UTC with Z suffix (got ${JSON.stringify(fm.created_at)})`,
      );
    }
  }

  if (fm.merged_at != null && fm.merged_at !== "") {
    const v =
      typeof fm.merged_at === "string"
        ? fm.merged_at
        : (fm.merged_at?.toISOString?.() ?? "");
    if (!ISO_UTC_RE.test(v)) {
      fail(file, "merged_at must be ISO 8601 UTC with Z suffix when set");
    }
  }

  if (
    "branch" in fm &&
    (typeof fm.branch !== "string" || fm.branch.trim() === "")
  ) {
    fail(file, "branch must be a non-empty string");
  }

  if (fm.pr != null && fm.pr !== "" && (!isInt(fm.pr) || Number(fm.pr) <= 0)) {
    fail(file, "pr must be a positive integer when set");
  }

  if (fm.commit != null && fm.commit !== "" && !SHA7_RE.test(fm.commit)) {
    fail(file, "commit must be a 7-char hex SHA when set");
  }

  if (
    fm.merge_strategy != null &&
    fm.merge_strategy !== "" &&
    !MERGE_STRATEGIES.has(fm.merge_strategy)
  ) {
    fail(
      file,
      `merge_strategy must be one of: ${[...MERGE_STRATEGIES].join(", ")}`,
    );
  }

  if (
    "author" in fm &&
    (typeof fm.author !== "string" || fm.author.trim() === "")
  ) {
    fail(file, "author must be a non-empty string");
  }

  if ("co_authors" in fm && !isStringArray(fm.co_authors)) {
    fail(file, "co_authors must be an array of strings (use [] when none)");
  }

  if ("category" in fm && !CATEGORIES.has(fm.category)) {
    fail(file, `category must be one of: ${[...CATEGORIES].join(", ")}`);
  }

  if ("breaking" in fm && typeof fm.breaking !== "boolean") {
    fail(file, "breaking must be a boolean");
  }

  if ("issues" in fm) {
    if (isStringArray(fm.issues)) {
      for (const id of fm.issues) {
        if (!ISSUE_RE.test(id)) {
          fail(
            file,
            `issues entry ${JSON.stringify(id)} must match [A-Z]{2,}-\\d+`,
          );
        }
      }
    } else {
      fail(file, "issues must be an array of strings when present");
    }
  }

  // affected_packages is owned by the post-merge enrich step. The author emits
  // an empty array as a placeholder; the enrich step overwrites it with the
  // canonical list derived from PR files. Only enforce structure (string array).
  if (
    "affected_packages" in fm &&
    fm.affected_packages != null &&
    !isStringArray(fm.affected_packages)
  ) {
    fail(
      file,
      "affected_packages must be an array of strings (use [] when unpopulated)",
    );
  }

  // PR stats live under stats: { files_changed, loc_added, loc_removed }.
  const statKeys = ["files_changed", "loc_added", "loc_removed"];
  for (const k of statKeys) {
    if (k in fm) {
      fail(file, `${k} must be under stats, not top-level`);
    }
  }

  if (!("stats" in fm) || fm.stats == null) {
    fail(file, "missing required field: stats");
  } else if (typeof fm.stats !== "object" || Array.isArray(fm.stats)) {
    fail(file, "stats must be an object");
  } else {
    for (const k of statKeys) {
      if (
        k in fm.stats &&
        fm.stats[k] != null &&
        fm.stats[k] !== "" &&
        !isNonNegInt(fm.stats[k])
      ) {
        fail(file, `stats.${k} must be a non-negative integer when set`);
      }
    }
  }

  if (fm.breaking === true && !BREAKING_RE.test(body)) {
    fail(file, 'breaking: true requires a "## Breaking" section in the body');
  }

  if (!SECTION_RE.test(body)) {
    fail(
      file,
      "body must contain at least one of: ## Breaking | ## Added | ## Changed | ## Fixed",
    );
  }
}

function listEntries() {
  let stat;
  try {
    stat = statSync(CHANGELOG_DIR);
  } catch {
    console.error(`changelog directory not found: ${CHANGELOG_DIR}`);
    process.exit(2);
  }

  if (!stat.isDirectory()) {
    console.error(`${CHANGELOG_DIR} is not a directory`);
    process.exit(2);
  }

  return readdirSync(CHANGELOG_DIR)
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .map((n) => join(CHANGELOG_DIR, n));
}

const entries = listEntries();
for (const file of entries) {
  validateEntry(file, readFileSync(file, "utf8"));
}

if (errors.length > 0) {
  console.error(
    `Changelog validation failed with ${errors.length} error(s):\n`,
  );
  for (const e of errors) {
    console.error(`  - ${e}`);
  }

  process.exit(1);
}

console.log(
  `Changelog validation passed (${entries.length} entr${entries.length === 1 ? "y" : "ies"} checked).`,
);
