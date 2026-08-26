---
id: TASK-20
title: Fix release.yml Publish job skipped when release-please creates a release
status: Done
assignee: []
created_date: '2026-08-26 22:21'
updated_date: '2026-08-27 00:35'
labels:
  - ci
  - release
dependencies: []
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Release run 33018325949 (v0.3.2) created the GitHub release and tag, but Publish failed because `secrets: inherit` was missing on the reusable `publish.yml` call, leaving `NPM_TOKEN` empty. After adding `secrets: inherit` in commit 156ba63 and a checkout step in commit bc60720, v0.3.3 was published automatically at 2026-08-26T22:26:10Z. Subsequent release runs correctly skip Publish when no new release is created and trigger it when a release exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Release workflow Publish job runs automatically when release-please creates a new GitHub release
- [x] #2 v0.3.3+ publishes to npm automatically without requiring a manual workflow_dispatch
- [x] #3 npm test and lint pass after the change
<!-- AC:END -->

## Resolution
- Commit `156ba63`: `fix(ci): pass repository secrets to publish reusable workflow`
- Commit `bc60720`: `fix(ci): checkout repo before reading package.json in release verification step`
- Release: https://github.com/adam-s-k-i/super-backlog/releases/tag/v0.3.3

