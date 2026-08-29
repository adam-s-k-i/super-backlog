---
id: TASK-47
title: 'Dashboard: single Backlog button with modal overlay'
status: In Progress
assignee: []
created_date: '2026-08-29 16:19'
updated_date: '2026-08-29 16:30'
labels: []
dependencies: []
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Story B: replace the three quick-action buttons with one Backlog button; hub manages a backlog-browser child per project (POST /p/<slug>/api/backlog-browser); near-fullscreen dialog with iframe (spike confirmed embeddable); retire the /api/run whitelist.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Section 01 shows exactly one Backlog button
- [x] #2 Hub starts/reuses backlog browser per project and kills it on close
- [x] #3 Modal shows the embedded backlog UI with close and open-in-tab
- [x] #4 /api/run is removed
<!-- AC:END -->
