---
id: TASK-64
title: 'sbl dashboard: restart outdated hub + new ''sbl db'' alias'
status: To Do
assignee: []
created_date: '2026-08-30 10:47'
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
- [ ] #1 hub.json and /api/hub/status carry the hub version
- [ ] #2 Version mismatch on attach stops the old hub and starts a fresh one; failure to stop yields a clear error
- [ ] #3 Matching version attaches to the running hub unchanged
- [ ] #4 sbl db behaves identically to sbl dashboard and appears in the help text
- [ ] #5 Unit tests cover the restart decision with faked process ops and the alias dispatch
<!-- AC:END -->
