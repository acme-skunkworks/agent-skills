#!/usr/bin/env node
import { loadConfig } from "./lib/config.mjs";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CHANGELOG_DIR = "changelog";
const { linearWorkspaceSlug: WORKSPACE, issueKeys: TEAM_KEYS } = loadConfig();

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

function buildUrl(id) {
  return `https://linear.app/${WORKSPACE}/issue/${id}`;
}

function rewriteBody(body) {
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
    .replace(ISSUE_RE, (id) => `[${id}](${buildUrl(id)})`);

  return masked.replace(/\x00CR_MASK_(\d+)\x00/g, (_, i) => masks[Number(i)]);
}

function splitFrontmatter(raw) {
  // Match the opening/closing `---` fences with either LF or CRLF endings so a
  // file authored on Windows isn't treated as having no frontmatter (which
  // would let `rewriteBody` rewrite the frontmatter region too).
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!match) {
    return { fm: "", body: raw };
  }

  return { fm: match[0], body: raw.slice(match[0].length) };
}

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
