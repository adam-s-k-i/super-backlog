---
id: TASK-10
title: Set up release-please release pipeline on master
status: To Do
assignee: []
created_date: '2026-08-26 02:03'
labels:
  - ci
dependencies:
  - TASK-9
priority: high
type: chore
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
release.yml maintains exactly one rolling Release PR (version bump plus Keep-a-Changelog CHANGELOG entry) from Conventional Commits; it merges itself once green, producing the v* tag that triggers publishing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Release PR updates package.json version and CHANGELOG.md from merged Conventional Commits
- [ ] #2 Exactly one open Release PR exists at any time and is updated, not duplicated
- [ ] #3 Release PR is labeled autorelease and merges automatically when all required checks pass
- [ ] #4 Merging the Release PR creates a v* tag
- [ ] #5 Workflow uses least-privilege permissions and SHA-pinned actions
<!-- AC:END -->
