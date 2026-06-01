---
---

Docs-only: correct the bootstrap-publish runbook in `CLAUDE.md` (and the `.env.example` pointer) so the passkey/WebAuthn browser flow is the primary first-publish path and a recovery-code `--otp` is the documented headless fallback. No consumer-facing or skill change — `CLAUDE.md` and `.env.example` are not in the published `skills/` tarball, so no version bump.
