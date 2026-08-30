---
id: TASK-67
title: 'Pipeline phase: doctor hygiene checks with fail status'
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-30 13:15'
updated_date: '2026-08-30 13:30'
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
- [x] #1 Multiple phase labels on one task and unknown phase/* values are reported as fail with fix hints; doctor exits 1
- [x] #2 In Progress tasks without a phase label produce a legacy warning with fix hint; doctor exits 4
- [x] #3 Unreadable task labels (backlog CLI unavailable) skip the check silently
- [x] #4 Doctor summary line counts fails; unit tests with injected readTaskLabels pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend test/unit/doctor.test.ts with check-4 cases (fail on multiple/unknown phase labels, warn legacy, skip unreadable). 2. Implement fail status + check 4 with injectable readTaskLabels in src/commands/doctor.ts. 3. Suite green. 4. Finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: doctor unit tests 14/14 (RED verified: 5 new cases failed before impl); full suite 62 files / 521 passed incl. real-repo doctor e2e. fail status exits 1 before the warn exit 4 rule.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added doctor check 4 (phase label hygiene) with new fail status: multiple/unknown phase labels fail with fix hints (exit 1), legacy In-Progress-without-phase warns (exit 4), unreadable labels skip; summary counts fails; verified by 14 unit tests and the green full suite.
<!-- SECTION:FINAL_SUMMARY:END -->
