---
id: TASK-112
title: 'Router v2: four-tier discovery'
status: Done
assignee: []
created_date: '2026-10-11 00:17'
updated_date: '2026-10-11 01:13'
labels:
  - feature
  - phase/verify
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
- [x] #1 rankFourTiers picks light/standard/strong/top by the spec's ordered patterns
- [x] #2 top falls back to strong; light patterns are excluded from higher tiers
- [x] #3 unit tests cover ranking and parsing
<!-- AC:END -->
