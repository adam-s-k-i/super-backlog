---
id: TASK-69
title: 'Pipeline phase: dashboard UI badges, chips, stepper counts'
status: To Do
assignee: []
created_date: '2026-08-30 13:16'
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
- [ ] #1 Feature Cycle stepper shows live task counts per phase on steps 5-8 computed from task phase fields
- [ ] #2 Tasks table and detail modal show a phase chip per phased task; modal offers a copyable sbl phase <id> <next> command
- [ ] #3 No data-cmd or data-copy attributes; copy uses the existing copyCommand closure pattern
- [ ] #4 Snapshot updated deliberately; app-script budget cap raised and commented; render tests pass
<!-- AC:END -->
