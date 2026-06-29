import { nonMergeCommitCount } from "../../../skills/changelog/scripts/lib/commit-count.mjs";
import { describe, expect, it } from "vitest";

// The helper takes an injectable runner (cmd, args) -> stdout, so these exercise
// the parse/filter logic against canned `gh api` JSON without touching the network.
type Runner = (cmd: string, args: readonly string[]) => string;

function runnerReturning(json: string): Runner {
  return () => json;
}

describe("nonMergeCommitCount", () => {
  it("counts a PR's commits", () => {
    const run = runnerReturning(
      JSON.stringify([
        { parents: [{ sha: "p1" }] },
        { parents: [{ sha: "p2" }] },
        { parents: [{ sha: "p3" }] },
      ]),
    );
    expect(nonMergeCommitCount(run, 42)).toBe("3");
  });

  it("excludes merge commits (more than one parent)", () => {
    const run = runnerReturning(
      JSON.stringify([
        { parents: [{ sha: "p1" }] },
        // a `main`-merge resolution on the branch — two parents, excluded
        { parents: [{ sha: "p2" }, { sha: "p3" }] },
        { parents: [{ sha: "p4" }] },
      ]),
    );
    expect(nonMergeCommitCount(run, 7)).toBe("2");
  });

  it("treats a root commit (no parents) as a normal commit", () => {
    const run = runnerReturning(JSON.stringify([{ parents: [] }]));
    expect(nonMergeCommitCount(run, 1)).toBe("1");
  });

  it("returns '0' for a PR with no commits", () => {
    expect(nonMergeCommitCount(runnerReturning("[]"), 1)).toBe("0");
  });

  it("returns null when the response is not an array", () => {
    expect(nonMergeCommitCount(runnerReturning('{"message":"Not Found"}'), 1)).toBeNull();
  });

  it("requests the merged PR's commits via the {owner}/{repo} REST endpoint", () => {
    const calls: { args: readonly string[]; cmd: string }[] = [];
    const run: Runner = (cmd, args) => {
      calls.push({ args, cmd });
      return "[]";
    };
    nonMergeCommitCount(run, 99);
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("gh");
    expect(calls[0].args).toContain("repos/{owner}/{repo}/pulls/99/commits");
    expect(calls[0].args).toContain("--paginate");
  });
});
