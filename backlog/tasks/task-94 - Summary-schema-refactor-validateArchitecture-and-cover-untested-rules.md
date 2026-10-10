---
id: TASK-94
title: 'Summary schema: refactor validateArchitecture and cover untested rules'
status: To Do
assignee: []
created_date: '2026-10-10 10:28'
labels:
  - chore
  - phase/spec
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
  - src/dashboard/summary-schema.ts
type: chore
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the project-summary final review (v1.7.0). validateArchitecture in src/dashboard/summary-schema.ts is a ~340-line function with duplicated constants and messages, a few rules produce cascading or skipped diagnostics, and several validation rules have no test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 validateArchitecture is split into per-section helpers (nodes, edges, flows, zones, stack, commands, tasks) with unchanged public behaviour; existing tests pass unmodified
- [ ] #2 The id-pattern error message is defined once; STEP_RE is built from ID_RE instead of duplicating it; the stack package length 214 lives in LIMITS
- [ ] #3 When the nodes list exceeds its limit, edges, flows and highlights referencing the dropped nodes no longer cascade into one 'unknown node' error per reference (one overflow error is enough)
- [ ] #4 A flow with an invalid id still gets its label checked; a dropped flow does not consume a default colour slot
- [ ] #5 Unit tests cover: unknown-key warnings, invalid id format, bad flow colour, non-boolean dashed, reversed zone range, boundary lengths (exactly at and one over each limit) and commands group limits
- [ ] #6 npm test passes
<!-- AC:END -->
