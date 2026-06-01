#!/usr/bin/env node
/**
 * Map branch-introduced line numbers per file from git diff hunks.
 */
import { spawnSync } from "node:child_process";

/**
 * @param {string} mergeBase
 * @returns {Map<string, Set<number>>}
 */
export function getIntroducedLinesPerFile(mergeBase) {
  const result = spawnSync(
    "git",
    ["diff", `${mergeBase}...HEAD`, "-U0", "--no-color"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error("preflight: git diff for line classification failed");
  }

  /** @type {Map<string, Set<number>>} */
  const byFile = new Map();
  let currentFile = null;

  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("+++ b/")) {
      const path = line.slice("+++ b/".length);
      currentFile = path === "/dev/null" ? null : path;
      continue;
    }

    if (!line.startsWith("@@") || !currentFile) {
      continue;
    }

    const plus = line.match(/\+(\d+)(?:,(\d+))?/);
    if (!plus) {
      continue;
    }

    const start = Number(plus[1]);
    const count = plus[2] === undefined ? 1 : Number(plus[2]);
    if (count === 0) {
      continue;
    }

    if (!byFile.has(currentFile)) {
      byFile.set(currentFile, new Set());
    }

    const lines = byFile.get(currentFile);
    for (let i = 0; i < count; i++) {
      lines.add(start + i);
    }
  }

  return byFile;
}

/**
 * @param {Map<string, Set<number>>} introducedByFile
 * @param {string} filePath
 * @param {number} line
 */
export function isIntroducedLine(introducedByFile, filePath, line) {
  const normalized = filePath.replace(/^\.\//, "");
  const introduced = introducedByFile.get(normalized);
  if (!introduced) {
    return false;
  }

  return introduced.has(line);
}
