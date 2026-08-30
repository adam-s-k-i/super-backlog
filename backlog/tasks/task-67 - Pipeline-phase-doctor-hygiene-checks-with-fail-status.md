---
id: TASK-67
title: 'Pipeline phase: doctor hygiene checks with fail status'
status: To Do
assignee: []
created_date: '2026-08-30 13:15'
labels:
  - feature
  - cli
  - phase/spec
dependencies:
  - TASK-65
references:
  - docs/superpowers/plans/2026-08-30-pipeline-phase.md
type: feature
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Doctor check 4 validates phase label hygiene across all tasks and introduces the fail status (exit 1). Implements plan Task 3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Multiple phase labels on one task and unknown phase/* values are reported as fail with fix hints; doctor exits 1
- [ ] #2 In Progress tasks without a phase label produce a legacy warning with fix hint; doctor exits 4
- [ ] #3 Unreadable task labels (backlog CLI unavailable) skip the check silently
- [ ] #4 Doctor summary line counts fails; unit tests with injected readTaskLabels pass
<!-- AC:END -->
