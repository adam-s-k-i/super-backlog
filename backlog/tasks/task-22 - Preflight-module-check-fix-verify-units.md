---
id: TASK-22
title: 'Preflight module: check/fix/verify units'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 11:44'
updated_date: '2026-08-27 11:55'
labels:
  - feature
milestone: m-0
dependencies: []
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New src/lib/preflight.ts that upgrades doctor from diagnose-only to diagnose+repair. Each known failure domain is a Check -> Fix -> Verify unit with fakeable Executor (pattern from doctor.ts/powershell.ts). Domains: (1) Node missing/too old -> winget/brew install; (2) PowerShell execution policy blocking -> Set-ExecutionPolicy CurrentUser RemoteSigned; (3) npm call fails on policy -> use npm.cmd (always safe, no consent needed); (4) sbl not on PATH after global install -> session PATH refresh, else report npm global bin path; (5) backlog CLI unresolvable -> npm install / reinstall; (6) partial installation -> detect, clean, continue. Every fix is verified after execution (e.g. sbl --version). System-changing fixes (1,2) require consent or --fix-all; safe fixes (3-6) run automatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 preflight.ts exposes reusable check/fix/verify units with dependency injection like doctor.ts
- [x] #2 Each fix is verified after execution and reports success/failure with a manual fallback command
- [x] #3 System-changing fixes are gated behind consent or fixAll flag; safe fixes run unconditionally
- [x] #4 Unit tests cover every domain including failure paths, using a fake executor
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Write failing unit tests (test/unit/preflight.test.ts) for all 6 domains + consent gating + failure paths, using fake executor/confirm callback. 2. Implement src/lib/preflight.ts: generic check/fix/verify unit runner with DI (platform, executor, nodeVersion, resolveBacklog, exists, log, confirm, fixAll). 3. Units: node-version (winget/brew), execution-policy (RemoteSigned), npm-cmd-fallback, sbl-on-path (session PATH refresh), backlog-bin (npm install), partial-install (detect/clean). 4. System-changing units gated behind confirm/fixAll; safe units run unconditionally. 5. Every fix verified; report includes manual fallback command on failure. 6. Run vitest until green, then build + full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TDD: 17 failing tests written first (module-missing RED), then src/lib/preflight.ts implemented. Full suite: 273/273 green, tsc build clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added src/lib/preflight.ts: six check/fix/verify units (node-version via winget/brew, execution-policy via Set-ExecutionPolicy, npm-cmd fallback, partial-install repair, backlog-bin reinstall, sbl-on-path session PATH refresh) with DI executor/confirm seams like doctor.ts. System-changing fixes gated behind confirm callback or fixAll; every fix verified post-execution with manual fallback command on failure. Verified with test/unit/preflight.test.ts (17 tests incl. failure paths) and full vitest suite 273/273 green.
<!-- SECTION:FINAL_SUMMARY:END -->
