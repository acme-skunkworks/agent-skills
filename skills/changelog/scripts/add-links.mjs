#!/usr/bin/env node
import { loadConfig } from "./lib/config.mjs";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CHANGELOG_DIR = "changelog";
const { linearWorkspaceSlug: WORKSPACE, issueKeys: TEAM_KEYS } = loadConfig();
const ISSUE_RE = new RegExp(`\\b(?:${TEAM_KEYS.join("|")})-\\d+\\b`, "g");
const FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]*`/g;
const ALREADY_LINKED_RE = /\[[^\]]*\]\([^)]*\)/g;

function buildUrl(id) {
  return `https://linear.app/${WORKSPACE}/issue/${id}`;
}

function rewriteBody(body) {
  const masks = [];
  let masked = body
    .replace(FENCE_RE, (m) => {
      masks.push(m);
      return `FENCE${masks.length - 1}`;
    })
    .replace(INLINE_CODE_RE, (m) => {
      masks.push(m);
      return `INLINE${masks.length - 1}`;
    })
    .replace(ALREADY_LINKED_RE, (m) => {
      masks.push(m);
      return `LINK${masks.length - 1}`;
    });

  masked = masked.replace(ISSUE_RE, (id) => `[${id}](${buildUrl(id)})`);

  return masked
    .replace(/FENCE(\d+)/g, (_, i) => masks[Number(i)])
    .replace(/INLINE(\d+)/g, (_, i) => masks[Number(i)])
    .replace(/LINK(\d+)/g, (_, i) => masks[Number(i)]);
}

function splitFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { fm: "", body: raw };
  }

  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) {
    return { fm: "", body: raw };
  }

  return { fm: raw.slice(0, end + 5), body: raw.slice(end + 5) };
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
