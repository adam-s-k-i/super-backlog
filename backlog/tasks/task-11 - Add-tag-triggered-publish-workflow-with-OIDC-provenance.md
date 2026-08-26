---
id: TASK-11
title: Add tag-triggered publish workflow with OIDC provenance
status: In Progress
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 04:08'
labels:
  - ci
  - security
dependencies:
  - TASK-10
  - TASK-7
priority: high
type: chore
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
publish.yml runs on v* tags: clean build, full tests, pack-list validation via the gate script, npm publish --provenance through OIDC trusted publishing, then GitHub Release from the matching CHANGELOG section. Rewrites docs/publishing.md around the automated flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tag push triggers build, full test run, pack-list validation, then npm publish --provenance with id-token write and no NPM_TOKEN secret
- [ ] #2 Publish aborts when the tag does not match package.json version or CHANGELOG lacks an entry for it
- [ ] #3 GitHub Release body contains the matching CHANGELOG section
- [ ] #4 docs/publishing.md describes the automated flow plus an emergency manual fallback
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 5: publish.yml reusable workflow - verify tag/version/changelog, pack-list gate, npm publish --provenance (npm@latest for trusted publishing), gh release from CHANGELOG section; publishing.md rewritten.
<!-- SECTION:PLAN:END -->
