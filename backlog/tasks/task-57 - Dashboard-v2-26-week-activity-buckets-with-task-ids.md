---
id: TASK-57
title: 'Dashboard v2: 26-week activity buckets with task ids'
status: Done
assignee: []
created_date: '2026-08-29 23:47'
updated_date: '2026-08-30 02:16'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-56
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
computeActivity produces 182 daily buckets carrying touched task ids; adds missing updatedAt/createdAt camel-case fallbacks (fixes buckets dating modern CLI output to today). Plan task 7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Buckets are exactly 182 days, oldest first, ending today, each with ids matching count
- [x] #2 camelCase updatedAt/createdAt are honored
- [x] #3 Render test fixtures updated
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
computeActivity: 182 daily buckets with touched task ids, camelCase updatedAt/createdAt fallbacks (fixes all-today bucketing). Verified: unit tests (182 buckets, ids===count, drop-not-clamp); reviewer ran tsc --noEmit clean.
<!-- SECTION:FINAL_SUMMARY:END -->
