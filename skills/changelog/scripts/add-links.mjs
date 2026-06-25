#!/usr/bin/env node
import { loadConfig } from "./lib/config.mjs";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";

const {
  linearWorkspaceSlug: WORKSPACE,
  issueKeys: TEAM_KEYS,
  changelogDir: CHANGELOG_DIR,
} = loadConfig();

/**
 * Escape regex metacharacters so a configured key such as `C++` or `MY.KEY`
 * can't throw at construction or silently widen the match.
 * @param {string} s
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// `null` when no issue keys are configured: an empty alternation would match the
// empty string before every `-<digits>` and inject bogus links (e.g. `-2`).
const ISSUE_RE =
  TEAM_KEYS.length > 0
    ? new RegExp(`\\b(?:${TEAM_KEYS.map(escapeRegex).join("|")})-\\d+\\b`, "g")
    : null;
const FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]*`/g;
const ALREADY_LINKED_RE = /\[[^\]]*\]\([^)]*\)/g;
// Reference-link definition lines — `[ASW-123]: <url>` at line-start, plus any
// indented continuation lines. The label here is the definition's key, not prose,
// so masking it stops `ISSUE_RE` rewriting it into `[[ASW-123](url)]: <url>` and
// breaking the reference. Must run before `REFERENCE_LINKED_RE` so a definition
// is never partially consumed as an in-text label.
const REFERENCE_DEFINITION_RE = /^\[[^\]]+\]:[^\n]*(?:\n[ \t]+[^\n]*)*/gm;
// Reference-style links — `[text][ref]` and the collapsed `[text][]` — also
// already point at a definition, so mask them too. Without this, `ISSUE_RE`
// rewrites inside the label (`[ASW-1][1]` -> `[[ASW-1](url)][1]`) and re-runs
// compound the corruption.
const REFERENCE_LINKED_RE = /\[[^\]]*\]\[[^\]]*\]/g;

function buildUrl(id) {
  return `https://linear.app/${WORKSPACE}/issue/${id}`;
}

export function rewriteBody(body) {
  if (!ISSUE_RE) {
    return body;
  }

  // Mask fenced/inline code and existing links so issue-like text inside them
  // isn't linkified. Tokens are delimited with NUL bytes, which cannot occur in
  // a UTF-8 text file, so a token can never collide with real prose on restore
  // (the previous bare `FENCE0`/`INLINE1`/`LINK2` tokens could).
  const masks = [];
  const mask = (m) => {
    masks.push(m);
    return `\x00CR_MASK_${masks.length - 1}\x00`;
  };

  const masked = body
    .replace(FENCE_RE, mask)
    .replace(INLINE_CODE_RE, mask)
    .replace(ALREADY_LINKED_RE, mask)
    .replace(REFERENCE_DEFINITION_RE, mask)
    .replace(REFERENCE_LINKED_RE, mask)
    .replace(ISSUE_RE, (id) => `[${id}](${buildUrl(id)})`);

  return masked.replace(/\x00CR_MASK_(\d+)\x00/g, (_, i) => masks[Number(i)]);
}

export function splitFrontmatter(raw) {
  // Match the opening/closing `---` fences with either LF or CRLF endings so a
  // file authored on Windows isn't treated as having no frontmatter (which
  // would let `rewriteBody` rewrite the frontmatter region too).
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!match) {
    return { fm: "", body: raw };
  }

  return { fm: match[0], body: raw.slice(match[0].length) };
}

function main() {
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

  const files = readdirSync(CHANGELOG_DIR)
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .map((n) => join(CHANGELOG_DIR, n));

  let touched = 0;
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const { fm, body } = splitFrontmatter(raw);
    const next = rewriteBody(body);
    if (next !== body) {
      writeFileSync(file, fm + next);
      touched++;
      console.log(`rewrote: ${file}`);
    }
  }

  console.log(`Linear link rewriting complete. ${touched} file(s) updated.`);
}

// Only run the filesystem pass when invoked as a CLI, not when imported (e.g.
// by unit tests exercising `rewriteBody`).
if (argv[1] && fileURLToPath(import.meta.url) === argv[1]) {
  main();
}
