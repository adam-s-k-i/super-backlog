---
id: TASK-68
title: 'Pipeline phase: dashboard data layer maps labels and derives phase'
status: To Do
assignee: []
created_date: '2026-08-30 13:15'
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
- [ ] #1 DashboardTask carries labels and phase field names exactly as defined in plan Task 4
- [ ] #2 normalizeTasks maps labels array-safe and derives phase via lib/phase; missing labels default to empty array and null phase
- [ ] #3 dashboard-data unit tests cover mapping, defaults, and duplicate-label leniency
<!-- AC:END -->
