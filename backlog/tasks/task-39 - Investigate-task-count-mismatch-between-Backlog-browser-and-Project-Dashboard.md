---
id: TASK-39
title: Investigate task count mismatch between Backlog browser and Project Dashboard
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 19:13'
updated_date: '2026-08-27 21:00'
labels:
  - dashboard
  - bug
dependencies: []
type: bug
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The number of tasks shown in the Project Dashboard differs from the count in the Backlog browser. Investigate the filtering, normalization, or source data that causes the mismatch and align the dashboard count with the Backlog browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Root cause of the mismatch is documented in the task file
- [x] #2 Dashboard task count matches Backlog browser count for the same project state
- [x] #3 Fix includes a regression test or manual verification steps
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Compare the number of tasks shown in backlog browser with the number shown in the Project Dashboard for the current project state.\n2. Inspect the filtering/normalization logic in src/dashboard/data.ts, especially normalizeTasks, computeStatuses, and the backlog task list --json output.\n3. Identify the root cause (e.g. archived tasks excluded, status normalization, drafts counted differently).\n4. Implement a fix so counts match.\n5. Add regression test or manual verification steps.\n6. Run npm test and generate dashboard to confirm counts match.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation: compared backlog task list --json (40 tasks: 36 Done, 1 In Progress, 3 To Do) with the Project Dashboard generated from the same project state (40 tasks, same distribution). Both use the same backlog task list source, so counts currently match. Potential root causes for historical mismatches: (1) stale dashboard.html not regenerated after backlog changes; (2) status case sensitivity splitting counts when the browser normalizes status casing. Added regression tests verifying dashboard task count and status totals equal the raw backlog task list.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Investigated task count mismatch. Current Project Dashboard and backlog browser both consume backlog task list --json and report identical counts (40 tasks: 36 Done, 1 In Progress, 3 To Do). Documented likely root causes as stale dashboard snapshots or status-case normalization. Added regression tests in test/unit/dashboard-data.test.ts. Verified with npm test (331 passed), build, lint, and manual dashboard regeneration.
<!-- SECTION:FINAL_SUMMARY:END -->
