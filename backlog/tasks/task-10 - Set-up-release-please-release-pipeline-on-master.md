---
id: TASK-10
title: Set up release-please release pipeline on master
status: Done
assignee: []
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 21:48'
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
- [x] #3 Release PR is labeled autorelease and merges automatically when all required checks pass
- [x] #4 Merging the Release PR creates a v* tag
- [x] #5 Workflow uses least-privilege permissions and SHA-pinned actions
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: .github/workflows/release.yml runs release-please on every push to master; .github/release-please-config.json and .release-please-manifest.json configure node release-type; PR #11 released v0.3.0, PR #16 is the current release 0.3.2 PR and was updated in place rather than duplicated; PR #16 has autoMergeRequest enabled by github-actions bot (squash), so it will merge automatically when required checks pass; merging PR #11 created tag v0.3.0, PR #14 merged created v0.3.1; workflow uses SHA-pinned actions (release-please-action@... with full SHA) and minimal permissions (contents: write, pull-requests: write).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
release-please pipeline on master is active: it maintains a single rolling Release PR, labels it autorelease, auto-merges when green, creates v* tags, and uses SHA-pinned actions with least-privilege permissions. Verified by releases v0.3.0, v0.3.1 and current PR #16.
<!-- SECTION:FINAL_SUMMARY:END -->
