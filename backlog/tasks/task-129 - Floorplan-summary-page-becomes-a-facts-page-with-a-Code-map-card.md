---
id: TASK-129
title: 'Floorplan: summary page becomes a facts page with a Code map card'
status: To Do
assignee: []
created_date: '2026-11-28T13:50:52Z'
updated_date: '2026-11-28T14:51:14Z'
labels:
  - feature
  - phase/impl
dependencies:
  - TASK-127
  - TASK-128
references:
  - docs/superpowers/specs/2026-11-28-floorplan-integration-design.md
type: feature
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove the curated architecture layer from the summary page (spec decisions 1 and 2): delete summary-schema, summary-layout, summary-drift and their tests, strip diagram, flows, highlights, legend, side panel and drift notice from summary.html and summary-render.ts, and add the Code map card.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The summary page shows facts, open tasks, commands and tech stack; no code path reads backlog/docs/architecture.yml and the page contains no diagram markup
- [ ] #2 The Code map card renders the three states from spec decision 2 (map with link to ../map/ and commits since, no map with install commands and repo link, unreadable map) with all values escaped
- [ ] #3 src/dashboard/summary-schema.ts, summary-layout.ts and summary-drift.ts and their unit tests are deleted; summary-facts.ts and yamlmini.ts stay; build, tsc and the full test suite are green
- [ ] #4 The Data source section names manifests, git, the backlog and, when present, floorplan/graph.json
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan section 'Task 5 (TASK-129)' in docs/superpowers/plans/2026-11-28-floorplan-integration.md: rewrite unit and integration tests, rewrite summary-render.ts, strip diagram markup/CSS/client code from summary.html, delete summary-schema/layout/drift with tests and fixtures, snapshot, browser check in three states, commit. Runs after TASK-130.
<!-- SECTION:PLAN:END -->
