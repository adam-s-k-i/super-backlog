---
id: TASK-1
title: 'v1.0.1: unify invalid-JSON exit codes and fix planner warning text'
status: Done
assignee: []
created_date: '2026-08-25 23:27'
updated_date: '2026-08-25 23:34'
labels:
  - cli
dependencies: []
type: bug
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Final review parked two defects: (1) init with malformed package.json exits 2 and update with either malformed JSON file exits 2 via RefusalError, contradicting the documented exit-code contract where 1 means detection failure; (2) planner degraded-auto warning still claims JSON merges are skipped although the opencode.json merge now runs regardless since fix f4f280d.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 init with malformed package.json exits 1
- [x] #2 update with malformed opencode.json exits 1
- [x] #3 update with malformed package.json exits 1
- [x] #4 degraded-auto warning no longer mentions JSON merges; regression test pins the new text
- [x] #5 docs/troubleshooting.md exit-code table verified accurate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. execute.ts: new exported InvalidJsonError + validateJsonFile(path,label); parseJsonFile delegates to it. 2. init.ts: catch InvalidJsonError -> exit 1 (RefusalError stays 2 for ownership). 3. update.ts: up-front validate existing package.json/opencode.json -> exit 1 naming the file (mirrors uninstall; gives refresh flow future-proof guard). 4. planner.ts line ~67 warning text: no longer claims JSON merges skipped. 5. TDD: failing e2e (init malformed pkg -> 1; update malformed opencode/pkg -> 1) + planner regression pinning text without /JSON merges/. 6. docs/troubleshooting.md row check. 7. Full suite green, finalize task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: vitest run = 21 files / 113 tests passing (4 new e2e + planner regression). init malformed package.json exits 1 with not-valid-JSON message (test/e2e/init.e2e.test.ts). update with malformed opencode.json or package.json exits 1 naming the file (test/e2e/update.e2e.test.ts). Planner warning pinned without JSON-merges phrase (test/unit/planner.test.ts). docs/troubleshooting.md row 1 covers invalid JSON, verified by reading rendered table.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unified invalid-JSON handling to exit 1: new InvalidJsonError + validateJsonFile in execute.ts, init catches it before RefusalError (2 stays ownership-only), update validates package.json and opencode.json up front before mutating. Planner degraded-auto warning no longer claims JSON merges are skipped. Verified with 113 passing tests incl. 4 new e2e cases and a text-pinning planner assertion.
<!-- SECTION:FINAL_SUMMARY:END -->
