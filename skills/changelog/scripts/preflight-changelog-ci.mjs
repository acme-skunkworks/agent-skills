#!/usr/bin/env node
// Optional CI-parity preflight: confirm the active Node satisfies the consumer
// repo's engines/.nvmrc policy, then run `pnpm install --frozen-lockfile` so the
// lockfile is honoured before validating. Assumes the consumer repo uses pnpm
// with a committed lockfile; skip this step if yours does not.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function parseVersion(raw) {
  // Accept full and partial versions: a bare `22` or `22.5` (common in
  // `.nvmrc`, which is what `nvm use` writes) pads the missing parts with 0.
  const m = String(raw)
    .trim()
    .replace(/^v/, "")
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) {
    return null;
  }

  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

// Extract the minimum concrete version from any common `engines.node` range
// without a semver dependency: `>=22`, `>=22.1.0`, `^22.0.0`, `~22.1`, `22.x`,
// `>=22 <23`, or a bare `22`. We take the first version-like token (the lower
// bound for the ranges we emit) and treat `x`/`*`/missing parts as 0.
function coerceMinVersion(spec) {
  const m = String(spec).match(/(\d+)(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?/);
  if (!m) {
    return null;
  }

  const part = (s) => (s === undefined || /[xX*]/.test(s) ? 0 : Number(s));
  return [Number(m[1]), part(m[2]), part(m[3])];
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) {
      return 1;
    }

    if (a[i] < b[i]) {
      return -1;
    }
  }

  return 0;
}

function satisfiesGte(versionParts, minParts) {
  return compareVersions(versionParts, minParts) >= 0;
}

function readEnginesNode() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const spec = pkg.engines?.node;
  if (!spec || typeof spec !== "string") {
    console.error(
      "preflight-changelog-ci: package.json engines.node is missing",
    );
    process.exit(1);
  }

  const min = coerceMinVersion(spec);
  if (!min) {
    console.error(
      `preflight-changelog-ci: could not parse a minimum version from engines.node "${spec}"`,
    );
    process.exit(1);
  }

  return min;
}

function readNvmrc() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, ".nvmrc"), "utf8").trim();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      console.error("preflight-changelog-ci: .nvmrc is missing");
      process.exit(1);
    }

    throw error;
  }

  const v = parseVersion(raw);
  if (!v) {
    console.error(
      `preflight-changelog-ci: could not parse .nvmrc version "${raw}"`,
    );
    process.exit(1);
  }

  return v;
}

const active = parseVersion(process.version);
if (!active) {
  console.error(
    `preflight-changelog-ci: could not parse active Node version "${process.version}"`,
  );
  process.exit(1);
}

const enginesMin = readEnginesNode();
const nvmrc = readNvmrc();

if (!satisfiesGte(active, enginesMin)) {
  const required = enginesMin.join(".");
  console.error(
    `Active Node is ${process.version}; this repo requires >=${required} (see package.json engines and .nvmrc).`,
  );
  console.error("Switch Node (e.g. nvm use, fnm use) and re-run.");
  process.exit(1);
}

if (!satisfiesGte(active, nvmrc)) {
  const recommended = nvmrc.join(".");
  console.error(
    `Active Node is ${process.version}; .nvmrc recommends ${recommended}.`,
  );
  console.error("Switch Node (e.g. nvm use, fnm use) and re-run.");
  process.exit(1);
}

const install = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (install.error) {
  console.error(
    `preflight-changelog-ci: could not run pnpm — ${install.error.message}`,
  );
  process.exit(1);
}

if (install.status !== 0) {
  process.exit(install.status ?? 1);
}
