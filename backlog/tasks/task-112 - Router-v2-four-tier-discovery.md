---
id: TASK-112
title: 'Router v2: four-tier discovery'
status: To Do
assignee: []
created_date: '2026-10-11 00:17'
updated_date: '2026-10-11 00:17'
labels:
  - feature
  - phase/impl
dependencies:
  - TASK-111
references:
  - docs/superpowers/plans/2026-10-11-router-v2.md
type: feature
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 2: rankFourTiers over opencode models output with ordered preferences and light exclusion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 rankFourTiers picks light/standard/strong/top by the spec's ordered patterns
- [ ] #2 top falls back to strong; light patterns are excluded from higher tiers
- [ ] #3 unit tests cover ranking and parsing
<!-- AC:END -->
