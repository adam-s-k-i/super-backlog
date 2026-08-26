---
id: TASK-9
title: >-
  Automate PR and issue hygiene (templates, labels, title check, auto-merge,
  stale)
status: Done
assignee: []
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 21:47'
labels:
  - ci
dependencies:
  - TASK-7
priority: high
type: chore
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One hygiene layer for pull requests and issues: PR/issue templates, path-based auto-labeling, Conventional Commits title required check using the gate script, squash auto-merge restricted to bot and autorelease PRs, and a daily stale job.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PR template plus bug and feature issue templates exist with required checklists
- [x] #2 Path-based labels applied automatically; Dependabot PRs also receive the dependencies label
- [x] #3 Non-conventional PR titles fail as a required check via the title gate script
- [x] #4 Squash auto-merge enabled only for dependabot[bot] PRs and PRs labeled autorelease; human PRs never auto-merge
- [x] #5 Stale job marks inactive issues and PRs after 30 days and closes them 14 days later; bugs exempt at 60 plus 30
- [x] #6 dependabot.yml exists: npm updates weekly and grouped for devDependencies, GitHub Actions updates weekly, commit prefixes conventional (chore(deps))
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: .github/ISSUE_TEMPLATE/bug.yml, feature.yml, config.yml exist; PULL_REQUEST_TEMPLATE exists; .github/labeler.yml and actions/labeler job apply path-based labels; pr-hygiene Title-check job enforces Conventional Commits via scripts/check-pr-title.mjs; Auto-merge job in pr-hygiene.yml enables squash auto-merge for dependabot[bot] and autorelease PRs (verified on PR #12 dependabot and PR #16 release 0.3.2); stale.yml marks inactive issues/PRs at 30d and closes at 14d, bugs 60d/30d; .github/dependabot.yml configures npm weekly and GitHub Actions weekly with conventional commit prefixes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PR and issue hygiene automation in place: templates, auto-labeling, Conventional Commits title check, squash auto-merge for bots/autorelease PRs, stale bot, and Dependabot config. Verified by auto-merge enabled on PR #12 and PR #16.
<!-- SECTION:FINAL_SUMMARY:END -->
