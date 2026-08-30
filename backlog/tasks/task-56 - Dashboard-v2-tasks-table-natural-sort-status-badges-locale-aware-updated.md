---
id: TASK-56
title: 'Dashboard v2: tasks table natural sort, status badges, locale-aware updated'
status: Done
assignee: []
created_date: '2026-08-29 23:46'
updated_date: '2026-08-30 02:16'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-55
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Field-aware comparator (numeric localeCompare; updated compares timestamps), status cells become status-chip badges, updated column centered with Intl.RelativeTimeFormat text and exact Intl.DateTimeFormat tooltip. Plan task 6.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sorting by ID yields task-1, task-2, ..., task-10
- [x] #2 Status cells render the same chips as the task modal
- [x] #3 Updated shows relative time in the browser locale, exact timestamp as tooltip, centered; unparsable values fall back to the raw string
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Field-aware natural sort (numeric localeCompare, timestamp for updated), status-chip badges, centered locale-aware Updated (relative + exact tooltip, raw fallback). Verified: render tests assert comparator/Intl usage; live table showed 'vor 2 Wochen' style output and task-1..task-2..task-10 ordering.
<!-- SECTION:FINAL_SUMMARY:END -->
