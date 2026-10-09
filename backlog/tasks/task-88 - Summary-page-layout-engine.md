---
id: TASK-88
title: 'Summary page: layout engine'
status: To Do
assignee: []
created_date: '2026-10-09 21:51'
updated_date: '2026-10-09 22:00'
labels:
  - feature
  - phase/plan
milestone: m-2
dependencies:
  - TASK-86
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
type: feature
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 4. src/dashboard/summary-layout.ts implementing the L1-L7 layout contract (grid placement, orthogonal routing, ports, label slots).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both fixtures produce crossings === 0, collisions === 0 and no warnings
- [ ] #2 Output is deterministic: deep-equal across two runs and after a JSON round-trip
- [ ] #3 Route kinds H, V, VH, HV each tested on a minimal grid; an impossible route yields route-fallback and still returns a polyline
- [ ] #4 Port order on one side never crosses; label slot scoring prefers the collision-free candidate
<!-- AC:END -->
