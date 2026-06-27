#!/usr/bin/env node
// Changelog-completeness gate (SK-380). A release-triggering PR title
// (`feat`/`fix`/breaking) MUST carry a dated `changelog/` entry. This restores
// the coupling Changesets gave for free — no changeset → no release — now that
// release-please infers the bump from the Conventional-Commit PR title rather
// than an explicit file. Wired into validate.yml's build-and-lint job.
//
// "Release-triggering" mirrors release-please's default node bump table:
// `feat` (minor), `fix`/`perf`/`revert` (patch), and a `!` breaking marker
// (major) cut a release; `docs`/`chore`/`ci`/`refactor`/`test`/`build`/`style`
// do not.
//
// Inputs (env, set by the workflow):
//   PR_TITLE — the pull request title (github.event.pull_request.title)
//   BASE_REF — the base branch name (github.base_ref); defaults to "main"
// Reads changed files from `git diff --name-only origin/<BASE_REF>...HEAD`.
// Pure functions live exported for vitest.
//
// Zero-dep: Node built-ins only — no tsx, so CI runs it under bare `node`.

import { execSync } from "node:child_process";
import { argv } from "node:process";

const RELEASE_TRIGGERING_TYPE = /^(feat|fix|perf|revert)(\([^)]+\))?:/;
const BREAKING_SUBJECT = /^[a-z]+(\([^)]+\))?!:/;
const CHANGELOG_ENTRY = /^changelog\/.+\.md$/;

/**
 * @param {string} prTitle pull request title
 * @returns {boolean}
 */
export function isReleaseTriggering(prTitle) {
  const title = prTitle.trim();
  return BREAKING_SUBJECT.test(title) || RELEASE_TRIGGERING_TYPE.test(title);
}

/**
 * @param {string[]} changedFiles changed file paths
 * @returns {boolean}
 */
export function hasChangelogEntry(changedFiles) {
  return changedFiles.some(
    (file) => CHANGELOG_ENTRY.test(file) && file !== "changelog/README.md",
  );
}

/**
 * @typedef {object} CompletenessResult
 * @property {boolean} ok whether the gate passes
 * @property {string} reason human-readable explanation
 */

/**
 * @param {string} prTitle pull request title
 * @param {string[]} changedFiles changed file paths
 * @returns {CompletenessResult}
 */
export function checkCompleteness(prTitle, changedFiles) {
  if (!isReleaseTriggering(prTitle)) {
    return {
      ok: true,
      reason: `PR title "${prTitle}" is not release-triggering — no changelog entry required.`,
    };
  }

  if (hasChangelogEntry(changedFiles)) {
    return {
      ok: true,
      reason: "Release-triggering PR title with a changelog/ entry present.",
    };
  }

  return {
    ok: false,
    reason: `PR title "${prTitle}" triggers a release (feat/fix/breaking) but no changelog/*.md entry is present in the diff vs the base branch. Run /send-it (or add a dated changelog/ entry) so the release carries notes.`,
  };
}

/**
 * @param {string} baseRef
 * @returns {string[]}
 */
function readChangedFiles(baseRef) {
  const out = execSync(`git diff --name-only origin/${baseRef}...HEAD`, {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const prTitle = process.env.PR_TITLE ?? "";
  const baseRef = process.env.BASE_REF || "main";

  if (!prTitle) {
    console.error(
      "PR_TITLE is not set — cannot run the changelog-completeness gate.",
    );
    process.exit(1);
  }

  const result = checkCompleteness(prTitle, readChangedFiles(baseRef));
  console.log(result.reason);
  if (!result.ok) {
    process.exit(1);
  }
}

// Only run when invoked as a CLI, not when imported (e.g. by unit tests
// exercising the pure functions).
if (argv[1] && import.meta.filename === argv[1]) {
  main();
}
