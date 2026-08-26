---
id: TASK-18
title: >-
  Fix release pipeline: package.json repository field + duplicate GitHub Release
  step
status: In Progress
assignee:
  - '@adamh'
created_date: '2026-08-26 18:57'
updated_date: '2026-08-26 19:18'
labels:
  - ci
  - release
dependencies: []
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First real npm publish (v0.3.0, Release run 33001585330) failed with 404 PUT. Root-cause chain: (1) package never existed on npm so no trusted publisher could be configured (user bootstraps manually), (2) package.json lacks a repository field which npm trusted publishing requires to match the GitHub repo exactly, (3) publish.yml contains a Create GitHub Release step that collides with the release that release-please already creates (v0.3.0 release exists, created 18:47:03Z by the Release-please job). This task covers the two repo-side fixes so the OIDC pipeline works end-to-end for v0.3.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 package.json contains a repository field whose url exactly matches https://github.com/adam-s-k-i/super-backlog
- [ ] #2 publish.yml handles GitHub Release idempotently (gh release view || create, per c7c1d31) so it cannot collide with the release-please-created release; the publish job stays green on the next release run
- [ ] #3 npm test passes and a test guards the repository field
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. RED: test/unit/repository-field.test.ts asserts root package.json repository.url === https://github.com/adam-s-k-i/super-backlog. 2. GREEN: add repository field to package.json. 3. Remove 'Create GitHub Release from CHANGELOG' step from publish.yml (release-please owns tag+release; extract-changelog.mjs stays, still unit-tested). 4. npm test full suite green. 5. PR; after merge release-please opens v0.3.1 PR as end-to-end test once npm bootstrap + trusted publisher (workflow: release.yml) are configured by user.
<!-- SECTION:PLAN:END -->
