---
id: TASK-6
title: Add styleguide gate to CI (markdownlint-cli2 + cspell)
status: Done
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:02'
updated_date: '2026-08-26 20:41'
labels:
  - ci
dependencies: []
type: chore
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enforce the documentation styleguide automatically: markdown structure via markdownlint-cli2 and spelling via cspell over all tracked Markdown files, so every push and PR keeps docs compliant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 .markdownlint-cli2.jsonc and cspell.json exist and cover all tracked Markdown files
- [x] #2 CI fails on markdown lint violations or unknown words outside the project dictionary
- [x] #3 All current repository docs pass both gates without per-file exclusions beyond the documented config
- [x] #4 README explains how to run both checks locally
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per docs/superpowers/plans/2026-08-26-github-automation.md Task 1: install markdownlint-cli2/cspell/vitepress, add configs, npm run lint, fix violations, add Lint job to ci.yml, README dev section.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: cspell.json and .markdownlint-cli2.jsonc exist; npm run lint passed clean (0 issues); README dev section documents npm run lint.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Styleguide gate implemented: cspell + markdownlint-cli2 configs, Lint job in CI, README instructions, lint clean.
<!-- SECTION:FINAL_SUMMARY:END -->
