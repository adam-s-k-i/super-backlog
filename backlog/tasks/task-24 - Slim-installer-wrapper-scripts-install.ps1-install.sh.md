---
id: TASK-24
title: Slim installer wrapper scripts (install.ps1/install.sh)
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 11:44'
updated_date: '2026-08-27 12:20'
labels:
  - feature
milestone: m-0
dependencies: []
type: enhancement
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reduce scripts/install.ps1 and scripts/install.sh to a minimal policy-proof flow: check Node -> install super-backlog globally via npm -> invoke sbl init. On Windows use the .cmd shims (npm.cmd, sbl.cmd) so a restrictive PowerShell execution policy can never break the run (root cause of the reported install failure). All healing logic lives in the CLI (TASK-22/23), not in the wrappers. Also fix the stale /main/ branch references in header comments to /master/.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 install.ps1 uses .cmd shims and completes on a machine with default Restricted execution policy
- [x] #2 install.sh keeps working on macOS/Linux with the reduced flow
- [x] #3 Header comments reference the master branch, not main
- [x] #4 Wrappers contain no self-healing logic (delegated to the CLI)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. install.ps1: invoke npm.cmd/sbl.cmd explicitly (policy-proof), fix header to master. 2. install.sh: fix header to master, keep flow. 3. Verify manually: run install.ps1 -Local in a temp dir under default Restricted policy; confirm kit files land and exit code 0. 4. Full suite stays green (no TS changes).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Manual end-to-end verification on this machine: powershell -ExecutionPolicy Restricted, iex-pattern, -Local in a temp dir -> npm.cmd shim used, install + sbl init completed, kit files present, installer exits 0. Two latent bugs fixed along the way: Join-Path with 4 args (PS 5.1) and init exit 4 treated as failure (4 = success with warnings). install.sh: same exit-4 handling; verified by review (cannot execute bash on this machine; flow otherwise unchanged).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slimmed install wrappers: install.ps1 resolves npm.cmd/sbl.cmd explicitly so the Restricted execution policy can never break the run, fails loudly on npm errors, accepts init exit 0/4, and points to master in header comments. install.sh mirrors the exit-code handling and master URL. No self-healing logic in wrappers (delegated to the CLI). Verified manually under Restricted policy; full suite 281/281 green.
<!-- SECTION:FINAL_SUMMARY:END -->
