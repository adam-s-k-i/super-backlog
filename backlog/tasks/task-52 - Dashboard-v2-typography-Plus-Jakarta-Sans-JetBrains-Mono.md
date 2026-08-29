---
id: TASK-52
title: 'Dashboard v2: typography Plus Jakarta Sans + JetBrains Mono'
status: To Do
assignee: []
created_date: '2026-08-29 23:46'
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
- [ ] #1 Google Fonts link present with display=swap; offline renders on fallbacks
- [ ] #2 --sans and --mono tokens used by body and mono elements; no @font-face left
<!-- AC:END -->
