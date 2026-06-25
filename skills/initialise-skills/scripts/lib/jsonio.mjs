// Order-preserving read/serialise for a skill's config.json (SK-409).
//
// The reconcile must be idempotent: a second run with no new facts has to leave
// every config.json byte-for-byte identical, or `git status` would churn and the
// "never clobber" promise would ring hollow. So writes mutate only the keys that
// changed, keep the consumer's existing key ORDER, append any newly-inferred keys
// at the end, and preserve the file's indentation and trailing newline.
//
// Zero-deps: plain JSON + string work, no formatter dependency.

import { readFileSync } from "node:fs";

/**
 * A parsed config.json plus the formatting facts needed to round-trip it without
 * reflowing untouched keys.
 * @typedef {{
 *   exists: boolean,
 *   data: Record<string, unknown>,
 *   keyOrder: string[],
 *   indent: number,
 *   trailingNewline: boolean,
 * }} ParsedConfig
 */

/**
 * Detect the indentation (in spaces) of the first indented line. Defaults to 2 —
 * the repo convention — when the object is empty or single-line.
 * @param {string} raw
 * @returns {number}
 */
function detectIndent(raw) {
  const match = raw.match(/\n([ \t]+)\S/);
  if (!match) {
    return 2;
  }
  const ws = match[1];
  // A tab indents at one level; spaces count the run. We re-emit with spaces
  // either way (JSON.stringify only takes a space count or a string) — tabs are
  // rare in these configs and not worth preserving exactly.
  return ws.startsWith("\t") ? 2 : ws.length;
}

/**
 * Parse a config.json string, capturing key order + formatting. A malformed or
 * non-object body throws — callers decide whether to skip the file.
 * @param {string} raw
 * @returns {ParsedConfig}
 */
export function parseConfig(raw) {
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("config.json must contain a JSON object");
  }
  return {
    exists: true,
    data,
    keyOrder: Object.keys(data),
    indent: detectIndent(raw),
    trailingNewline: raw.endsWith("\n"),
  };
}

/**
 * Read a config.json from disk. A missing file yields an empty, writable shape so
 * the merge can treat "no config yet" uniformly with "config present".
 * @param {string} path
 * @returns {ParsedConfig}
 */
export function readConfig(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return {
        exists: false,
        data: {},
        keyOrder: [],
        indent: 2,
        trailingNewline: true,
      };
    }
    throw err;
  }
  return parseConfig(raw);
}

/**
 * Serialise an updated config, preserving the original key order and appending
 * any keys not seen before (in the order given by `appendOrder`, else insertion
 * order of `data`). Indentation and trailing newline match `parsed`.
 * @param {ParsedConfig} parsed the original parsed config (for order + formatting)
 * @param {Record<string, unknown>} data the full key/value set to write
 * @param {string[]} [appendOrder] preferred order for keys new to the file
 * @returns {string}
 */
export function serialiseConfig(parsed, data, appendOrder = []) {
  const seen = new Set(parsed.keyOrder);
  const ordered = {};

  // 1. Existing keys, in their original order, that survive in `data`.
  for (const key of parsed.keyOrder) {
    if (key in data) {
      ordered[key] = data[key];
    }
  }
  // 2. New keys, preferring `appendOrder`, then any remaining insertion order.
  const newKeys = Object.keys(data).filter((k) => !seen.has(k));
  const orderedNew = [
    ...appendOrder.filter((k) => newKeys.includes(k)),
    ...newKeys.filter((k) => !appendOrder.includes(k)),
  ];
  for (const key of orderedNew) {
    ordered[key] = data[key];
  }

  const body = JSON.stringify(ordered, null, parsed.indent);
  return parsed.trailingNewline ? `${body}\n` : body;
}
