// Render the reconcile report — both a human-readable summary and the JSON shape
// Claude parses to drive the Linear-fact and per-key drift-opt-in steps (SK-409).

/** Human-friendly labels + ordering for the per-key statuses. */
const STATUS_LABEL = {
  inferred: "inferred",
  unchanged: "unchanged",
  drift: "drift",
  "needs-manual-input": "needs-manual-input",
  "manual-kept": "manual-kept",
  "unknown-kept": "unknown-kept",
};

const STATUS_ORDER = [
  "inferred",
  "drift",
  "needs-manual-input",
  "manual-kept",
  "unknown-kept",
  "unchanged",
];

const fmt = (v) => (v === undefined ? "" : JSON.stringify(v));

/**
 * @typedef {{
 *   name: string,
 *   configPath: string,
 *   malformed: boolean,
 *   results: Record<string, import('./merge.mjs').KeyResult>,
 * }} SkillReport
 */

/**
 * Aggregate per-skill merge results into the report object.
 * @param {SkillReport[]} skillReports
 * @param {boolean} wrote whether this was a --write run
 * @returns {object}
 */
export function buildReport(skillReports, wrote) {
  const totals = {};
  const driftKeys = [];
  const manualKeys = [];

  const skills = skillReports.map((s) => {
    const keys = Object.entries(s.results).map(([key, r]) => {
      totals[r.status] = (totals[r.status] ?? 0) + 1;
      if (r.status === "drift") {
        driftKeys.push({ skill: s.name, configPath: s.configPath, key, kept: r.keep, detected: r.detected });
      }
      if (r.status === "needs-manual-input") {
        manualKeys.push({ skill: s.name, configPath: s.configPath, key });
      }
      return { key, ...r };
    });
    return { name: s.name, configPath: s.configPath, malformed: s.malformed, keys };
  });

  return { mode: wrote ? "write" : "dry-run", skills, totals, driftKeys, manualKeys };
}

/**
 * Format the report as human-readable text.
 * @param {ReturnType<typeof buildReport>} report
 * @returns {string}
 */
export function formatHuman(report) {
  const lines = [];
  const header =
    report.mode === "write"
      ? "initialise-skills — wrote inferred values"
      : "initialise-skills — dry run (no files written)";
  lines.push(header, "");

  for (const skill of report.skills) {
    if (skill.malformed) {
      lines.push(`${skill.configPath}  ⚠ existing config.json is unparseable — skipped`, "");
      continue;
    }
    lines.push(skill.configPath);
    const ordered = [...skill.keys].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.key.localeCompare(b.key),
    );
    for (const k of ordered) {
      const label = STATUS_LABEL[k.status].padEnd(20);
      const name = k.key.padEnd(22);
      let detail = "";
      if (k.status === "inferred") {
        detail = fmt(k.write);
      } else if (k.status === "drift") {
        detail = `keeps ${fmt(k.keep)} vs detected ${fmt(k.detected)}`;
      } else if (k.status === "needs-manual-input") {
        detail = "— provide a value (e.g. via Linear MCP)";
      } else if (k.status === "manual-kept" || k.status === "unknown-kept") {
        detail = `keeps ${fmt(k.keep)}`;
      }
      lines.push(`  ${label}${name}${detail}`.trimEnd());
    }
    lines.push("");
  }

  const t = report.totals;
  const summary = STATUS_ORDER.filter((s) => t[s]).map((s) => `${t[s]} ${STATUS_LABEL[s]}`).join(", ");
  lines.push(summary || "no keys to reconcile", "");

  if (report.mode === "dry-run") {
    if (report.driftKeys.length) {
      lines.push(
        `${report.driftKeys.length} drifted key(s) kept. To accept a detected value, re-run --write with that key in acceptDrift.`,
      );
    }
    if (report.manualKeys.length) {
      lines.push(
        `${report.manualKeys.length} key(s) need manual input: ${report.manualKeys
          .map((m) => `${m.skill}.${m.key}`)
          .join(", ")}.`,
      );
    }
  }

  return lines.join("\n").replace(/\n+$/, "\n");
}
