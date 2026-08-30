---
id: TASK-65
title: 'Pipeline phase: pure phase-label library (src/lib/phase.ts)'
status: To Do
assignee: []
created_date: '2026-08-30 13:15'
labels:
  - feature
  - cli
  - phase/spec
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
- [ ] #1 src/lib/phase.ts exports PHASES, phaseLabel, isPhaseTarget, extractPhaseLabels, derivePhase, planTransition with the exact signatures from plan Task 1
- [ ] #2 planTransition validates: unknown-phase, no-phase (non-spec on unlabeled task), multiple-phases (two phase labels), and produces swap plans incl. done (remove only)
- [ ] #3 test/unit/phase.test.ts covers all cases and passes
<!-- AC:END -->
