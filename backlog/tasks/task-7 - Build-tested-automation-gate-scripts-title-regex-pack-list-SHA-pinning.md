---
id: TASK-7
title: 'Build tested automation gate scripts (title regex, pack list, SHA pinning)'
status: Done
assignee: []
created_date: '2026-08-26 02:02'
updated_date: '2026-08-26 20:41'
labels:
  - ci
dependencies: []
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Small Node scripts under scripts/ that workflows invoke: Conventional Commits PR-title validation, npm pack file-list validator, and GitHub Actions SHA-pinning checker. Unit-tested with Vitest so CI tests its own gates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Title script validates Conventional Commits format and exits non-zero on invalid or missing input
- [x] #2 Pack-list validator parses npm pack --dry-run --json and fails on any file outside dist/**, README.md, LICENSE, package.json
- [x] #3 Pinning checker fails when any uses: reference in .github/workflows points to a tag instead of a full commit SHA
- [x] #4 Each script has Vitest tests covering valid, invalid, and edge-case inputs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: scripts/check-pr-title.mjs, check-pack-list.mjs, check-action-pinning.mjs exist with matching unit tests (test/unit/check-pr-title.test.ts, check-pack-list.test.ts, check-action-pinning.test.ts); CI Guard job passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Automation gate scripts built and tested: PR title validation, pack-list validation, action SHA pinning check.
<!-- SECTION:FINAL_SUMMARY:END -->
