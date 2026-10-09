---
id: TASK-80
title: Refresh the CLAUDE.md pointer in place on init/update
status: To Do
assignee: []
created_date: '2026-10-09 17:48'
updated_date: '2026-10-09 17:53'
labels:
  - feature
  - phase/plan
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
- [ ] #1 A missing pointer is appended as before; a stale pointer section is replaced; an identical pointer causes no write
- [ ] #2 Comparison ignores CRLF vs LF and existing line endings are preserved; content under other headings is never touched
- [ ] #3 uninstall uses the shared helper and still removes the pointer section and block cleanly after a refresh
- [ ] #4 Unit tests in test/unit/pointer.test.ts and the e2e tests in test/e2e/update.e2e.test.ts pass (second update run is byte-identical)
<!-- AC:END -->
