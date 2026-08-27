#!/usr/bin/env powershell
# super-backlog installer for Windows
# Recommended invocation (bypasses PowerShell Execution Policy):
#   irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/main/scripts/install.ps1 | iex
# Optional: install locally instead of globally
#   irm ... | iex; -Local

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

Write-Info "Installing super-backlog on Windows..."

if (-not (Test-Command "node")) {
    Write-Err "Node.js was not found."
    Write-Err "Please install Node.js >= 20 first: https://nodejs.org/en/download/"
    exit 1
}

$nodeVersion = node --version
Write-Ok "Node.js found: $nodeVersion"

if (-not (Test-Command "npm")) {
    Write-Err "npm was not found. It should be installed together with Node.js."
    exit 1
}
Write-Ok "npm found: $(npm --version)"

$initArgs = @("init")
if ($Models) { $initArgs += "--models" }

if ($Local) {
    Write-Info "Installing super-backlog locally in the current directory..."
    npm install $PackageName
    Write-Ok "Local installation complete."

    $cli = Join-Path (Get-Location) "node_modules" $PackageName "dist" "cli.js"
    if (-not (Test-Path $cli)) {
        Write-Err "Expected CLI entry not found: $cli"
        exit 1
    }
    & "node" $cli @initArgs
} else {
    Write-Info "Installing super-backlog globally..."
    npm install -g $PackageName
    Write-Ok "Global installation complete."

    if (-not (Test-Command $CliName)) {
        Write-Err "The '$CliName' command is not available after global install."
        Write-Err "Make sure npm's global bin directory is on your PATH, then try again."
        exit 1
    }
    & $CliName @initArgs
}
