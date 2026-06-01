#!/usr/bin/env node
import { getBranchScope, relativiseToWorkspace, resolveConfig } from "./lib/scope.mjs";
import {
  classifyViolations,
  parseActionlintText,
  parseEslintJson,
  parseMarkdownlintJson,
} from "./classify-lint.mjs";
/**
 * Change-gated, branch-scoped lint preflight (originally ASW-282).
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SUMMARY_PATH = join(ROOT, ".preflight-summary.json");
const dryRun = process.argv.includes("--dry-run");

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ encoding?: 'utf8'; input?: string }} [opts]
 */
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: opts.encoding ?? "utf8",
    input: opts.input,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/**
 * @param {string} label
 * @param {string[]} files
 */
function runEslintGroup(label, files) {
  if (files.length === 0) {
    return { ok: true, violations: [], label, skipped: true };
  }

  if (dryRun) {
    console.log(
      `preflight: [dry-run] would run ESLint (${label}) on ${files.length} file(s)`,
    );
    return { ok: true, violations: [], label, files, dryRun: true };
  }

  const result = run("pnpm", ["exec", "eslint", "-f", "json", "--", ...files]);
  const violations = parseEslintJson(result.stdout);
  const ok = result.status === 0 && violations.length === 0;
  if (!ok && result.stderr) {
    console.error(result.stderr);
  }

  return { ok, violations, label, files };
}

/**
 * @param {string} filter
 * @param {string[]} files
 * @param {string} prefix workspace prefix (e.g. "apps/studio/")
 */
function runEslintFilter(filter, files, prefix) {
  if (files.length === 0) {
    return { ok: true, violations: [], label: filter, skipped: true };
  }

  if (dryRun) {
    console.log(
      `preflight: [dry-run] would run ESLint (${filter}) on ${files.length} file(s)`,
    );
    return { ok: true, violations: [], label: filter, files, dryRun: true };
  }

  // `pnpm --filter <pkg> exec` runs with the workspace dir as cwd, so ESLint
  // needs paths relative to that dir — repo-root-relative paths would resolve
  // to <pkg>/<pkg>/... and fail to match. Violation paths are re-derived from
  // ESLint's absolute filePath via toRepoRelative, so classification stays
  // keyed on repo-relative paths regardless of what we pass in here.
  const result = run("pnpm", [
    "--filter",
    filter,
    "exec",
    "eslint",
    "-f",
    "json",
    "--",
    ...relativiseToWorkspace(files, prefix),
  ]);
  const violations = parseEslintJson(result.stdout);
  const ok = result.status === 0 && violations.length === 0;
  if (!ok && result.stderr) {
    console.error(result.stderr);
  }

  return {
    ok,
    violations,
    label: filter,
    files,
  };
}

/**
 * @param {string[]} files
 */
function runMarkdownlint(files) {
  if (files.length === 0) {
    return { ok: true, violations: [], skipped: true };
  }

  if (dryRun) {
    console.log(
      `preflight: [dry-run] would run markdownlint on ${files.length} file(s)`,
    );
    return { ok: true, violations: [], files, dryRun: true };
  }

  const result = run("pnpm", [
    "exec",
    "markdownlint-cli2",
    "--format",
    "json",
    ...files,
  ]);
  const violations = parseMarkdownlintJson(result.stdout || result.stderr);
  const passed = result.status === 0 && violations.length === 0;
  if (!passed && result.stderr && !result.stdout) {
    console.error(result.stderr);
  }

  return { ok: passed, violations, files };
}

/**
 * @param {string[]} files
 */
function runActionlint(files) {
  if (files.length === 0) {
    return { ok: true, violations: [], skipped: true, actionlint: "skipped" };
  }

  if (dryRun) {
    console.log(
      `preflight: [dry-run] would run actionlint on ${files.length} workflow(s)`,
    );
    return {
      ok: true,
      violations: [],
      files,
      dryRun: true,
      actionlint: "would-run",
    };
  }

  let actionlintBin = null;
  if (existsSync(join(ROOT, "actionlint"))) {
    actionlintBin = join(ROOT, "actionlint");
  } else {
    const which = run("bash", ["-lc", "command -v actionlint"]);
    if (which.status === 0 && which.stdout.trim()) {
      actionlintBin = which.stdout.trim();
    }
  }

  if (!actionlintBin) {
    console.warn(
      "preflight: actionlint not installed — skipping workflow lint (install actionlint locally or rely on CI)",
    );
    return { ok: true, violations: [], files, actionlint: "warn-skipped" };
  }

  const result = run(actionlintBin, [...files]);
  const violations = parseActionlintText(result.stderr || result.stdout, files);
  return {
    ok: result.status === 0 && violations.length === 0,
    violations,
    files,
    actionlint: "ran",
  };
}

function buildSummary(scope, results, classified) {
  const failedLinters = results.failedLinters ?? [];
  const categories = {
    eslint: scope.codeChanged ? { ...scope.eslint } : "skipped",
    markdown: scope.markdownChanged ? scope.markdown : "skipped",
    actionlint: scope.workflowsChanged ? scope.actionlintTargets : "skipped",
  };

  return {
    dryRun,
    mergeBase: scope.mergeBase,
    categories,
    results: {
      eslintRan: scope.codeChanged,
      markdownRan: scope.markdownChanged,
      actionlint: results.actionlintStatus,
      failedLinters,
    },
    violations: {
      introduced: classified.introduced,
      preExisting: classified.preExisting,
      introducedCount: classified.introduced.length,
      preExistingCount: classified.preExisting.length,
    },
    passed: classified.introduced.length === 0 && failedLinters.length === 0,
    deferred: classified.preExisting.length > 0 && !dryRun,
    blocking: classified.introduced.length > 0 || failedLinters.length > 0,
  };
}

function main() {
  const scope = getBranchScope();
  const { baseBranch } = resolveConfig();

  if (scope.changedFiles.length === 0) {
    console.log(
      `preflight: no files changed vs origin/${baseBranch} — skipping lint preflight`,
    );
    const earlySummary = buildSummary(
      scope,
      { actionlintStatus: "skipped" },
      {
        introduced: [],
        preExisting: [],
      },
    );
    writeFileSync(SUMMARY_PATH, `${JSON.stringify(earlySummary, null, 2)}\n`);
    process.exit(0);
  }

  if (!scope.codeChanged && !scope.markdownChanged && !scope.workflowsChanged) {
    console.log(
      "preflight: no lintable changes (code/markdown/workflows) — skipping lint preflight",
    );
    const earlySummary = buildSummary(
      scope,
      { actionlintStatus: "skipped" },
      {
        introduced: [],
        preExisting: [],
      },
    );
    writeFileSync(SUMMARY_PATH, `${JSON.stringify(earlySummary, null, 2)}\n`);
    process.exit(0);
  }

  /** @type {import('./classify-lint.mjs').Violation[]} */
  const allViolations = [];
  /** @type {string[]} */
  const failedLinters = [];

  if (scope.codeChanged) {
    console.log(
      "preflight: running scoped ESLint (code changed on branch)",
    );
    const groups = [
      runEslintGroup("scripts", scope.eslint.scripts),
      runEslintGroup("root", scope.eslint.root),
      ...Object.entries(scope.workspaces).map(([key, { filter, prefix }]) =>
        runEslintFilter(filter, scope.eslint[key], prefix),
      ),
    ];
    for (const g of groups) {
      if (!g.skipped && !g.dryRun) {
        allViolations.push(...g.violations);
        if (g.ok) {
          console.log(`preflight: ESLint passed (${g.label})`);
        } else if (g.violations.length === 0) {
          console.error(
            `preflight: ESLint failed to run successfully (${g.label}) — no parseable violations from non-zero exit`,
          );
          failedLinters.push(`eslint:${g.label}`);
        } else {
          console.error(
            `preflight: ESLint reported issues (${g.label})`,
          );
        }
      }
    }
  } else {
    console.log("preflight: skipping ESLint (no code changes)");
  }

  let actionlintStatus = "skipped";
  if (scope.markdownChanged) {
    console.log("preflight: running scoped markdownlint");
    const md = runMarkdownlint(scope.markdown);
    if (!md.skipped && !md.dryRun) {
      allViolations.push(...md.violations);
      if (md.ok) {
        console.log("preflight: markdownlint passed");
      } else if (md.violations.length === 0) {
        console.error(
          "preflight: markdownlint failed to run successfully — no parseable violations from non-zero exit",
        );
        failedLinters.push("markdownlint");
      } else {
        console.error("preflight: markdownlint reported issues");
      }
    }
  } else {
    console.log(
      "preflight: skipping markdownlint (no markdown changes)",
    );
  }

  if (scope.workflowsChanged) {
    const targetCount = scope.actionlintTargets.length;
    console.log(
      `preflight: running actionlint on ${targetCount} workflow(s)`,
    );
    const wf = runActionlint(scope.actionlintTargets);
    actionlintStatus = wf.actionlint ?? "ran";
    if (!wf.skipped && !wf.dryRun && wf.actionlint !== "warn-skipped") {
      allViolations.push(...wf.violations);
      if (wf.ok) {
        console.log("preflight: actionlint passed");
      } else if (wf.violations.length === 0) {
        console.error(
          "preflight: actionlint failed to run successfully — no parseable violations from non-zero exit",
        );
        failedLinters.push("actionlint");
      } else {
        console.error("preflight: actionlint reported issues");
      }
    }
  } else {
    console.log("preflight: skipping actionlint (no workflow changes)");
  }

  const classified = dryRun
    ? { introduced: [], preExisting: [] }
    : classifyViolations(scope.mergeBase, allViolations);

  const summary = buildSummary(
    scope,
    { actionlintStatus, failedLinters },
    classified,
  );
  writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);

  console.log("");
  console.log("preflight: summary");
  console.log(
    `  categories: eslint=${scope.codeChanged ? "ran" : "skipped"} markdown=${scope.markdownChanged ? "ran" : "skipped"} actionlint=${actionlintStatus}`,
  );
  if (!dryRun) {
    console.log(
      `  violations: introduced=${classified.introduced.length} pre-existing=${classified.preExisting.length}`,
    );
    if (failedLinters.length > 0) {
      console.log(`  failed linters: ${failedLinters.join(", ")}`);
    }

    console.log(`  report: ${SUMMARY_PATH}`);
  }

  if (dryRun) {
    process.exit(0);
  }

  if (classified.introduced.length > 0) {
    console.error(
      "\npreflight: blocking — introduced violations must be fixed (run node skills/preflight/scripts/lint-fix.mjs and re-run preflight)",
    );
    for (const v of classified.introduced.slice(0, 20)) {
      console.error(`  ${v.file}:${v.line} [${v.source}] ${v.message}`);
    }

    if (classified.introduced.length > 20) {
      console.error(`  … and ${classified.introduced.length - 20} more`);
    }

    process.exit(1);
  }

  if (failedLinters.length > 0) {
    console.error(
      `\npreflight: blocking — linter(s) failed to run successfully without producing parseable violations: ${failedLinters.join(", ")}`,
    );
    console.error(
      "  inspect linter stderr above for startup errors, non-JSON output, or parser misses",
    );

    process.exit(1);
  }

  if (classified.preExisting.length > 0) {
    console.error(
      "\npreflight: pre-existing violations in branch-touched files — choose fix now or create a Linear debt issue",
    );
    for (const v of classified.preExisting.slice(0, 20)) {
      console.error(`  ${v.file}:${v.line} [${v.source}] ${v.message}`);
    }

    if (classified.preExisting.length > 20) {
      console.error(`  … and ${classified.preExisting.length - 20} more`);
    }

    process.exit(2);
  }

  console.log("preflight: all scoped checks passed");
  process.exit(0);
}

main();
