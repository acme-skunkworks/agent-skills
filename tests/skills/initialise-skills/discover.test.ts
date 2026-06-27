import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Imports the BUNDLE lib directly (the distributed `.mjs`). Covers the sibling-
// bundle discovery (A-465): which installed skills get reconciled — only those
// shipping a config.example.json — with the self-configuring `preflight` skill
// and unparseable config.json files handled specially. Uses a tmp skills dir so
// the assertions don't depend on which skills happen to be installed here.
import { discoverSkills } from "../../../skills/initialise-skills/scripts/lib/discover.mjs";

describe("discoverSkills", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "discover-skills-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeBundle(
    name: string,
    files: { example?: object; config?: string },
  ) {
    const bundle = join(dir, name);
    mkdirSync(bundle, { recursive: true });
    if (files.example !== undefined) {
      writeFileSync(
        join(bundle, "config.example.json"),
        JSON.stringify(files.example),
      );
    }
    if (files.config !== undefined) {
      writeFileSync(join(bundle, "config.json"), files.config);
    }
  }

  it("returns config-bearing bundles sorted by name, with config state attached", () => {
    makeBundle("alpha", {
      example: { k: 1 },
      config: JSON.stringify({ k: 2 }),
    });
    makeBundle("zeta", { example: { x: "y" } }); // no config.json yet

    const skills = discoverSkills(dir);
    expect(skills.map((s) => s.name)).toEqual(["alpha", "zeta"]);

    const alpha = skills.find((s) => s.name === "alpha")!;
    expect(alpha.example).toEqual({ k: 1 });
    expect(alpha.config.exists).toBe(true);
    expect(alpha.config.data).toEqual({ k: 2 });

    const zeta = skills.find((s) => s.name === "zeta")!;
    expect(zeta.config.exists).toBe(false);
    expect(zeta.malformed).toBe(false);
  });

  it("skips the self-configuring preflight skill and bundles with no config surface", () => {
    makeBundle("preflight", { example: { workspaces: {} } });
    makeBundle("no-surface", {}); // no config.example.json
    makeBundle("real", { example: { k: 1 } });

    expect(discoverSkills(dir).map((s) => s.name)).toEqual(["real"]);
  });

  it("flags a bundle whose config.json is unparseable without throwing", () => {
    makeBundle("broken", { example: { k: 1 }, config: "{ not json" });

    const skills = discoverSkills(dir);
    const broken = skills.find((s) => s.name === "broken")!;
    expect(broken.malformed).toBe(true);
    expect(broken.config.exists).toBe(true);
  });

  it("returns an empty list when the skills directory does not exist", () => {
    expect(discoverSkills(join(dir, "nope"))).toEqual([]);
  });
});
