---
id: TASK-65
title: 'Pipeline phase: pure phase-label library (src/lib/phase.ts)'
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-30 13:15'
updated_date: '2026-08-30 15:38'
labels:
  - feature
  - cli
dependencies: []
references:
  - docs/superpowers/plans/2026-08-30-pipeline-phase.md
type: feature
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Foundation for the explicit pipeline phase feature: the four phase labels (phase/spec, phase/plan, phase/impl, phase/verify), label extraction, lenient phase derivation, and pure transition validation with a no-op-safe plan output. Implements plan Task 1 of the pipeline-phase plan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 src/lib/phase.ts exports PHASES, phaseLabel, isPhaseTarget, extractPhaseLabels, derivePhase, planTransition with the exact signatures from plan Task 1
- [x] #2 planTransition validates: unknown-phase, no-phase (non-spec on unlabeled task), multiple-phases (two phase labels), and produces swap plans incl. done (remove only)
- [x] #3 test/unit/phase.test.ts covers all cases and passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Write failing unit tests test/unit/phase.test.ts per plan Task 1 (docs/superpowers/plans/2026-08-30-pipeline-phase.md). 2. Implement src/lib/phase.ts minimal to pass. 3. Full suite green. 4. Finalize with evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: npx vitest run test/unit/phase.test.ts -> 11/11 pass (RED verified first: module-not-found). Full suite npm test -> 61 files, 504 passed, 4 skipped.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added pure phase-label model src/lib/phase.ts (PHASES, phaseLabel, isPhaseTarget, extractPhaseLabels, derivePhase, planTransition) with full transition validation; verified by 11 unit tests plus the green full suite.
<!-- SECTION:FINAL_SUMMARY:END -->
