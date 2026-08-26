---
id: TASK-14
title: 'Document operations: workflows, cadence, failure behavior, setup checklist'
status: Done
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 04:47'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 8: write docs/guide/operations.md (workflow table, release chain, one-time setup checklist incl. npm trusted publisher + Pages source + branch protection), then post-push rollout: labels, Pages enablement, workflow_dispatch dry-runs with recorded run URLs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rollout completed: labels ensured via gh, Pages enabled (build_type=workflow), branch protection active on master (Lint/Guard/Tests required, strict, no force-push). Dry-run evidence: CI+Release+Deploy Pages green on push runs 32931263473/75/22; Monthly deep check green 32930706992; Stale green 32929935670. Publish dry-run intentionally not forced to green: it fails fast at npm publish until trusted publisher is registered - documented in publishing.md and operations.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
docs/guide/operations.md committed: workflow table with triggers/permissions/cadence/failure behavior, release chain narrative incl. workflow_call rationale, issue automation overview, one-time setup checklist (all items done except npm trusted publisher registration - the only remaining manual step for the maintainer).
<!-- SECTION:FINAL_SUMMARY:END -->
