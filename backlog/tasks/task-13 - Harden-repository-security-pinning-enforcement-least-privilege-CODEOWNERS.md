---
id: TASK-13
title: 'Harden repository security (pinning enforcement, least privilege, CODEOWNERS)'
status: Done
assignee: []
created_date: '2026-08-26 02:03'
updated_date: '2026-08-27 13:46'
labels:
  - ci
  - security
dependencies:
  - TASK-12
priority: medium
type: chore
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cross-cutting security pass over all workflows: least-privilege permissions everywhere, SHA pinning enforced in CI by the checker script, CODEOWNERS ownership, and capture of the manual setup checklist (npm trusted publisher, branch protection, secret scanning).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All workflows declare minimal top-level permissions with per-job elevation only where needed
- [x] #2 Pinning checker runs as a required CI check on workflow changes and passes
- [x] #3 CODEOWNERS assigns all paths to the maintainer
- [x] #4 Setup checklist covers npm trusted publisher registration, master branch protection, secret scanning and push protection, and Pages source
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Already implemented, task was never closed. Evidence: all 8 workflows (ci, pr-hygiene, release, publish, pages-deploy, qa-weekly, qa-monthly, stale) declare top-level permissions:{} with per-job elevation; branch protection API reports required checks Lint/Guard/Tests and Guard (scripts/check-action-pinning.mjs) is green on all recent PR runs (#25, #27); .github/CODEOWNERS assigns * @adam-s-k-i; docs/guide/operations.md One-time setup checklist covers npm trusted publisher (still open, tracked in TASK-19), branch protection, secret scanning + push protection, and Pages source.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Security posture verified end-to-end: least-privilege permissions everywhere, SHA pinning enforced as required Guard check, CODEOWNERS in place, operations setup checklist documented. Closing without code changes.
<!-- SECTION:FINAL_SUMMARY:END -->
