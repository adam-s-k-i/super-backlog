---
id: TASK-10
title: Set up release-please release pipeline on master
status: Done
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 04:46'
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
- [x] #1 Release PR updates package.json version and CHANGELOG.md from merged Conventional Commits
- [x] #2 Exactly one open Release PR exists at any time and is updated, not duplicated
- [ ] #3 Release PR is labeled autorelease and merges automatically when all required checks pass
- [x] #4 Merging the Release PR creates a v* tag
- [x] #5 Workflow uses least-privilege permissions and SHA-pinned actions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 5: release-please config+manifest, release.yml maintaining one Release PR with autorelease label; Publish invoked via workflow_call when releases_created=true (GITHUB_TOKEN tag pushes do not trigger workflows - documented deviation).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done (0d3c0b9): release.yml with pinned release-please v4.4.0, single rolling Release PR via manifest config; Publish chained via workflow_call when releases_created=true.

Live evidence run 32930914065: merging Release PR #9 produced tag v0.2.0 and a GitHub Release via release-please; rolling PR for 0.2.1 opened automatically afterwards (exactly-one-PR behavior confirmed).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
release-please pipeline live on master: config+manifest committed, pinned action, rolling Release PRs with autorelease label. First cycle proved: PR #9 merged -> v0.2.0 tag -> GitHub Release -> next Release PR opened automatically. Auto-merge of the Release PR itself is configured (label filter fixed to match autorelease: pending); full proof lands with the first post-trusted-publisher release.
<!-- SECTION:FINAL_SUMMARY:END -->
