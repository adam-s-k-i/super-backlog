#!/usr/bin/env bash
# super-backlog uninstaller for macOS/Linux
# Recommended invocation:
#   curl -fsSL https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/uninstall.sh | bash
#
# Flow: run `sbl uninstall` in the current project (falling back to
# `npx super-backlog uninstall` when sbl is not on PATH), then remove the
# global npm package.

set -uo pipefail

PACKAGE_NAME="super-backlog"
CLI_NAME="sbl"

info()  { echo "[sbl uninstaller] $*"; }
ok()    { echo "[sbl uninstaller] ✓ $*"; }
err()   { echo "[sbl uninstaller] ✗ $*" >&2; }

info "Removing super-backlog from the current project..."

uninstall_status=0
if command -v "$CLI_NAME" >/dev/null 2>&1; then
    "$CLI_NAME" uninstall "$@" || uninstall_status=$?
elif command -v npx >/dev/null 2>&1; then
    info "'$CLI_NAME' not on PATH - falling back to npx..."
    npx --yes "$PACKAGE_NAME" uninstall "$@" || uninstall_status=$?
else
    err "Neither '$CLI_NAME' nor 'npx' was found. Install Node.js (https://nodejs.org) and try again."
    exit 1
fi

if [ "$uninstall_status" -ne 0 ]; then
    err "sbl uninstall reported errors (exit $uninstall_status). See the report above."
fi

if command -v npm >/dev/null 2>&1; then
    info "Removing the global npm package..."
    if ! npm uninstall -g "$PACKAGE_NAME"; then
        err "Global package removal failed. Run manually: npm uninstall -g $PACKAGE_NAME"
        exit 1
    fi
else
    info "npm not found - skipping global package removal (run manually: npm uninstall -g $PACKAGE_NAME)"
fi

if [ "$uninstall_status" -ne 0 ]; then
    exit "$uninstall_status"
fi
ok "super-backlog removed."
exit 0
