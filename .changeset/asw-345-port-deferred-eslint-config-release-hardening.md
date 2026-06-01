---
---

CI/release hardening only — no consumer-facing or skill change, so no version bump. Lands the four pieces deferred during ASW-318 (ASW-345): the build-once-publish-exact 3-job `release.yml` split (`build` → `release` (npm OIDC) → `publish-github-packages` with a provenance attestation over the exact tarball), the `load-repo-config` composite action driven by `infrastructure/repo-config.yaml`, the dated `changelog/` system (`*-changelog.ts` helpers + vitest, wired into `changeset:version` and `/send-it`), and husky hooks (block direct `main` pushes, lint-staged, strip the Claude trailer). Also scopes the npm tarball to the skill bundles via `files: ["skills/"]`. Publishing stays dormant while the root is `private: true`.
