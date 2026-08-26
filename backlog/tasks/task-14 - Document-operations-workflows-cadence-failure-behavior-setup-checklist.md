---
id: TASK-14
title: 'Document operations: workflows, cadence, failure behavior, setup checklist'
status: In Progress
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 04:12'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 8: write docs/guide/operations.md (workflow table, release chain, one-time setup checklist incl. npm trusted publisher + Pages source + branch protection), then post-push rollout: labels, Pages enablement, workflow_dispatch dry-runs with recorded run URLs.
<!-- SECTION:PLAN:END -->
