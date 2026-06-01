// Zero-deps YAML-frontmatter parser/serialiser for the changelog corpus.
//
// Carries no third-party npm import so it can be lifted wholesale into this
// skill bundle. It is NOT a general YAML implementation — it handles exactly the
// subset the changelog frontmatter uses:
//
//   - plain / single- / double-quoted string scalars
//   - integers, booleans, the `null` literal, and bare `key:` (-> null)
//   - one folded/literal block scalar (`>-` `>` `|` `|-`) for `release_note`
//   - inline arrays (`[]`, `["a", b]`) and block arrays (`- item`)
//   - one level of nested mapping (`stats:`)
//
// API mirrors gray-matter's so call sites change minimally:
//   parseFrontmatter(raw)            -> { data, content }
//   stringifyFrontmatter(content, d) -> "---\n<yaml>\n---\n<content>"

const FENCE = "---";

// --- parsing ---------------------------------------------------------------

function indentOf(line) {
  return line.length - line.trimStart().length;
}

// Parse a scalar token (the text after `key:` or an array item).
function parseScalar(token) {
  const t = token.trim();
  if (t === "" || t === "null" || t === "~") {
    return null;
  }

  if (t === "true") {
    return true;
  }

  if (t === "false") {
    return false;
  }

  if (/^-?\d+$/.test(t)) {
    return Number.parseInt(t, 10);
  }

  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
    return t.slice(1, -1).replaceAll("''", "'");
  }

  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    // Unescape in a single left-to-right pass so an escaped backslash (`\\`)
    // can't have its trailing char re-consumed by a later rule (e.g. `\\n`
    // must become `\n`, not a newline).
    return t.slice(1, -1).replace(/\\(.)/g, (_, c) => (c === "n" ? "\n" : c));
  }

  return t;
}

// Parse an inline array body (the text between the surrounding brackets).
function parseInlineArray(body) {
  const inner = body.trim();
  if (inner === "") {
    return [];
  }

  return inner.split(",").map((item) => parseScalar(item));
}

// Collect an indented block following a `key:` / block-scalar header, returning
// the consumed lines (those more indented than `parentIndent`) and the next index.
function collectBlock(lines, start, parentIndent) {
  const block = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      block.push(line);
      i++;
      continue;
    }

    if (indentOf(line) <= parentIndent) {
      break;
    }

    block.push(line);
    i++;
  }

  // Drop trailing blank lines that belong to the gap before the next key.
  while (block.length > 0 && block.at(-1).trim() === "") {
    block.pop();
  }

  return { block, next: i };
}

// Fold/keep a block scalar per its indicator (`>` folds newlines to spaces,
// `|` keeps them; a trailing `-` strips the final newline, which we always do
// here since the corpus only ever uses `>-`).
function parseBlockScalar(indicator, block) {
  if (block.length === 0) {
    return "";
  }

  const minIndent = Math.min(
    ...block.filter((l) => l.trim() !== "").map((l) => indentOf(l)),
  );
  const dedented = block.map((l) => l.slice(minIndent));
  const folded = indicator.startsWith(">");
  return folded
    ? dedented.join(" ").replace(/\s+/g, " ").trim()
    : dedented.join("\n");
}

function parseMapping(lines, startIndent) {
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    const colon = line.indexOf(":");
    const key = line.slice(indentOf(line), colon).trim();
    const rest = line.slice(colon + 1).trim();
    i++;

    if (
      rest === "" ||
      rest === ">" ||
      rest === ">-" ||
      rest === "|" ||
      rest === "|-"
    ) {
      const { block, next } = collectBlock(lines, i, startIndent);
      i = next;
      if (rest === "") {
        // Could be a block array, a nested mapping, or a bare null.
        if (block.length === 0) {
          data[key] = null;
        } else if (
          block[0].trimStart().startsWith("- ") ||
          block[0].trim() === "-"
        ) {
          data[key] = block.map((l) =>
            parseScalar(l.trimStart().replace(/^-\s?/, "")),
          );
        } else {
          const childIndent = indentOf(block[0]);
          data[key] = parseMapping(block, childIndent);
        }
      } else {
        data[key] = parseBlockScalar(rest, block);
      }

      continue;
    }

    if (rest.startsWith("[") && rest.endsWith("]")) {
      data[key] = parseInlineArray(rest.slice(1, -1));
      continue;
    }

    data[key] = parseScalar(rest);
  }

  return data;
}

// Matches a leading `---` fence, the frontmatter body (group 1, non-greedy up to
// the first closing fence on its own line), the closing fence, and its trailing
// newline. `content` is the exact remainder, so the markdown body is preserved
// byte-for-byte and round-trips are idempotent — only the frontmatter is rewritten.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

export function parseFrontmatter(raw) {
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    return { data: {}, content: text };
  }

  const fmLines = match[1].split("\n");
  const content = text.slice(match[0].length);
  return { data: parseMapping(fmLines, 0), content };
}

// --- serialising -----------------------------------------------------------

const INDICATORS = new Set([
  "!",
  '"',
  "#",
  "%",
  "&",
  "'",
  "*",
  ",",
  "-",
  ":",
  ">",
  "?",
  "@",
  "[",
  "]",
  "`",
  "{",
  "|",
  "}",
]);

function reparsesAsNonString(str) {
  // True when an unquoted emit of this string would parse back as something
  // other than a string (bool/int/null) or as a date-shaped token worth quoting.
  if (
    str === "" ||
    str === "null" ||
    str === "~" ||
    str === "true" ||
    str === "false"
  ) {
    return true;
  }

  if (/^-?\d+$/.test(str)) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}/.test(str);
}

function needsQuoting(str) {
  if (str.length === 0) {
    return true;
  }

  if (str !== str.trim()) {
    return true;
  }

  if (INDICATORS.has(str[0]) || str.startsWith("- ")) {
    return true;
  }

  if (str.includes(": ") || str.includes(" #") || str.includes("\n")) {
    return true;
  }

  return reparsesAsNonString(str);
}

function serialiseString(str) {
  if (!needsQuoting(str)) {
    return str;
  }

  if (str.includes("\n")) {
    const escaped = str
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("\n", "\\n");
    return `"${escaped}"`;
  }

  return `'${str.replaceAll("'", "''")}'`;
}

function serialiseScalar(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return serialiseString(String(value));
}

function serialiseValue(key, value, lines) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${key}: []`);
      return;
    }

    lines.push(`${key}:`);
    for (const item of value) {
      lines.push(`  - ${serialiseScalar(item)}`);
    }

    return;
  }

  if (value !== null && typeof value === "object") {
    lines.push(`${key}:`);
    for (const [k, v] of Object.entries(value)) {
      const child = serialiseScalar(v);
      lines.push(child === "" ? `  ${k}:` : `  ${k}: ${child}`);
    }

    return;
  }

  const emitted = serialiseScalar(value);
  lines.push(emitted === "" ? `${key}:` : `${key}: ${emitted}`);
}

export function stringifyFrontmatter(content, data) {
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    serialiseValue(key, value, lines);
  }

  return `${FENCE}\n${lines.join("\n")}\n${FENCE}\n${content}`;
}
