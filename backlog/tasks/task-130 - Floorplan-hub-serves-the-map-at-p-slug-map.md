---
id: TASK-130
title: 'Floorplan: hub serves the map at /p/<slug>/map/'
status: In Progress
assignee: []
created_date: '2026-11-28T13:50:56Z'
updated_date: '2026-11-28T15:19:11Z'
labels:
  - feature
  - phase/verify
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
- [x] #1 /p/<slug>/map redirects with 302 to /p/<slug>/map/; GET /p/<slug>/map/ and /p/<slug>/map/index.html return the file with content-type text/html, cache-control no-store and the Content-Security-Policy header from the spec
- [x] #2 Without a map the answer is 404 with the hint text from the spec
- [x] #3 No other path under floorplan/ is reachable through the hub; no request input becomes part of a file path
- [x] #4 Verified in a browser: the map of this repo renders under the hub URL without console errors and without requests other than the page itself
- [x] #5 When floorplan/graph.json changed since the hub last checked, the project pages are regenerated before /p/<slug>/summary/ is served (once per change); a failing regeneration still serves the last good page
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan section 'Task 4 (TASK-130)' in docs/superpowers/plans/2026-11-28-floorplan-integration.md: failing hub tests, /map routes with fixed path and CSP header, refreshIfMapChanged before /summary/, browser check, commit. Runs after TASK-131.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser check (2026-11-28, hub on port 6428, /p/super-backlog/map/): (1) the board renders (11 parts) and a click on 'Dashboard hub' focuses the part and opens its popover; (2) console: no errors; (3) network: only GET /p/super-backlog/map/ -> 200, no request to /api/ or another host. Response carries content-security-policy: connect-src 'none'; form-action 'none'; base-uri 'none' and cache-control: no-store. graph.json, serve.mjs and ../ paths below /map/ answer 404; /map redirects 302 to /map/. The page shows its own 'Asking is unavailable' banner, since serve.mjs is not running (expected).

Verified on HEAD 330a1b7: npm test 76 files, 943 passed, 4 skipped; npx tsc --noEmit rc=0; npm run lint 0 issues; npx vitepress build docs ok. Commit 09155b2. Browser check at http://localhost:6428/p/super-backlog/map/: title 'super-backlog map', map renders with Recent work, Flows and Health; performance resource entries of the page are empty (no request other than the page itself), navigation status 200, no console errors raised by the map page. Route tests cover the 302, headers, CSP, 404 hint, path isolation and regeneration.
<!-- SECTION:NOTES:END -->
