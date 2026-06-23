#!/usr/bin/env node
/**
 * Classify lint violations as introduced (branch) vs pre-existing.
 */
import {
  getIntroducedLinesPerFile,
  isIntroducedLine,
} from "./lib/diff-lines.mjs";
import { toRepoRelative } from "./lib/paths.mjs";

/**
 * @typedef {{ file: string; line: number; column?: number; ruleId?: string; message: string; source: 'eslint' | 'markdownlint' | 'actionlint' }} Violation
 * @typedef {{ introduced: Violation[]; preExisting: Violation[] }} Classified
 */

/**
 * @param {string} mergeBase
 * @param {Violation[]} violations
 * @returns {Classified}
 */
export function classifyViolations(mergeBase, violations) {
  const introducedByFile = getIntroducedLinesPerFile(mergeBase);
  /** @type {Violation[]} */
  const introduced = [];
  /** @type {Violation[]} */
  const preExisting = [];

  for (const v of violations) {
    if (isIntroducedLine(introducedByFile, v.file, v.line)) {
      introduced.push(v);
    } else {
      preExisting.push(v);
    }
  }

  return { introduced, preExisting };
}

/**
 * @param {string} eslintJson
 * @returns {Violation[]}
 */
export function parseEslintJson(eslintJson) {
  if (!eslintJson.trim()) {
    return [];
  }

  let data;
  try {
    data = JSON.parse(eslintJson);
  } catch {
    return [];
  }

  if (!Array.isArray(data)) {
    return [];
  }

  /** @type {Violation[]} */
  const violations = [];
  for (const result of data) {
    const file = toRepoRelative(result.filePath ?? "");
    for (const msg of result.messages ?? []) {
      // Drop severity 0 (off) only. Severity 1 (warn) is kept and counts as a
      // blocking violation when on an introduced line — preflight is
      // deliberately strict about warnings the branch adds.
      if (msg.severity === 0 || !msg.line) {
        continue;
      }

      violations.push({
        file,
        line: msg.line,
        column: msg.column,
        ruleId: msg.ruleId,
        message: msg.message,
        source: "eslint",
      });
    }
  }

  return violations;
}

/**
 * markdownlint-cli2 JSON: array of { fileName, lineNumber, ruleNames, ruleDescription, ... }
 * @param {string} mdJson
 * @returns {Violation[]}
 */
export function parseMarkdownlintJson(mdJson) {
  if (!mdJson.trim()) {
    return [];
  }

  let data;
  try {
    data = JSON.parse(mdJson);
  } catch {
    return [];
  }

  const items = Array.isArray(data) ? data : (data?.issues ?? []);
  if (!Array.isArray(items)) {
    return [];
  }

  /** @type {Violation[]} */
  const violations = [];
  for (const item of items) {
    const file = toRepoRelative(item.fileName ?? item.file ?? "");
    const line = item.lineNumber ?? item.line;
    if (!file || !line) {
      continue;
    }

    violations.push({
      file,
      line,
      ruleId: Array.isArray(item.ruleNames)
        ? item.ruleNames.join("/")
        : item.ruleName,
      message:
        item.ruleDescription ??
        item.ruleInformation ??
        "markdownlint violation",
      source: "markdownlint",
    });
  }

  return violations;
}

/**
 * actionlint outputs text to stderr; map line-based errors when present.
 *
 * Lines that don't match `file:line:col: message` are attributed to the single
 * workflow file when only one was passed, and otherwise silently dropped.
 * preflight's process-level guard exits 1 whenever actionlint exits non-zero
 * with no parseable violations, which catches the all-or-nothing failure case.
 * If a run emits a mix of parseable and unparseable lines the parseable ones
 * still surface and the unmatched lines remain dropped — in practice
 * actionlint's text format is consistent enough that this case is vanishingly
 * rare.
 * @param {string} stderr
 * @param {string[]} workflowFiles
 * @returns {Violation[]}
 */
export function parseActionlintText(stderr, workflowFiles) {
  /** @type {Violation[]} */
  const violations = [];
  const lines = stderr.split("\n").filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^([^:]+):(\d+):(\d+): (.+)$/);
    if (match) {
      violations.push({
        file: toRepoRelative(match[1]),
        line: Number(match[2]),
        column: Number(match[3]),
        message: match[4],
        source: "actionlint",
      });
      continue;
    }

    if (workflowFiles.length === 1) {
      violations.push({
        file: workflowFiles[0],
        line: 1,
        message: line,
        source: "actionlint",
      });
    }
  }

  return violations;
}
