---
id: TASK-64
title: 'sbl dashboard: restart outdated hub + new ''sbl db'' alias'
status: Done
assignee: []
created_date: '2026-08-30 10:47'
updated_date: '2026-08-30 12:00'
labels:
  - cli
  - dashboard
dependencies: []
type: feature
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
hub.json gains a version field written at hub start; /api/hub/status returns it. When sbl dashboard attaches and the running hub's version differs from KIT_VERSION (missing counts as mismatch), the old hub process is stopped (verified, with a clear error if it cannot be stopped) and a fresh hub is started - no more stale dashboards after an update. Additionally 'sbl db' becomes an alias for 'sbl dashboard' (cli.ts case fallthrough + help text).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 hub.json and /api/hub/status carry the hub version
- [x] #2 Version mismatch on attach stops the old hub and starts a fresh one; failure to stop yields a clear error
- [x] #3 Matching version attaches to the running hub unchanged
- [x] #4 sbl db behaves identically to sbl dashboard and appears in the help text
- [x] #5 Unit tests cover the restart decision with faked process ops and the alias dispatch
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) TDD: hub-state version roundtrip test; restart-decision unit test with faked process ops; alias dispatch test. 2) hub.json + /api/hub/status carry KIT_VERSION. 3) dashboard attach: version mismatch -> stop old pid (verified) + start fresh; clear error when stop fails. 4) cli.ts: case 'db' fallthrough + help text. 5) Full suite + tsc.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
hub.json + /api/hub/status carry the hub version; sbl dashboard kills and replaces a hub with mismatching/missing version (5s verified poll, clear error on failure), matching versions attach unchanged; sbl db alias with help text. Verified: unit tests with faked process ops (kill->poll->fresh-start ordering, refuse-to-stop, legacy state), alias dispatch test, hub status test, full npm test green incl. hub integration.
<!-- SECTION:FINAL_SUMMARY:END -->
