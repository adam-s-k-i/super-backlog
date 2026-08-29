---
id: TASK-46
title: Fix DEP0190 warnings and release v1.0.3
status: Done
assignee: []
created_date: '2026-08-28 20:20'
updated_date: '2026-08-28 20:20'
labels: []
dependencies: []
modified_files:
  - src/dashboard/server.ts
  - src/commands/backlog-alias.ts
  - src/commands/dashboard.ts
  - src/lib/run.ts
  - src/lib/preflight.ts
  - src/commands/uninstall.ts
  - src/commands/update.ts
  - test/unit/dashboard-command.test.ts
  - test/unit/preflight.test.ts
  - tsconfig.json
  - package.json
  - package-lock.json
  - .github/workflows/release.yml
priority: high
type: bug
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace shell: true child_process spawns with cross-spawn so Node.js stops emitting DEP0190 warnings and execution remains cross-platform.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No spawn calls in src use shell: true
- [x] #2 cross-spawn resolves npm/bin scripts on Windows without .cmd fallbacks
- [x] #3 npm test and npm run lint pass after the refactor
- [x] #4 npm latest for super-backlog is 1.0.3 and GitHub release v1.0.3 exists
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Enabled esModuleInterop/allowSyntheticDefaultImports in tsconfig.json; regenerated package-lock.json and pinned vitest peer esbuild to ^0.25.0; fixed release.yml publish gate output.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All shell: true spawns removed from src/ and dashboard tests; v1.0.3 published to npm and GitHub; DEP0190 warnings eliminated.
<!-- SECTION:FINAL_SUMMARY:END -->
