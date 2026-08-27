---
id: TASK-41
title: >-
  Project Dashboard: modal task details, Inter font, non-bold titles, and Up
  Next/Blocked flow
status: Done
assignee: []
created_date: '2026-08-27 21:47'
updated_date: '2026-08-27 21:56'
labels: []
dependencies: []
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve the project dashboard aesthetics and interaction: switch to Inter font, stop bolding task titles in the table, open task details in a centered modal dialog, and replace the low-value dependency graph with an Up Next / Blocked task view based on dependency status.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dashboard uses Inter as primary UI font with a system-ui fallback
- [x] #2 Task titles in the tasks table are rendered with normal font weight
- [x] #3 Clicking a task row opens a centered modal dialog with task ID, status, title, description, acceptance criteria, dependencies, and metadata
- [x] #4 Escape, backdrop click, and a close button dismiss the modal
- [x] #5 The dependency graph section is replaced by an Up Next list (tasks whose dependencies are done) and a Blocked list (tasks with incomplete dependencies, showing blockers)
- [x] #6 Empty state is shown when there are no up-next or blocked tasks
- [x] #7 The inline script in dashboard.html stays within the 650-line limit enforced by tests
- [x] #8 All existing dashboard unit tests pass and snapshots are updated if intentional
- [x] #9 Build and lint pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Load Inter font in dashboard.html head and apply to body. 2. Remove bold from .cell-title. 3. Replace the right-side detail panel with a native <dialog> modal: markup, styles, open/close handlers, Escape/backdrop/close support. 4. Update task row click to open the modal and remove inline accordion rows. 5. Replace dependency graph rendering with Up Next / Blocked lists based on deps and task status. 6. Keep inline script under 650 lines by removing unused graph/accordion code. 7. Update snapshots in test/unit/dashboard-render.test.ts. 8. Run tests, build, and lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation details: Added local @font-face for Inter (400/500/600) with system-ui fallback; updated body font stack. Removed bold from .cell-title. Replaced right-side #sbl-detail panel with native <dialog id="task-dialog"> using ::backdrop, scale-in animation, and reduced-motion fallback. Task rows now open the modal; inline accordion removed. Modal shows ID, status chip, title, description, metadata row, acceptance criteria, depends on/needed by. Escape, backdrop click, and close button dismiss. Replaced dependency graph with renderFlow() that computes Up Next (pending tasks with all prerequisites done) and Blocked (pending tasks with incomplete prerequisites, showing blocker links). Empty state shown when no pending tasks. Inline script is 554 lines (under 650). Updated snapshots and dashboard-render tests. Verification: npx vitest run (338 passed), npm run build, npm run lint, manual dashboard generation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented dashboard improvements: Inter font stack, normal-weight task titles, centered task-detail modal with metadata/ACs/deps, and a dependency-flow view that surfaces Up Next and Blocked tasks instead of the old graph. Verified with 338 passing tests, updated snapshots, successful build/lint, and a generated dashboard.html.
<!-- SECTION:FINAL_SUMMARY:END -->
