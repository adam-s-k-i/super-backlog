---
id: TASK-9
title: >-
  Automate PR and issue hygiene (templates, labels, title check, auto-merge,
  stale)
status: Done
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 04:14'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 4: templates, labeler config, dependabot.yml, pr-hygiene.yml (title check via gate script, labels, bot auto-merge), stale.yml with bug exemption sweep.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done (6229da9): templates, labeler v5 config, dependabot.yml (npm grouped + actions weekly), pr-hygiene.yml (title check/labels/auto-merge), stale.yml 30/14 + bug 60/30 sweep. Pinning guard green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hygiene layer committed: PR template + bug/feature issue forms, path-based labeler v5 config, required Conventional-Commits title check calling the tested gate script, squash auto-merge restricted to dependabot[bot]/autorelease, stale 30/14 with bug exemption sweep 60/30, dependabot.yml (npm grouped weekly + actions weekly). Dependabot already opened its first update PR (vitest), proving the config is live.
<!-- SECTION:FINAL_SUMMARY:END -->
