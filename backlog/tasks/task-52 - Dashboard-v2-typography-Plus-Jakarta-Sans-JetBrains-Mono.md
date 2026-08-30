---
id: TASK-52
title: 'Dashboard v2: typography Plus Jakarta Sans + JetBrains Mono'
status: Done
assignee: []
created_date: '2026-08-29 23:46'
updated_date: '2026-08-30 02:16'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-51
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Load both families from Google Fonts with display=swap and full fallback stacks, introduce --sans token, update --mono, remove the local('Inter') font-face blocks, set heading weight 700. Plan task 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Google Fonts link present with display=swap; offline renders on fallbacks
- [x] #2 --sans and --mono tokens used by body and mono elements; no @font-face left
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Google Fonts link (Jakarta+JetBrains, display=swap), --sans/--mono tokens, Inter font-face removed. Verified: render tests assert link/tokens/no font-face; offline fallback stacks in place; suites green.
<!-- SECTION:FINAL_SUMMARY:END -->
