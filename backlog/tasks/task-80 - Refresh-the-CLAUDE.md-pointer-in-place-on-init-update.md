---
id: TASK-80
title: Refresh the CLAUDE.md pointer in place on init/update
status: Done
assignee: []
created_date: '2026-10-09 17:48'
updated_date: '2026-10-09 20:58'
labels:
  - feature
dependencies:
  - TASK-79
references:
  - docs/superpowers/plans/2026-10-09-subagent-model-routing.md
  - docs/superpowers/specs/2026-10-09-subagent-model-routing-design.md
type: feature
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 2. New src/lib/pointer.ts (findPointerSection, refreshPointer, POINTER_HEADING_RE) shared by applyClaudePointer in src/init/execute.ts and removePointerSection in src/commands/uninstall.ts. Stale pointer sections are replaced, identical ones left untouched, CRLF preserved.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A missing pointer is appended as before; a stale pointer section is replaced; an identical pointer causes no write
- [x] #2 Comparison ignores CRLF vs LF and existing line endings are preserved; content under other headings is never touched
- [x] #3 uninstall uses the shared helper and still removes the pointer section and block cleanly after a refresh
- [x] #4 Unit tests in test/unit/pointer.test.ts and the e2e tests in test/e2e/update.e2e.test.ts pass (second update run is byte-identical)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
New src/lib/pointer.ts (findPointerSection, refreshPointer) shared by init/update and uninstall: stale pointer sections are replaced in place, identical ones untouched, CRLF preserved (1f2bda3). Verified by 16 unit tests in pointer.test.ts and 2 e2e tests in update.e2e.test.ts (stale pointer+block refreshed with a byte-identical second run; uninstall after refresh leaves no remnants); full suite 579 passed / 4 skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
