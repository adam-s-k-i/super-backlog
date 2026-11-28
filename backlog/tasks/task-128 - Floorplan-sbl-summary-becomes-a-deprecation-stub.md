---
id: TASK-128
title: 'Floorplan: sbl summary becomes a deprecation stub'
status: In Progress
assignee: []
created_date: '2026-11-28T13:50:48Z'
updated_date: '2026-11-28T14:53:53Z'
labels:
  - feature
  - phase/impl
dependencies:
  - TASK-127
references:
  - docs/superpowers/specs/2026-11-28-floorplan-integration-design.md
type: feature
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Shrink src/commands/summary.ts to the stub from spec decision 6 and update the sbl help text. After this task no command imports summary-schema or summary-drift.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 sbl summary prints the deprecation line plus the map status line inside a project and exits 0; outside a project only the deprecation line is printed
- [ ] #2 Old options such as --check and --json are accepted, ignored and still exit 0
- [ ] #3 sbl help lists summary as deprecated and no longer shows a summary options block
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan section 'Task 2 (TASK-128)' in docs/superpowers/plans/2026-11-28-floorplan-integration.md: rewrite unit/integration/contract tests for the stub, shrink src/commands/summary.ts, update help text and argument handling in src/cli.ts, verify, commit. Runs after TASK-127.
<!-- SECTION:PLAN:END -->
