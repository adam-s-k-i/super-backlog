---
id: TASK-68
title: 'Pipeline phase: dashboard data layer maps labels and derives phase'
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-30 13:15'
updated_date: '2026-08-30 13:34'
labels:
  - feature
  - dashboard
  - phase/spec
dependencies:
  - TASK-65
references:
  - docs/superpowers/plans/2026-08-30-pipeline-phase.md
type: feature
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DashboardTask gains labels (string[]) and phase (derived, lenient on duplicates) mapped from the backlog task list --json output. Implements plan Task 4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DashboardTask carries labels and phase field names exactly as defined in plan Task 4
- [x] #2 normalizeTasks maps labels array-safe and derives phase via lib/phase; missing labels default to empty array and null phase
- [x] #3 dashboard-data unit tests cover mapping, defaults, and duplicate-label leniency
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Failing normalizeTasks tests (labels + derived phase, defaults, duplicate leniency) in test/unit/dashboard-data.test.ts. 2. Extend DashboardTask + mapping in src/dashboard/data.ts via lib/phase. 3. Suite green. 4. Finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: dashboard-data tests 44/44 (RED verified: 3 new failed before impl); full suite 62 files / 524 passed. SAMPLE fixture in dashboard-render.test.ts gained labels/phase (typecheck requirement) and the render snapshot was refreshed deliberately - island diff reviewed, only phase/label additions.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DashboardTask now carries labels and derived phase mapped via lib/phase (array-safe, lenient on duplicates); verified by 3 new normalizeTasks tests, a reviewed snapshot refresh, and the green full suite.
<!-- SECTION:FINAL_SUMMARY:END -->
