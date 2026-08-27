---
id: TASK-14
title: 'Document operations: workflows, cadence, failure behavior, setup checklist'
status: Done
assignee: []
created_date: '2026-08-26 02:03'
updated_date: '2026-08-27 13:50'
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
- [x] #1 Every workflow documented with trigger, permissions, cadence, and failure behavior
- [x] #2 One-time setup checklist included and checked off after execution
- [x] #3 Each workflow successfully dry-run via workflow_dispatch during rollout
- [x] #4 operations.md passes markdownlint and cspell gates
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Mostly already implemented; one gap closed: Docs-Gate job was missing from the workflows table - added via PR #29 (all checks green incl. Lint). Evidence: docs/guide/operations.md documents all 9 workflows with trigger/permissions/cadence/failure behavior; one-time setup checklist present with executed items checked (trusted publisher intentionally open, TASK-19); rollout dry-runs confirmed via workflow_dispatch run history (Weekly QA 33012558138, Monthly 32930706992, Release 33076261354); Lint gate green on PR #29 (markdownlint + cspell).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Operations guide complete: every workflow documented with trigger, permissions, cadence and failure behavior (Docs-Gate row added in PR #29), setup checklist recorded, rollout dry-runs evidenced, lint gates green. Closing.
<!-- SECTION:FINAL_SUMMARY:END -->
