---
id: TASK-27
title: Add check-docs-required gate script with unit tests
status: Done
assignee: []
created_date: '2026-08-27 12:00'
updated_date: '2026-08-27 13:09'
labels:
  - feature
dependencies: []
references:
  - docs/superpowers/specs/2026-08-27-docs-freshness-gate-design.md
type: feature
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New script scripts/check-docs-required.mjs following the verify-release.mjs pattern: exported pure core function checkDocsRequired plus CLI wrapper. Enforces the docs freshness gate from the spec so feature PRs cannot ship without docs updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pure exported checkDocsRequired function reports a violation when a feat: PR changes src/ without any docs/**/*.md change
- [x] #2 Label no-docs on the PR exempts the docs-change requirement
- [x] #3 Only feat: titles trigger the gate (fix:, chore:, docs:, refactor:, perf: are exempt); scope and breaking-change variants like feat(scope)!: are detected
- [x] #4 Added docs pages (git status A) require frontmatter type of tutorial, how-to, reference or explanation; docs/superpowers/** is exempt
- [x] #5 Added docs pages must be linked in docs/.vitepress/config.mts sidebar
- [x] #6 vitest unit tests cover all cases listed in the spec Testing section
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: 18 new unit tests in test/unit/check-docs-required.test.ts green locally (305/305 on merged master) and in CI (PR #25, ubuntu+windows matrix). TDD: RED module-not-found, then GREEN.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added scripts/check-docs-required.mjs (pure core checkDocsRequired + CLI wrapper, verify-release.mjs pattern) with 18 vitest cases covering trigger rules, no-docs exemption, type frontmatter and sidebar-link requirements, docs/superpowers exemption and multi-violation reporting. Merged via PR #25 (squash 94431b7); full suite 305/305 green on master.
<!-- SECTION:FINAL_SUMMARY:END -->
