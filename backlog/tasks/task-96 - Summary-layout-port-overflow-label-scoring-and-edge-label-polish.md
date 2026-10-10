---
id: TASK-96
title: 'Summary layout: port overflow, label scoring and edge-label polish'
status: To Do
assignee: []
created_date: '2026-10-10 10:28'
labels:
  - enhancement
  - phase/spec
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
  - src/dashboard/summary-layout.ts
type: enhancement
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the project-summary final review (v1.7.0). The server-side layout in src/dashboard/summary-layout.ts meets spec L1-L7 for the dogfood diagram but has known rough edges: more ports than fit on one node side are not clamped, label placement ignores some obstacles, short segments clip their labels, and layoutArchitecture is a ~195-line function. The client mirror between the sbl:badge-mirror markers in src/templates/summary.html must stay in sync (drift-guard test).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A node side with more ports than fit is either clamped inside the node box or reported as a 'port-overflow' layout warning surfaced by sbl doctor; a test covers it
- [ ] #2 Edge label scoring also avoids the edge's own other leg and zone labels; the client mirror is updated and the drift-guard test passes
- [ ] #3 Segments and points use the same rounding
- [ ] #4 Edge labels on short segments are not clipped to an ellipsis when an alternative position exists (the dogfood dev>cli label renders fully, or the reason is documented)
- [ ] #5 layoutArchitecture is split into named steps with unchanged output (snapshot changes only for intended fixes); the '* half + 0' -0 normalisation and the straight-edge -9/+9 shared-offset trade-off carry explanatory comments
- [ ] #6 Overlap tests use measured-width-like label boxes and include non-flow edges
- [ ] #7 npm test passes
<!-- AC:END -->
