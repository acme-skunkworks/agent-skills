import { base, testing, typescript } from "@acme-skunkworks/eslint-config";
import { defineConfig } from "eslint/config";

/**
 * Self-lint config dogfooding the published Acme preset: the `base` stack, the
 * TypeScript-file overrides, and the test-file overrides.
 *
 * agent-skills ships skills.sh bundles rather than a transpiled `src/`, so the
 * only TypeScript surface is the workflow/release shell's CLI tooling under
 * `infrastructure/` (scripts + their vitest tests). Authored in TypeScript
 * (loaded by jiti) and wrapped in `defineConfig` so the whole array — including
 * the local override blocks below — is type-checked against the preset's shipped
 * types, not only when ESLint runs.
 */
export default defineConfig([
  // The preset ignores `**/tsconfig.json` (a JSONC file with a conventional,
  // non-alphabetical key order and explanatory comments). tsconfig.eslint.json
  // is the same kind of file, so extend that exemption to it — otherwise the
  // jsonc rules flag its comments / key order / array formatting.
  { ignores: ["tsconfig.eslint.json"] },
  ...base,
  typescript,
  testing,
  // infrastructure/ holds the workflow/release shell's CLI tooling (not
  // published code): it legitimately imports devDependencies (gray-matter, the
  // vitest test API), and the changelog/skill validators are inherently branchy
  // flat lists of schema checks, so the default complexity ceiling doesn't
  // apply. Scoped narrowly to this directory.
  {
    files: ["infrastructure/**/*.ts"],
    rules: {
      complexity: "off",
      "import/no-extraneous-dependencies": ["error", { devDependencies: true }],
    },
  },
  // The base preset enables type-aware linting (parserOptions.project), which
  // resolves each file to a TS program. The canonical tsconfig.json is
  // scripts-only, so pin an explicit project spanning scripts + tests
  // (tsconfig.eslint.json) so type-aware rules resolve every linted file.
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
