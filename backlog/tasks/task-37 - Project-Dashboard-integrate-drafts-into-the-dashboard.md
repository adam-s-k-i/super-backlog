---
id: TASK-37
title: 'Project Dashboard: integrate drafts into the dashboard'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 19:13'
updated_date: '2026-08-27 20:47'
labels:
  - ux
dependencies: []
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The dashboard currently only displays Backlog tasks. Extend the dashboard to also list drafts from backlog/drafts/*.md so the Project Dashboard reflects all open work items, not just committed tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dashboard reads all draft files and extracts id, title, and status
- [x] #2 Drafts are rendered in a dedicated panel or section
- [x] #3 Draft count matches backlog draft list --plain
- [x] #4 Regenerating the dashboard after adding/removing a draft updates the displayed list
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add DashboardDraft type and readDrafts() parser to src/dashboard/data.ts.\n2. Include drafts array in DashboardData and collectDashboardData().\n3. Update src/templates/dashboard.html to render a draft panel in Section 01 (Board & Quick Actions) or new Section 08.\n4. Update src/dashboard/render.ts if static placeholders are needed.\n5. Add unit tests for readDrafts parsing and snapshot expectations.\n6. Run npm test and verify draft count matches backlog draft list --plain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: added DashboardDraft type and readDrafts() to src/dashboard/data.ts, integrated drafts into DashboardData, added panel to src/templates/dashboard.html Section 01 with renderDrafts() JS. Added unit tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Drafts from backlog/drafts/*.md are now read, sorted by id, and rendered in a dedicated panel in Section 01. Verified with npm test (328 passed), build, lint, and manual dashboard regeneration showing/hiding a test draft.
<!-- SECTION:FINAL_SUMMARY:END -->
