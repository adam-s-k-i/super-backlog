---
id: TASK-7
title: 'Build tested automation gate scripts (title regex, pack list, SHA pinning)'
status: To Do
assignee: []
created_date: '2026-08-26 02:02'
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
- [ ] #1 Title script validates Conventional Commits format and exits non-zero on invalid or missing input
- [ ] #2 Pack-list validator parses npm pack --dry-run --json and fails on any file outside dist/**, README.md, LICENSE, package.json
- [ ] #3 Pinning checker fails when any uses: reference in .github/workflows points to a tag instead of a full commit SHA
- [ ] #4 Each script has Vitest tests covering valid, invalid, and edge-case inputs
<!-- AC:END -->
