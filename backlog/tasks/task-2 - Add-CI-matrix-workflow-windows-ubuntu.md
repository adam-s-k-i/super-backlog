---
id: TASK-2
title: Add CI matrix workflow (windows + ubuntu)
status: To Do
assignee: []
created_date: '2026-08-25 23:27'
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
- [ ] #1 workflow file .github/workflows/ci.yml runs npm ci, build, and tests on windows-latest and ubuntu-latest
- [ ] #2 workflow passes on this repo
- [ ] #3 README shows the status badge
<!-- AC:END -->
