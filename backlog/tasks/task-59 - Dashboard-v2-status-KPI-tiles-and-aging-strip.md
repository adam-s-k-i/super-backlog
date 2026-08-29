---
id: TASK-59
title: 'Dashboard v2: status KPI tiles and aging strip'
status: To Do
assignee: []
created_date: '2026-08-29 23:47'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-58
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Four KPI tiles (progress+forecast, velocity, wip/blocked as table filters, age with oldest-task link) above the donut plus an SVG aging strip (one lane per open status, stale >= 14d in warn tone, click opens the task modal). Tooltips declare the approximation. Plan task 9.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tiles render from data.kpis with approximation tooltips
- [ ] #2 WIP and blocked tiles filter the tasks table and reset cleanly against pill filters
- [ ] #3 Aging dots positioned by age, stale dots amber, click opens task modal
<!-- AC:END -->
