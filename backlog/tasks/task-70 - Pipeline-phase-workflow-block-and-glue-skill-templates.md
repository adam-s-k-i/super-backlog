---
id: TASK-70
title: 'Pipeline phase: workflow-block and glue-skill templates'
status: To Do
assignee: []
created_date: '2026-08-30 13:16'
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
- [ ] #1 workflow-block.md pipeline table maps phase/spec..phase/verify and label removal at done; new rule mandates transitions only via sbl phase
- [ ] #2 spec-to-backlog.md creates tasks with phase/spec and mentions sbl phase; its create example uses the real --labels flag
- [ ] #3 task-review-gate.md covers session entry, phase loading, per-phase resume matrix while keeping STOP/explicit-approval/never-self-approve semantics
- [ ] #4 templates.test.ts and glue-skills.test.ts extended; suite green
<!-- AC:END -->
