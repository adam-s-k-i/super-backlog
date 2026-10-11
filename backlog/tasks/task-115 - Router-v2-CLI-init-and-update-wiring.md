---
id: TASK-115
title: 'Router v2: CLI, init and update wiring'
status: Done
assignee: []
created_date: '2026-10-11 00:17'
updated_date: '2026-10-11 01:13'
labels:
  - feature
  - phase/verify
dependencies:
  - TASK-114
  - TASK-112
references:
  - docs/superpowers/plans/2026-10-11-router-v2.md
type: feature
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 5: sbl models show/enable/disable/set/discover, init and update call applyRouter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sbl models set validates harness, tier and model and never changes enabled
- [x] #2 discover persists OpenCode tiers or exits 1 without writing
- [x] #3 sbl update refreshes router files before the block and stays silent without a router
<!-- AC:END -->
