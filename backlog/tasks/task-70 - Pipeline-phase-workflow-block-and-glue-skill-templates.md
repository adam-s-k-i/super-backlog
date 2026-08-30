---
id: TASK-70
title: 'Pipeline phase: workflow-block and glue-skill templates'
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-30 13:16'
updated_date: '2026-08-30 13:41'
labels:
  - feature
  - skills
  - phase/spec
dependencies:
  - TASK-66
references:
  - docs/superpowers/plans/2026-08-30-pipeline-phase.md
type: feature
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teach the convention in the injected templates: workflow block gains the phase-label column and binding rule 5, spec-to-backlog sets phase/spec at creation (also fixes the wrong --label flag to --labels in its create example), task-review-gate becomes session entry with per-phase resume behavior. Implements plan Task 6.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 workflow-block.md pipeline table maps phase/spec..phase/verify and label removal at done; new rule mandates transitions only via sbl phase
- [x] #2 spec-to-backlog.md creates tasks with phase/spec and mentions sbl phase; its create example uses the real --labels flag
- [x] #3 task-review-gate.md covers session entry, phase loading, per-phase resume matrix while keeping STOP/explicit-approval/never-self-approve semantics
- [x] #4 templates.test.ts and glue-skills.test.ts extended; suite green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Failing template tests (phase labels in workflow block, sbl phase mandate, skill resume matrix). 2. Update workflow-block.md, skill-spec-to-backlog.md, skill-task-review-gate.md. 3. Suite green. 4. Finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: template+glue tests 18/18 (RED verified: 3 new failed before impl); full suite 62 files / 530 passed. Note: template files carry no managed-by fingerprint (injected at install time); workflow-block keeps {{VERSION}} token.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Workflow block now maps phases to labels with binding rule 5 (transitions only via sbl phase), spec-to-backlog sets phase/spec at creation and uses the real --labels flag, task-review-gate became the session entry with per-phase resume; verified by extended template tests and the green full suite.
<!-- SECTION:FINAL_SUMMARY:END -->
