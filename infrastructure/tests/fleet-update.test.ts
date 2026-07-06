// Imports the helpers directly (the distributed `.mjs`). Covers the pure core of
// the single-repo fleet update pipeline (A-617): profile parsing/validation,
// skill-subset resolution, the `skills add` argv, the initialise stdin facts,
// the config.json deletions --copy leaves behind (A-706), and the check-updates
// verify verdict. The same assertions back the script's `--self-test`; this
// wires them into CI, since `run-self-tests.mjs` scans only skills/<name>/scripts
// and not infrastructure/. The spawn pipeline (skills add / git / initialise /
// check-updates) is intentionally out of scope here — the self-test and manual
// runbook cover it.
import {
  SOURCE_URL,
  buildInitialiseFacts,
  buildSkillsAddArgs,
  detectClobberedConfigs,
  interpretCheckUpdates,
  parseProfile,
  resolveSkills,
} from "../scripts/fleet-update.mjs";
import { describe, expect, it } from "vitest";

describe("parseProfile", () => {
  it("applies defaults for a minimal profile", () => {
    expect(parseProfile({ repo: "/tmp/x" })).toEqual({
      agents: ["claude-code"],
      facts: {},
      repo: "/tmp/x",
      repoType: "single",
      skills: undefined,
    });
  });

  it("trims repo and accepts a JSON string", () => {
    expect(parseProfile('{"repo":"  /tmp/x  "}').repo).toBe("/tmp/x");
  });

  it("preserves an explicit skills/agents/facts profile", () => {
    const profile = parseProfile({
      agents: ["claude-code", "cursor"],
      facts: { issueKeys: ["A"], linearTeamName: "Acme" },
      repo: "/tmp/x",
      repoType: "no-changelog",
      skills: ["send-it", "commit"],
    });
    expect(profile.skills).toEqual(["send-it", "commit"]);
    expect(profile.agents).toEqual(["claude-code", "cursor"]);
    expect(profile.repoType).toBe("no-changelog");
    expect(profile.facts.issueKeys).toEqual(["A"]);
  });

  it("rejects a missing or empty repo", () => {
    expect(() => parseProfile({})).toThrow(/repo/);
    expect(() => parseProfile({ repo: "   " })).toThrow(/repo/);
  });

  it("rejects non-array skills and agents", () => {
    expect(() => parseProfile({ repo: "/tmp/x", skills: "send-it" })).toThrow(
      /skills/,
    );
    expect(() => parseProfile({ agents: "cursor", repo: "/tmp/x" })).toThrow(
      /agents/,
    );
  });

  it("rejects a bad repoType and non-array issueKeys", () => {
    expect(() => parseProfile({ repo: "/tmp/x", repoType: "weird" })).toThrow(
      /repoType/,
    );
    expect(() =>
      parseProfile({ facts: { issueKeys: "A" }, repo: "/tmp/x" }),
    ).toThrow(/issueKeys/);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseProfile("{not json")).toThrow(/parse/);
  });
});

describe("resolveSkills + buildSkillsAddArgs", () => {
  it("returns null (install all) for an unlisted single repo", () => {
    expect(resolveSkills({ repoType: "single", skills: undefined })).toBeNull();
  });

  it("drops changelog for an unlisted no-changelog repo", () => {
    const skills = resolveSkills({
      repoType: "no-changelog",
      skills: undefined,
    });
    expect(skills).not.toContain("changelog");
    expect(skills).toContain("send-it");
  });

  it("honours an explicit skills list verbatim", () => {
    expect(resolveSkills({ repoType: "single", skills: ["send-it"] })).toEqual([
      "send-it",
    ]);
  });

  it("installs from the GitHub URL, omits --skill, fans out agents, ends --copy", () => {
    const args = buildSkillsAddArgs({
      agents: ["claude-code", "cursor"],
      repoType: "single",
      skills: undefined,
    });
    expect(args[0]).toBe("add");
    // The install source is the canonical URL, never a local path (A-718).
    expect(args[1]).toBe(SOURCE_URL);
    expect(args).not.toContain("--skill");
    expect(args.filter((a) => a === "--agent")).toHaveLength(2);
    expect(args.at(-1)).toBe("--copy");
  });

  it("emits explicit --skill pairs for a subset", () => {
    const args = buildSkillsAddArgs({
      agents: ["claude-code"],
      repoType: "single",
      skills: ["send-it", "commit"],
    });
    expect(args).toEqual([
      "add",
      SOURCE_URL,
      "--skill",
      "send-it",
      "--skill",
      "commit",
      "--agent",
      "claude-code",
      "--copy",
    ]);
  });
});

describe("buildInitialiseFacts", () => {
  it("sets lockSource/lockRef and forwards supplied Linear facts", () => {
    const { facts } = buildInitialiseFacts(
      {
        facts: {
          issueKeys: ["A"],
          linearTeamName: "Acme",
          linearWorkspaceSlug: "acme",
        },
      },
      { ref: "v1.2.3" },
    );
    expect(facts.lockSource).toBe(SOURCE_URL);
    expect(facts.lockRef).toBe("v1.2.3");
    expect(facts.linearTeamName).toBe("Acme");
    expect(facts.linearWorkspaceSlug).toBe("acme");
    expect(facts.issueKeys).toEqual(["A"]);
  });

  it("omits absent Linear facts", () => {
    const { facts } = buildInitialiseFacts({ facts: {} }, { ref: "main" });
    expect(facts).toEqual({
      lockRef: "main",
      lockSource: SOURCE_URL,
    });
  });
});

describe("detectClobberedConfigs", () => {
  it("keeps config.json in both mirrors and drops other changed paths", () => {
    const clobbered = detectClobberedConfigs(
      [
        ".claude/skills/send-it/config.json",
        ".agents/skills/send-it/config.json",
        "README.md",
        "",
      ].join("\n"),
    );
    expect(clobbered).toEqual([
      ".agents/skills/send-it/config.json",
      ".claude/skills/send-it/config.json",
    ]);
  });

  it("returns [] for empty input (a first-ever install clobbers nothing)", () => {
    expect(detectClobberedConfigs("")).toEqual([]);
  });
});

describe("interpretCheckUpdates", () => {
  it("is ok when updatesAvailable is false", () => {
    expect(
      interpretCheckUpdates({ updates: [], updatesAvailable: false }),
    ).toEqual({ bumps: [], ok: true });
  });

  it("is not ok and returns bumps when updates are available", () => {
    const verdict = interpretCheckUpdates({
      updates: [{ bump: "minor", from: "0.1.0", name: "send-it", to: "0.2.0" }],
      updatesAvailable: true,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.bumps).toHaveLength(1);
  });

  it("is not ok with a reason for a malformed report", () => {
    const verdict = interpretCheckUpdates({});
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBeTruthy();
  });
});
