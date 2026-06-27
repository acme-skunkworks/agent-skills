#!/usr/bin/env node
import { getBranchScope } from "./lib/scope.mjs";
/**
 * Scoped auto-fix for branch-changed lintable paths (originally A-282).
 */
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";

const ROOT = process.cwd();

/**
 * @param {string} cmd
 * @param {string[]} argv
 */
function run(cmd, argv) {
  const result = spawnSync(cmd, argv, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const USAGE = `preflight-lint-fix — scoped eslint --fix / markdownlint --fix on branch-changed paths

Usage:
  node lint-fix.mjs          Auto-fix lint on the files the branch changed
  node lint-fix.mjs --help   Show this message (alias: -h)`;

function main() {
  if (
    process.argv
      .slice(2)
      .some((argument) => argument === "--help" || argument === "-h")
  ) {
    console.log(USAGE);
    return;
  }

  const scope = getBranchScope();

  if (!scope.codeChanged && !scope.markdownChanged) {
    console.log(
      "preflight-lint-fix: nothing to fix (no code or markdown changes on branch)",
    );
    return;
  }

  if (scope.codeChanged) {
    const scriptFiles = [...scope.eslint.scripts, ...scope.eslint.root];
    if (scriptFiles.length > 0) {
      console.log(
        `preflight-lint-fix: eslint --fix on ${scriptFiles.length} root/scripts file(s)`,
      );
      run("pnpm", ["exec", "eslint", "--fix", "--", ...scriptFiles]);
    }

    for (const [key, { filter }] of Object.entries(scope.workspaces)) {
      const files = scope.eslint[key];
      if (files.length === 0) {
        continue;
      }

      console.log(
        `preflight-lint-fix: eslint --fix (${filter}) on ${files.length} file(s)`,
      );
      run("pnpm", [
        "--filter",
        filter,
        "exec",
        "eslint",
        "--fix",
        "--",
        ...files,
      ]);
    }
  }

  if (scope.markdownChanged && scope.markdown.length > 0) {
    console.log(
      `preflight-lint-fix: markdownlint --fix on ${scope.markdown.length} file(s)`,
    );
    // No explicit --config: markdownlint-cli2 auto-discovers the consumer repo's
    // config (`.markdownlint-cli2.*` / `.markdownlint.*`), matching how the
    // detection side (preflight.mjs) invokes it. Keeps the skill portable.
    run("pnpm", ["exec", "markdownlint-cli2", "--fix", ...scope.markdown]);
  }

  console.log("preflight-lint-fix: done");
}

// Run main() only when invoked directly as a CLI, not when imported. Compare
// realpath'd paths so symlinks (macOS /var→/private/var, pnpm's store) don't
// cause a false negative.
function isCliEntry() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(import.meta.filename) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main();
}
