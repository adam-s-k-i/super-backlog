---
id: TASK-20
title: Fix release.yml Publish job skipped when release-please creates a release
status: In Progress
assignee: []
created_date: '2026-08-26 22:21'
updated_date: '2026-08-26 22:31'
labels:
  - ci
  - release
dependencies: []
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Release run 33018522543 skipped Publish because the release-please-action output was empty after the SHA bump in PR #7. Run 33019663780 then triggered Publish via a gh release view check, but it failed because secrets: inherit was missing on the reusable publish.yml call, leaving NPM_TOKEN empty. The fix adds secrets: inherit so v0.3.4+ publishes automatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Release workflow Publish job runs automatically when release-please creates a new GitHub release
- [ ] #2 v0.3.4+ publishes to npm automatically without requiring a manual workflow_dispatch
- [ ] #3 npm test and lint pass after the change
<!-- AC:END -->
