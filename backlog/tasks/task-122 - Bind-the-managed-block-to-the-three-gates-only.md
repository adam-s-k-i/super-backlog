---
id: TASK-122
title: Bind the managed block to the three gates only
status: To Do
assignee: []
created_date: '2026-10-19 17:32'
updated_date: '2026-10-19 18:12'
labels:
  - fix
  - phase/impl
dependencies:
  - TASK-121
references:
  - docs/superpowers/plans/2026-10-19-fewer-interruptions.md
type: bug
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rewrite rules 6, 7, 8 and the delegation section of src/templates/workflow-block.md per spec section 2. Plan task 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Rule 6, 7 and the new rule 8 match the spec text verbatim
- [ ] #2 Block contains neither 'critical-areas.md' nor 'Independent check'; opening paragraph says 'Default is to do the work yourself in the session.'
- [ ] #3 templates.test.ts and update.e2e.test.ts pass
<!-- AC:END -->
