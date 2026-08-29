---
id: TASK-54
title: 'Dashboard v2: data layer - task created date and enriched drafts'
status: To Do
assignee: []
created_date: '2026-08-29 23:46'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-53
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DashboardTask gains created (createdAt/created_at/created); readDraftFile parses description and AC marker blocks plus priority, assignee, created_date, updated_date; DashboardDraft interface extended. Plan task 4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 normalizeTasks maps created from all three raw keys
- [ ] #2 readDrafts returns description, ACs and meta parsed from the draft markdown
- [ ] #3 Unit tests cover both with temp files / fixtures
<!-- AC:END -->
