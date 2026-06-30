import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Imports the BUNDLE lib directly (the distributed `.mjs`). Covers the .gitignore
// reconcile (A-569): the append-only, idempotent edit that excludes preflight's
// `.preflight-summary.json` scratch output from a consumer repo. Uses a tmp repo
// root so assertions don't depend on the host repo's own .gitignore.
import {
  IGNORE_COMMENT,
  IGNORE_ENTRY,
  reconcilePreflightIgnore,
} from "../../../skills/initialise-skills/scripts/lib/gitignore.mjs";

describe("reconcilePreflightIgnore", () => {
  let dir: string;
  const ignorePath = () => join(dir, ".gitignore");
  const read = () => readFileSync(ignorePath(), "utf8");

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "preflight-gitignore-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates .gitignore with the entry when none exists", () => {
    expect(reconcilePreflightIgnore(dir, { write: false }).status).toBe(
      "would-create",
    );

    const result = reconcilePreflightIgnore(dir, { write: true });
    expect(result.status).toBe("created");
    expect(read()).toBe(`${IGNORE_COMMENT}\n${IGNORE_ENTRY}\n`);
  });

  it("appends the entry to an existing .gitignore, preserving prior content", () => {
    writeFileSync(ignorePath(), "node_modules/\ndist/\n");

    expect(reconcilePreflightIgnore(dir, { write: false }).status).toBe(
      "would-add",
    );

    const result = reconcilePreflightIgnore(dir, { write: true });
    expect(result.status).toBe("added");
    const text = read();
    expect(text.startsWith("node_modules/\ndist/\n")).toBe(true);
    expect(text).toContain(IGNORE_COMMENT);
    expect(text.endsWith(`${IGNORE_ENTRY}\n`)).toBe(true);
  });

  it("adds a trailing newline before appending when the file lacks one", () => {
    writeFileSync(ignorePath(), "node_modules/");

    reconcilePreflightIgnore(dir, { write: true });
    const text = read();
    expect(text).toBe(
      `node_modules/\n\n${IGNORE_COMMENT}\n${IGNORE_ENTRY}\n`,
    );
  });

  it("handles an existing but empty .gitignore (no leading blank line)", () => {
    writeFileSync(ignorePath(), "");

    const result = reconcilePreflightIgnore(dir, { write: true });
    expect(result.status).toBe("added");
    expect(read()).toBe(`${IGNORE_COMMENT}\n${IGNORE_ENTRY}\n`);
  });

  it("preserves CRLF line endings on append", () => {
    writeFileSync(ignorePath(), "node_modules/\r\ndist/\r\n");

    reconcilePreflightIgnore(dir, { write: true });
    // The appended block round-trips as CRLF — no bare-LF line slips in.
    expect(read()).toBe(
      `node_modules/\r\ndist/\r\n\r\n${IGNORE_COMMENT}\r\n${IGNORE_ENTRY}\r\n`,
    );
  });

  it("is idempotent — a second write leaves the file byte-identical", () => {
    reconcilePreflightIgnore(dir, { write: true });
    const after1 = read();

    const result = reconcilePreflightIgnore(dir, { write: true });
    expect(result.status).toBe("present");
    expect(read()).toBe(after1);
  });

  it("reports 'present' (no write) when the entry already exists", () => {
    writeFileSync(ignorePath(), `# notes\n${IGNORE_ENTRY}\n`);

    const result = reconcilePreflightIgnore(dir, { write: false });
    expect(result.status).toBe("present");
    // Dry-run must not mutate.
    expect(read()).toBe(`# notes\n${IGNORE_ENTRY}\n`);
  });

  it("treats the leading-slash anchored form as already present", () => {
    writeFileSync(ignorePath(), `/${IGNORE_ENTRY}\n`);
    expect(reconcilePreflightIgnore(dir, { write: true }).status).toBe(
      "present",
    );
  });

  it("leaves an explicit !-unignore untouched rather than flipping it (A-582)", () => {
    // Appending a positive rule after a deliberate negation would, under
    // last-match-wins, silently re-ignore the file the consumer chose to track.
    const original = `node_modules/\n!${IGNORE_ENTRY}\n`;
    writeFileSync(ignorePath(), original);
    expect(reconcilePreflightIgnore(dir, { write: false }).status).toBe(
      "present",
    );
    const result = reconcilePreflightIgnore(dir, { write: true });
    expect(result.status).toBe("present");
    expect(read()).toBe(original);
  });

  it("treats the anchored !-unignore form as already settled too", () => {
    writeFileSync(ignorePath(), `!/${IGNORE_ENTRY}\n`);
    expect(reconcilePreflightIgnore(dir, { write: true }).status).toBe(
      "present",
    );
  });
});
