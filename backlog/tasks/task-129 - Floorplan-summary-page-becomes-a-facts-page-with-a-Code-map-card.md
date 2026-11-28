---
id: TASK-129
title: 'Floorplan: summary page becomes a facts page with a Code map card'
status: Done
assignee: []
created_date: '2026-11-28T13:50:52Z'
updated_date: '2026-11-28T15:49:32Z'
labels:
  - feature
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
- [x] #1 The summary page shows facts, open tasks, commands and tech stack; no code path reads backlog/docs/architecture.yml and the page contains no diagram markup
- [x] #2 The Code map card renders the three states from spec decision 2 (map with link to ../map/ and commits since, no map with install commands and repo link, unreadable map) with all values escaped
- [x] #3 src/dashboard/summary-schema.ts, summary-layout.ts and summary-drift.ts and their unit tests are deleted; summary-facts.ts and yamlmini.ts stay; build, tsc and the full test suite are green
- [x] #4 The Data source section names manifests, git, the backlog and, when present, floorplan/graph.json
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan section 'Task 5 (TASK-129)' in docs/superpowers/plans/2026-11-28-floorplan-integration.md: rewrite unit and integration tests, rewrite summary-render.ts, strip diagram markup/CSS/client code from summary.html, delete summary-schema/layout/drift with tests and fixtures, snapshot, browser check in three states, commit. Runs after TASK-130.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser check (hub preview, /p/super-backlog/summary/, 2026-11-28): map state shows 'Floorplan map, built 2026-11-28, 165 files, 11 parts, 7 commits since.' with Open map -> /p/super-backlog/map/ (200); no diagram, no Highlights, Data source has two columns; console clean. Missing state (graph.json renamed): explanation, Floorplan link, both install commands, copy button shows toast 'Copied'. Invalid state (graph.json = '{'): one neutral line 'Floorplan map unreadable (not valid JSON). Ask your agent to update the floorplan.', no links, neutral colors. Light and dark theme render the card; at 375 px the text wraps to two lines, Open map stays on one line, profile row is one column, no horizontal scroll. Map file restored byte-identical.

Verified on HEAD 330a1b7: npm test 76 files, 943 passed, 4 skipped; npx tsc --noEmit rc=0; npm run lint 0 issues; npx vitepress build docs ok. Commit 0aea0d1. Served summary page shows facts, open tasks, commands, tech stack and the Code map card ('Floorplan map, built 2026-11-28, 160 files, 10 parts. Open map'), no diagram markup; Data source section names floorplan/graph.json; summary-schema/layout/drift and their tests are deleted.
<!-- SECTION:NOTES:END -->
