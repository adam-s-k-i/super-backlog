---
id: TASK-127
title: 'Floorplan: map status reader and doctor check 5'
status: In Progress
assignee: []
created_date: '2026-11-28T13:50:45Z'
updated_date: '2026-11-28T15:19:09Z'
labels:
  - feature
  - phase/verify
dependencies: []
references:
  - docs/superpowers/specs/2026-11-28-floorplan-integration-design.md
type: feature
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add src/lib/floorplan.ts, the only module that knows the Floorplan file layout (spec decision 3), and replace doctor check 5 with the map status (spec decision 5). After this task src/commands/doctor.ts no longer imports summary-schema, summary-layout or summary-drift.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 readFloorplanStatus returns missing, invalid or map exactly as spec decision 3 defines them and never throws; a head that is not a 40-character hex string never reaches git
- [x] #2 sbl doctor check 5 prints the five rows of the spec table with the stated status; a map behind HEAD is ok and leaves the exit code at 0
- [x] #3 When backlog/docs/architecture.yml exists, sbl doctor adds a skip line saying the file is no longer used and safe to delete; the file itself is never deleted
- [x] #4 floorplanStatusLine is the single source of the status wording, covered by unit tests for every row
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan section 'Task 1 (TASK-127)' in docs/superpowers/plans/2026-11-28-floorplan-integration.md: failing tests for readFloorplanStatus/floorplanStatusLine, create src/lib/floorplan.ts, rewrite doctor check 5 with the legacy-file skip line, verify, commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified on HEAD 330a1b7: npm test 76 files, 943 passed, 4 skipped; npx tsc --noEmit rc=0; npm run lint 0 issues; npx vitepress build docs ok. Commit f086ac4. Unit tests cover missing/invalid/map, the 40-hex head guard and every status row; live check in this repo: sbl doctor prints '[ok] floorplan map built 2026-11-28, 1 commit behind HEAD (160 files, 10 parts)', 5 ok, 0 fail, exit 0.
<!-- SECTION:NOTES:END -->
