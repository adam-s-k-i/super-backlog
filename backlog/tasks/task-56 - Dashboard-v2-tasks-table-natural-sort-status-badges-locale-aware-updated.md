---
id: TASK-56
title: 'Dashboard v2: tasks table natural sort, status badges, locale-aware updated'
status: To Do
assignee: []
created_date: '2026-08-29 23:46'
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
- [ ] #1 Sorting by ID yields task-1, task-2, ..., task-10
- [ ] #2 Status cells render the same chips as the task modal
- [ ] #3 Updated shows relative time in the browser locale, exact timestamp as tooltip, centered; unparsable values fall back to the raw string
<!-- AC:END -->
