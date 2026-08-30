---
id: TASK-53
title: 'Dashboard v2: section reorder, model-router button, drafts section'
status: Done
assignee: []
created_date: '2026-08-29 23:46'
updated_date: '2026-08-30 02:16'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-52
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New order 01 Board, 02 Status, 03 Feature Cycle, 04 Milestones, 05 Drafts, 06 Tasks, 07 Activity, 08 Decisions and Docs; sidebar nav and sec ids renumbered; model router becomes a cmd-btn next to Backlog (keeps id models-btn); drafts block moves into section 05. Plan task 3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Nav and sections match the approved order with renumbered anchors
- [x] #2 Model Router cmd-btn opens the existing models dialog; sidebar text link removed
- [x] #3 Drafts render inside section 05 with its own sec-head
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sections reordered 01-08, model router as cmd-btn (id kept, modal unchanged), drafts in own section 05. Verified: render tests + snapshot; Feature Cycle block byte-identical after move; suites green.
<!-- SECTION:FINAL_SUMMARY:END -->
