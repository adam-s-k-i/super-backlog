---
id: TASK-104
title: 'Summary drift: dogfood the repo''s architecture.yml and close TASK-98'
status: To Do
assignee: []
created_date: '2026-10-10 15:07'
labels:
  - chore
  - phase/spec
dependencies:
  - TASK-102
  - TASK-103
references:
  - docs/superpowers/specs/2026-10-10-summary-drift-design.md
  - docs/superpowers/plans/2026-10-10-summary-drift.md
type: chore
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 5. Bring this repo's own backlog/docs/architecture.yml up to date with the new command, refresh the managed glue files, verify sbl summary is clean, and close TASK-98 as superseded by this feature.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cli node in backlog/docs/architecture.yml describes eight commands including summary and documents the new files
- [ ] #2 Managed glue (AGENTS.md block, installed skills) is refreshed through sbl update, not by hand
- [ ] #3 node dist/bin.js summary exits 0 at the repo root
- [ ] #4 TASK-98 is closed as superseded with a final summary pointing to the spec (via the backlog CLI after user approval)
- [ ] #5 npm test and npm run lint pass
<!-- AC:END -->
