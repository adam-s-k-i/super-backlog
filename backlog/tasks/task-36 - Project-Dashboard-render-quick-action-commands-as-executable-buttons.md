---
id: TASK-36
title: 'Project Dashboard: render quick-action commands as executable buttons'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 19:12'
updated_date: '2026-08-27 20:30'
labels:
  - ux
dependencies: []
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the static command chips in the dashboard Quick Actions section with clickable buttons. In sbl dashboard --serve mode, the local server exposes a safe /api/run endpoint that runs whitelisted commands (backlog browser, backlog board). In static dashboard.html mode, buttons fall back to copying the command to the clipboard.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In serve mode, clicking 'backlog browser' opens the Backlog browser
- [x] #2 In serve mode, clicking 'backlog board' shows the Backlog board
- [x] #3 In static mode, buttons copy the command text to the clipboard
- [x] #4 Only whitelisted commands can be executed via /api/run
- [x] #5 Existing tests pass and new unit tests cover the run handler
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read src/dashboard/server.ts to understand current serve endpoint structure.\n2. Add /api/run POST endpoint that validates a command key against a whitelist and spawns backlog browser or backlog board via resolved binary.\n3. Update src/templates/dashboard.html to render buttons instead of code chips and wire click handlers.\n4. Add fallback copy-to-clipboard behavior for static dashboard.html.\n5. Add unit tests for the /api/run handler.\n6. Run npm test and manual serve-mode check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: added /api/run POST endpoint in src/dashboard/server.ts with a whitelist of browser/board commands. Updated src/templates/dashboard.html to render buttons and wire click handlers. Added unit tests in test/unit/run-api.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented executable quick-action buttons. In serve mode, /api/run spawns backlog browser/board; in static mode, buttons fall back to clipboard. Verified with npm test (324 passed), manual /api/run POST returning {ok:true}, and generated dashboard.html containing cmd-btn elements.
<!-- SECTION:FINAL_SUMMARY:END -->
