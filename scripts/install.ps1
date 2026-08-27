#!/usr/bin/env powershell
# super-backlog installer for Windows
# Recommended invocation (works under the default Restricted execution policy):
#   irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.ps1 | iex
# Optional: install locally instead of globally
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.ps1))) -Local
#
# Self-healing (node version, execution policy, npm fallback, PATH) lives in the
# CLI: this wrapper only bootstraps it. It calls the .cmd shims explicitly so a
# restrictive PowerShell execution policy can never break the run.

param(
    [switch]$Local,
    [switch]$Models
)

$ErrorActionPreference = "Stop"
$PackageName = "super-backlog"
$CliName = "sbl"

function Test-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Write-Info($msg) { Write-Host "[sbl installer] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[sbl installer] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[sbl installer] $msg" -ForegroundColor Red }

# Resolve the .cmd shim explicitly: "npm"/"sbl" resolve to .ps1 shims in
# PowerShell, which a Restricted/AllSigned execution policy refuses to load.
function Find-CmdShim($name) {
    $shim = Get-Command "$name.cmd" -ErrorAction SilentlyContinue
    if ($shim) { return $shim.Source }
    return $null
}

Write-Info "Installing super-backlog on Windows..."

if (-not (Test-Command "node")) {
    Write-Err "Node.js was not found."
    Write-Err "Please install Node.js >= 20 first: https://nodejs.org/en/download/"
    exit 1
}

$nodeVersion = node --version
Write-Ok "Node.js found: $nodeVersion"

$npm = Find-CmdShim "npm"
if (-not $npm) {
    Write-Err "npm was not found. It should be installed together with Node.js."
    exit 1
}
Write-Ok "npm found: $(& $npm --version)"

$initArgs = @("init")
if ($Models) { $initArgs += "--models" }

if ($Local) {
    Write-Info "Installing super-backlog locally in the current directory..."
    & $npm install $PackageName
    if ($LASTEXITCODE -ne 0) { Write-Err "npm install failed (exit $LASTEXITCODE)."; exit 1 }
    Write-Ok "Local installation complete."

    $cli = Join-Path (Get-Location) "node_modules\$PackageName\dist\cli.js"
    if (-not (Test-Path $cli)) {
        Write-Err "Expected CLI entry not found: $cli"
        exit 1
    }
    & "node" $cli @initArgs
    # exit 0 = ok, 4 = success with warnings (see CLI exit code contract)
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 4) { Write-Err "sbl init failed (exit $LASTEXITCODE)."; exit $LASTEXITCODE }
} else {
    Write-Info "Installing super-backlog globally..."
    & $npm install -g $PackageName
    if ($LASTEXITCODE -ne 0) { Write-Err "npm install -g failed (exit $LASTEXITCODE)."; exit 1 }
    Write-Ok "Global installation complete."

    $sbl = Find-CmdShim $CliName
    if (-not $sbl) {
        Write-Err "The '$CliName' command is not available after global install."
        Write-Err "Run 'npm bin -g', add the printed directory to your PATH, open a new terminal, then run 'sbl init'."
        exit 1
    }
    & $sbl @initArgs
    # exit 0 = ok, 4 = success with warnings (see CLI exit code contract)
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 4) { Write-Err "sbl init failed (exit $LASTEXITCODE)."; exit $LASTEXITCODE }
}

Write-Ok "super-backlog is ready. Run 'sbl doctor' to verify your environment."
exit 0
