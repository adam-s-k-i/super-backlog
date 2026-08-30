---
id: TASK-60
title: 'Dashboard v2: activity calendar heatmap with day drill-down'
status: Done
assignee: []
created_date: '2026-08-29 23:47'
updated_date: '2026-08-30 02:16'
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
- [x] #1 Heatmap renders 26 weeks with tooltips and theme-safe intensity classes
- [x] #2 Clicking a day lists its tasks; each opens the task modal
- [x] #3 Sparkline code and unused spark CSS removed
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
26-week calendar heatmap (5 intensity levels, month/weekday axes), activity KPI strip, click-a-day panel opening task modals; sparkline code/CSS/tokens fully removed. Verified: render tests; geometry hand-checked in review; day panel exercised via DOM on live server.
<!-- SECTION:FINAL_SUMMARY:END -->
