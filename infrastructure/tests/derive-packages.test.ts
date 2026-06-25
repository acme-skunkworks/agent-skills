import { describe, expect, it } from "vitest";

// Imports the BUNDLE script directly (the distributed `.mjs`), not an
// infrastructure twin — derive-packages has no infra counterpart.
import { derivePackagesFromPaths } from "../../skills/changelog/scripts/lib/derive-packages.mjs";

describe("derivePackagesFromPaths", () => {
  it("maps default roots to package names and everything else to the fallback", () => {
    expect(
      derivePackagesFromPaths([
        "apps/web/src/index.ts",
        "packages/ui/button.tsx",
        "services/api/main.go",
        ".github/workflows/ci.yml",
      ]),
    ).toEqual(["api", "infrastructure", "ui", "web"]);
  });

  it("skips the (default) changelog dir so it doesn't pin the fallback everywhere", () => {
    expect(
      derivePackagesFromPaths(["changelog/20260101-000000-x.md"]),
    ).toEqual([]);
  });

  it("de-duplicates and sorts", () => {
    expect(
      derivePackagesFromPaths([
        "apps/web/a.ts",
        "apps/web/b.ts",
        "packages/ui/c.ts",
      ]),
    ).toEqual(["ui", "web"]);
  });

  it("honours custom packageRoots and fallbackPackage", () => {
    expect(
      derivePackagesFromPaths(["modules/auth/x.ts", "README.md"], {
        packageRoots: ["modules"],
        fallbackPackage: "root",
      }),
    ).toEqual(["auth", "root"]);
  });

  it("honours a custom changelogDir", () => {
    expect(
      derivePackagesFromPaths(["history/entry.md", "apps/web/x.ts"], {
        changelogDir: "history",
      }),
    ).toEqual(["web"]);
  });

  it("tolerates a trailing slash in changelogDir", () => {
    expect(
      derivePackagesFromPaths(["changelog/x.md", "apps/web/y.ts"], {
        changelogDir: "changelog/",
      }),
    ).toEqual(["web"]);
  });

  it("with no packageRoots, everything collapses to the fallback", () => {
    expect(
      derivePackagesFromPaths(["apps/web/x.ts", "anything/else.ts"], {
        packageRoots: [],
        fallbackPackage: "pkg",
      }),
    ).toEqual(["pkg"]);
  });

  it("ignores blank path entries", () => {
    expect(derivePackagesFromPaths(["", "  ", "apps/web/x.ts"])).toEqual([
      "web",
    ]);
  });
});
