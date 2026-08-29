---
id: TASK-58
title: 'Dashboard v2: KPI metrics module'
status: To Do
assignee: []
created_date: '2026-08-29 23:47'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-57
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New src/dashboard/metrics.ts with computeKpis (progress, forecast, velocity windows, wip, blocked via deps/status, open-task ages, activity aggregates incl. streak and busiest weekday); wired into DashboardData.kpis for both live and fallback paths. Plan task 8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 computeKpis matches the documented definitions with unit tests on fixed today
- [ ] #2 Forecast hidden at velocity 0; blocked counts dep-blocked and status-blocked tasks
- [ ] #3 DashboardData carries kpis in live and fallback modes
<!-- AC:END -->
