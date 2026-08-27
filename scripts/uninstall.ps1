#!/usr/bin/env powershell
# super-backlog uninstaller for Windows
# Recommended invocation (works under the default Restricted execution policy):
#   irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/uninstall.ps1 | iex
#
# Flow: run `sbl uninstall` in the current project (falling back to
# `npx super-backlog uninstall` when sbl is not on PATH), then remove the
# global npm package. All calls go through the .cmd shims so a restrictive
# PowerShell execution policy can never break the run.

$ErrorActionPreference = "Stop"
$PackageName = "super-backlog"
$CliName = "sbl"

function Test-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Write-Info($msg) { Write-Host "[sbl uninstaller] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[sbl uninstaller] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[sbl uninstaller] $msg" -ForegroundColor Red }

# Resolve the .cmd shim explicitly: "sbl"/"npx"/"npm" resolve to .ps1 shims in
# PowerShell, which a Restricted/AllSigned execution policy refuses to load.
function Find-CmdShim($name) {
    $shim = Get-Command "$name.cmd" -ErrorAction SilentlyContinue
    if ($shim) { return $shim.Source }
    return $null
}

Write-Info "Removing super-backlog from the current project..."

$uninstallStatus = 0
$sbl = Find-CmdShim $CliName
if ($sbl) {
    & $sbl uninstall @args
    $uninstallStatus = $LASTEXITCODE
} else {
    $npx = Find-CmdShim "npx"
    if (-not $npx) {
        Write-Err "Neither '$CliName' nor 'npx' was found. Install Node.js (https://nodejs.org) and try again."
        exit 1
    }
    Write-Info "'$CliName' not on PATH - falling back to npx..."
    & $npx --yes $PackageName uninstall @args
    $uninstallStatus = $LASTEXITCODE
}

if ($uninstallStatus -ne 0) {
    Write-Err "sbl uninstall reported errors (exit $uninstallStatus). See the report above."
}

$npm = Find-CmdShim "npm"
if ($npm) {
    Write-Info "Removing the global npm package..."
    & $npm uninstall -g $PackageName
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Global package removal failed. Run manually: npm uninstall -g $PackageName"
        exit 1
    }
} else {
    Write-Info "npm not found - skipping global package removal (run manually: npm uninstall -g $PackageName)"
}

if ($uninstallStatus -ne 0) { exit $uninstallStatus }
Write-Ok "super-backlog removed."
exit 0
