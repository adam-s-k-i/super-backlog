---
id: TASK-9
title: >-
  Automate PR and issue hygiene (templates, labels, title check, auto-merge,
  stale)
status: To Do
assignee: []
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 02:03'
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
- [ ] #1 PR template plus bug and feature issue templates exist with required checklists
- [ ] #2 Path-based labels applied automatically; Dependabot PRs also receive the dependencies label
- [ ] #3 Non-conventional PR titles fail as a required check via the title gate script
- [ ] #4 Squash auto-merge enabled only for dependabot[bot] PRs and PRs labeled autorelease; human PRs never auto-merge
- [ ] #5 Stale job marks inactive issues and PRs after 30 days and closes them 14 days later; bugs exempt at 60 plus 30
- [ ] #6 dependabot.yml exists: npm updates weekly and grouped for devDependencies, GitHub Actions updates weekly, commit prefixes conventional (chore(deps))
<!-- AC:END -->
