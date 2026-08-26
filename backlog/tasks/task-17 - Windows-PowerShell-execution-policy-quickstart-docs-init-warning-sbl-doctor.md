---
id: TASK-17
title: 'Windows PowerShell execution policy: quickstart docs, init warning, sbl doctor'
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-26 13:16'
updated_date: '2026-08-26 16:02'
labels:
  - windows
  - dx
dependencies: []
references:
  - docs/guide/troubleshooting.md
priority: high
type: feature
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On default Windows clients PowerShell resolves npx/sbl to their .ps1 shims and the Restricted execution policy blocks them before any super-backlog code runs (`npx : Die Datei ... npx.ps1 kann nicht geladen werden`). We cannot intercept that first contact, so we mitigate in three layers: document the one-time fix prominently, warn during init when a blocking policy is detected, and ship `sbl doctor` to detect environment seams on demand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README Quickstart contains a Windows note naming the one-time fix `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` plus the alternative `npx.cmd super-backlog init`
- [x] #2 docs/guide/troubleshooting.md has a section explaining the cause (.ps1 shim resolution under Restricted policy), the remedies, and that npm scripts run via cmd.exe and are unaffected
- [x] #3 `sbl init` on win32 detects the effective PowerShell execution policy via powershell -NoProfile -NonInteractive -Command Get-ExecutionPolicy and prints a warning block with the fix for Restricted/AllSigned while keeping exit code 0 (also shown for --dry-run)
- [x] #4 New `sbl doctor` command reports node >= 20, effective execution policy (skipped off win32), and backlog binary resolvability as [ok]/[warn]/[skip] lines
- [x] #5 `sbl doctor` exits 4 when at least one check warns, otherwise 0
- [x] #6 Unit tests cover: policy parsing and spawn-failure-to-null, doctor outcome matrix incl. exit codes, init warning presence without changing its exit code
- [x] #7 npm run lint passes and sbl doctor run on this machine (Restricted policy) demonstrates the warning live
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/lib/powershell.ts: getEffectiveExecutionPolicy() via powershell.exe -NoProfile -NonInteractive -Command Get-ExecutionPolicy; injectable executor; null on any failure; win32-only guard. 2. src/commands/doctor.ts plus cli.ts registration: checks node>=20 / execution policy (skip off-win32) / resolveBacklogBin(); [ok]/[warn]/[skip] lines; exit 4 on any warn else 0. 3. init.ts: after successful setup on win32, warn block for Restricted/AllSigned incl. fix command; exit stays 0; also shown on --dry-run. 4. Docs: README quickstart Windows note + troubleshooting.md section; extend cspell words if needed. 5. TDD order per slice: failing vitest test first, then implementation; verify with npm test, npm run lint, live sbl doctor on this machine.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: npm test 221/221 passing, npm run lint 0 issues, live sbl doctor on Restricted machine printed [warn] PowerShell execution policy Restricted and exited 4.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented PowerShell execution-policy mitigation: src/lib/powershell.ts detects effective policy, init.ts prints a one-time-fix warning while keeping exit 0, new sbl doctor command reports node/policy/backlog checks with exit 4 on warning, docs and cspell updated. Verified with full test suite (221 passing) and lint/cspell clean.
<!-- SECTION:FINAL_SUMMARY:END -->
