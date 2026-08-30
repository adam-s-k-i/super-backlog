---
id: TASK-55
title: 'Dashboard v2: draft cards with detail modal'
status: Done
assignee: []
created_date: '2026-08-29 23:46'
updated_date: '2026-08-30 02:16'
labels:
  - dashboard
milestone: m-1
dependencies:
  - TASK-54
references:
  - docs/superpowers/plans/2026-08-30-dashboard-redesign-v2.md
type: feature
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Drafts render as clickable flow-card style cards (id, status chip, title); clicking opens the shared dialog with description, meta grid, AC checklist and a copyable 'backlog draft promote' command. Plan task 5.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Draft cards show status chips and open the modal on click
- [x] #2 Modal shows description, priority, assignee, created, updated and ACs when present
- [x] #3 Promote command is copyable from the modal
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Draft flow-cards with status chips and full detail modal incl. copyable 'backlog draft promote' command. Verified: render tests; modal structure mirrors task dialog; draft card rendered in headless full-page shots.
<!-- SECTION:FINAL_SUMMARY:END -->
