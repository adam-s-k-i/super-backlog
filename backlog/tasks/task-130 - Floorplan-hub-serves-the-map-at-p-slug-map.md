---
id: TASK-130
title: 'Floorplan: hub serves the map at /p/<slug>/map/'
status: To Do
assignee: []
created_date: '2026-11-28T13:50:56Z'
updated_date: '2026-11-28T14:45:18Z'
labels:
  - feature
  - phase/plan
dependencies:
  - TASK-127
references:
  - docs/superpowers/specs/2026-11-28-floorplan-integration-design.md
type: feature
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the two map routes to src/dashboard/hub.ts (spec decision 4). The hub serves exactly floorplan/index.html of the registered project and never starts or contacts the Floorplan server.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /p/<slug>/map redirects with 302 to /p/<slug>/map/; GET /p/<slug>/map/ and /p/<slug>/map/index.html return the file with content-type text/html, cache-control no-store and the Content-Security-Policy header from the spec
- [ ] #2 Without a map the answer is 404 with the hint text from the spec
- [ ] #3 No other path under floorplan/ is reachable through the hub; no request input becomes part of a file path
- [ ] #4 Verified in a browser: the map of this repo renders under the hub URL without console errors and without requests other than the page itself
- [ ] #5 When floorplan/graph.json changed since the hub last checked, the project pages are regenerated before /p/<slug>/summary/ is served (once per change); a failing regeneration still serves the last good page
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan section 'Task 4 (TASK-130)' in docs/superpowers/plans/2026-11-28-floorplan-integration.md: failing hub tests, /map routes with fixed path and CSP header, refreshIfMapChanged before /summary/, browser check, commit. Runs after TASK-131.
<!-- SECTION:PLAN:END -->
