---
id: TASK-2
title: Add CI matrix workflow (windows + ubuntu)
status: Done
assignee: []
created_date: '2026-08-25 23:27'
updated_date: '2026-08-26 00:08'
labels:
  - ci
dependencies: []
type: chore
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub Actions workflow that runs build and full test suite on windows-latest and ubuntu-latest with Node 20, so Windows-specific regressions (spawns, paths, hooks) are caught before release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 workflow file .github/workflows/ci.yml runs npm ci, build, and tests on windows-latest and ubuntu-latest
- [x] #2 workflow passes on this repo
- [x] #3 README shows the status badge
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ci.yml created (matrix windows/ubuntu, node 20, npm ci + test via pretest build). Badge added to README. Workflow execution itself is only verifiable after push to GitHub - noted as post-push verification.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @adam-s-k-i
created: 2026-08-25 23:36
---
AC2 (green workflow run) stays open until first push to GitHub; task returns to In Progress.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CI matrix live and green: run 32913742213 succeeded on windows-latest and ubuntu-latest (verified via gh run view after push). Badge URL active.
<!-- SECTION:FINAL_SUMMARY:END -->
