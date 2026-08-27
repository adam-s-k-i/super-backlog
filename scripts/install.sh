#!/usr/bin/env bash
# super-backlog installer for macOS/Linux
# Recommended invocation:
#   curl -fsSL https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.sh | bash
#
# Self-healing (node version, npm fallback, PATH) lives in the CLI:
# this wrapper only bootstraps it.

set -euo pipefail

PACKAGE_NAME="super-backlog"
CLI_NAME="sbl"
LOCAL_INSTALL="${LOCAL_INSTALL:-false}"
MODELS="${MODELS:-false}"

info()  { echo "[sbl installer] $*"; }
ok()    { echo "[sbl installer] ✓ $*"; }
err()   { echo "[sbl installer] ✗ $*" >&2; }

info "Installing super-backlog on $(uname -s)..."

if ! command -v node >/dev/null 2>&1; then
    err "Node.js was not found."
    err "Please install Node.js >= 20 first: https://nodejs.org/en/download/"
    exit 1
fi
ok "Node.js found: $(node --version)"

if ! command -v npm >/dev/null 2>&1; then
    err "npm was not found. It should be installed together with Node.js."
    exit 1
fi
ok "npm found: $(npm --version)"

init_args=("init")
if [ "$MODELS" = "true" ]; then
    init_args+=("--models")
fi

if [ "$LOCAL_INSTALL" = "true" ]; then
    info "Installing $PACKAGE_NAME locally..."
    npm install "$PACKAGE_NAME"
    ok "Local installation complete."

    cli="./node_modules/$PACKAGE_NAME/dist/cli.js"
    if [ ! -f "$cli" ]; then
        err "Expected CLI entry not found: $cli"
        exit 1
    fi
    init_status=0
    node "$cli" "${init_args[@]}" || init_status=$?
else
    info "Installing $PACKAGE_NAME globally..."
    npm install -g "$PACKAGE_NAME"
    ok "Global installation complete."

    if ! command -v "$CLI_NAME" >/dev/null 2>&1; then
        err "The '$CLI_NAME' command is not available after global install."
        err "Run 'npm bin -g', add the printed directory to your PATH, open a new terminal, then run 'sbl init'."
        exit 1
    fi
    init_status=0
    "$CLI_NAME" "${init_args[@]}" || init_status=$?
fi

# exit 0 = ok, 4 = success with warnings (see CLI exit code contract)
if [ "$init_status" -ne 0 ] && [ "$init_status" -ne 4 ]; then
    err "sbl init failed (exit $init_status)."
    exit "$init_status"
fi

ok "super-backlog is ready. Run 'sbl doctor' to verify your environment."
exit 0
