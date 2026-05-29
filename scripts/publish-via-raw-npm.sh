#!/usr/bin/env bash
# Publish the current package to npm via the upgraded npm at $PNPM_HOME/npm,
# bypassing `pnpm changeset publish`. Diagnosed in eslint-config's ASW-174:
# pnpm's publish path from inside `changesets/action` ends up failing OIDC
# Trusted Publishing even when `$PNPM_HOME` is on $PATH and `which npm`
# correctly resolves to npm 11.x. Calling npm directly works.
#
# Idempotent: if the package@version already exists on npm, exit 0 instead
# of re-publishing (which would 403/409). Lets release.yml retry safely
# after the version commit lands but before npm has the artifact.
#
# Dormant by design: while package.json has `private: true`, npm refuses to
# publish and this script is wired in but never ships anything. See CLAUDE.md
# "Release" for the flip-to-public sequence.
#
# Inputs (all from env, set by the workflow):
#   PNPM_HOME — directory containing the upgraded npm binary
#
# Reads ./package.json for the package name and version.
set -euo pipefail

: "${PNPM_HOME:?PNPM_HOME is not set; pnpm/action-setup must run first}"

NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")

# Dormant-by-design guard. The old release.yml published via
# `pnpm changeset publish`, which is private-aware and skips private packages
# cleanly (exit 0). This raw-npm wrapper is NOT — raw `npm publish` errors on a
# private package and would turn the release job red. While package.json is
# `private: true` there is nothing publishable, so exit 0 here: publish nothing,
# job stays green. Drops out the moment `private` is flipped to false. See
# CLAUDE.md "Release" for the flip-to-public sequence.
IS_PRIVATE=$(node -p "Boolean(require('./package.json').private)")
if [ "$IS_PRIVATE" = "true" ]; then
  echo "Package is private ($NAME@$VERSION) — skipping npm publish (dormant)."
  exit 0
fi

# Distinguish "not published yet" (a 404 — safe to publish) from a transient or
# auth failure. Treating every non-zero `npm view` as "not published" would turn
# a registry blip or a bad token into a spurious publish attempt rather than a
# clear, actionable error. Mirrors publish-to-github-packages.sh.
set +e
view_output=$("$PNPM_HOME/npm" view "$NAME@$VERSION" version 2>&1)
view_status=$?
set -e

if [ "$view_status" -eq 0 ]; then
  echo "Already published: $NAME@$VERSION — skipping."
  exit 0
fi

if ! printf '%s' "$view_output" | grep -qiE 'E404|404|not found'; then
  echo "npm view failed for $NAME@$VERSION (exit $view_status) and the error is not a 404 — aborting:" >&2
  printf '%s\n' "$view_output" >&2
  exit 1
fi

echo "Publishing $NAME@$VERSION via $PNPM_HOME/npm..."
"$PNPM_HOME/npm" publish --access public --provenance
