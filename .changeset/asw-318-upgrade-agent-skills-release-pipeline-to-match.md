---
---

CI/release hardening only — no consumer-facing or skill change, so no version bump. Converts `release.yml` to the publish-only road-runner-bot orchestrator model, adds the ASW-313 author-association gate to `claude.yml`, and introduces digest-pinned yamllint/actionlint CI jobs plus bats coverage of the publish scripts (ASW-318). Publishing remains dormant while the root is `private: true`.
