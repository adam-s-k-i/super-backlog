---
id: TASK-14
title: 'Document operations: workflows, cadence, failure behavior, setup checklist'
status: To Do
assignee: []
created_date: '2026-08-26 02:03'
labels:
  - ci
  - docs
dependencies:
  - TASK-13
priority: medium
type: docs
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/operations.md describes every automation workflow (trigger, permissions, cadence, failure behavior), records the one-time setup steps, and verifies rollout via workflow_dispatch dry-runs of each workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every workflow documented with trigger, permissions, cadence, and failure behavior
- [ ] #2 One-time setup checklist included and checked off after execution
- [ ] #3 Each workflow successfully dry-run via workflow_dispatch during rollout
- [ ] #4 operations.md passes markdownlint and cspell gates
<!-- AC:END -->
