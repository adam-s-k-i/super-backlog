---
id: TASK-69
title: 'Pipeline phase: dashboard UI badges, chips, stepper counts'
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-30 13:16'
updated_date: '2026-08-30 13:38'
labels:
  - feature
  - dashboard
  - phase/spec
dependencies:
  - TASK-68
references:
  - docs/superpowers/plans/2026-08-30-pipeline-phase.md
type: feature
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Client-side phase rendering in the dashboard template: live task counts on pipeline steps 5-8, phase chips in the tasks table and detail modal, copyable sbl phase advance command in the modal. Implements plan Task 5.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Feature Cycle stepper shows live task counts per phase on steps 5-8 computed from task phase fields
- [x] #2 Tasks table and detail modal show a phase chip per phased task; modal offers a copyable sbl phase <id> <next> command
- [x] #3 No data-cmd or data-copy attributes; copy uses the existing copyCommand closure pattern
- [x] #4 Snapshot updated deliberately; app-script budget cap raised and commented; render tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Failing render tests (phase in island, phaseCounts in app script, no data-cmd) + budget raise in test/unit/dashboard-render.test.ts. 2. Implement phase constants/counts, stepper badges, row chip, modal cell + advance chip, CSS in src/templates/dashboard.html. 3. Refresh snapshot, review diff. 4. Suite green. 5. Finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: render tests 86/86 (RED verified: phaseCounts assertion failed before impl); snapshot diff reviewed line by line - 36 insertions, all phase-related (CSS, id-cell chip, stepper badge, constants, meta cell, advance chip); full suite 62 files / 527 passed. Budget cap raised 1109 -> 1180 with comment.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dashboard renders pipeline phases: stepper counts on steps 5-8, phase chip in task rows and detail modal, copyable sbl phase advance chip; verified by 3 new render tests, reviewed snapshot refresh, and the green full suite.
<!-- SECTION:FINAL_SUMMARY:END -->
