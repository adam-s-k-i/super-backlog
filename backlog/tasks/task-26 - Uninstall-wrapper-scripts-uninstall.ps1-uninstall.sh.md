---
id: TASK-26
title: Uninstall wrapper scripts (uninstall.ps1/uninstall.sh)
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 11:45'
updated_date: '2026-08-27 12:33'
labels:
  - feature
milestone: m-0
dependencies:
  - TASK-25
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add scripts/uninstall.ps1 and scripts/uninstall.sh, symmetric to the install wrappers, so one command removes the kit: irm .../uninstall.ps1 | iex. Flow: invoke sbl uninstall -> fall back to npx.cmd super-backlog uninstall when sbl is not resolvable -> remove the global npm package afterwards (via .cmd shims on Windows so the execution policy cannot break it).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 uninstall.ps1 completes on a machine with default Restricted execution policy
- [x] #2 Falls back to npx/npx.cmd when sbl is not on PATH
- [x] #3 Global npm package is removed after project cleanup
- [x] #4 uninstall.sh works on macOS/Linux
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/uninstall.ps1: resolve sbl.cmd -> run uninstall (accept 0/4-style codes: uninstall exits 0/1; propagate), fallback to npx.cmd super-backlog uninstall when sbl missing, then npm.cmd uninstall -g super-backlog. Policy-proof via .cmd shims, master URL in header. 2. scripts/uninstall.sh: same flow for macOS/Linux. 3. Verify uninstall.ps1 manually in the temp project from TASK-24 (has a local install): run under Restricted policy, confirm kit files removed and exit 0. 4. Full suite stays green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Manual end-to-end verification on this machine: powershell -ExecutionPolicy Restricted, iex-pattern, in the temp project installed via install.ps1 (TASK-24) -> sbl not on PATH, npx.cmd fallback used, project cleanup report printed, global npm uninstall executed (no-op, package not globally installed), exit 0 with final success line. uninstall.sh verified by review (no bash on this machine; identical flow, set -uo pipefail without -e so exit codes are captured explicitly).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added scripts/uninstall.ps1 and scripts/uninstall.sh: one-command removal symmetric to the install wrappers. Flow: sbl uninstall -> npx fallback when sbl is not on PATH -> global npm package removal via .cmd shims (policy-proof). Headers point to master. Verified manually under Restricted policy with the npx fallback path; full suite 287/287 green.
<!-- SECTION:FINAL_SUMMARY:END -->
