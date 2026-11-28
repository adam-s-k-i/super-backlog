---
id: TASK-132
title: 'Floorplan: docs and dogfood'
status: To Do
assignee: []
created_date: '2026-11-28T13:51:02Z'
updated_date: '2026-11-28T14:45:21Z'
labels:
  - docs
  - phase/plan
dependencies:
  - TASK-129
  - TASK-130
  - TASK-131
references:
  - docs/superpowers/specs/2026-11-28-floorplan-integration-design.md
type: docs
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply spec decision 8: rewrite the project summary guide, update README, quickstart and harness support, retake the screenshot, delete the repo architecture.yml and refresh the managed files of this repo.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/guide/project-summary.md describes the facts page, the Code map card, how to get and update a map, what needs the Floorplan server and how projects with architecture.yml migrate
- [ ] #2 README.md, quickstart.md and harness-support.md no longer describe the curated architecture file; harness support states that the code map needs Claude Code or Codex
- [ ] #3 backlog/docs/architecture.yml of this repo is deleted and AGENTS.md, CLAUDE.md and .claude/skills are refreshed with node dist/bin.js update --no-self
- [ ] #4 npm run lint, test/docs.test.ts and npx vitepress build docs are green; docs/assets/project-summary.png shows the new page
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan section 'Task 6 (TASK-132)' in docs/superpowers/plans/2026-11-28-floorplan-integration.md: README, quickstart, harness support, rewrite of the project summary guide, delete backlog/docs/architecture.yml, sbl update --no-self, update the floorplan, retake the screenshot, lint/docs test/vitepress, commit. Runs last.
<!-- SECTION:PLAN:END -->
