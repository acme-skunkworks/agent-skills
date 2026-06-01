#!/usr/bin/env node
import { getBranchScope } from "./lib/scope.mjs";
/**
 * Scoped auto-fix for branch-changed lintable paths (originally ASW-282).
 */
import { spawnSync } from "node:child_process";

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

function main() {
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

main();
