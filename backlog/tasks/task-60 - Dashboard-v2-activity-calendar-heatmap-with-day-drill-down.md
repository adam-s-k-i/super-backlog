---
id: TASK-60
title: 'Dashboard v2: activity calendar heatmap with day drill-down'
status: To Do
assignee: []
created_date: '2026-08-29 23:47'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-59
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the sparkline with a 26-week calendar heatmap (5 intensity levels on the accent scale, month/weekday axes), an activity KPI strip (30d total, avg/week, busiest weekday, streak) and a click-to-open day panel listing that day's tasks. Plan task 10.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Heatmap renders 26 weeks with tooltips and theme-safe intensity classes
- [ ] #2 Clicking a day lists its tasks; each opens the task modal
- [ ] #3 Sparkline code and unused spark CSS removed
<!-- AC:END -->
