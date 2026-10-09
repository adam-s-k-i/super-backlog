---
id: TASK-77
title: sbl update exits silently during the self-update check
status: In Progress
assignee: []
created_date: '2026-10-09 14:50'
updated_date: '2026-10-09 14:59'
labels:
  - bug
  - cli
  - phase/verify
dependencies: []
priority: high
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since 1.3.2, sbl update awaits fetchLatestVersion(). That function unrefs the npm child, its stdout and the timeout timer (designed for the fire-and-forget startup hint), so nothing keeps the event loop alive: Node exits with code 0 mid-await, printing nothing and refreshing nothing. Reproduced on 1.5.0 in a clean clone; --no-self works. Plan: add a background option to fetchLatestVersion; only the startup hint unrefs; self-update uses foreground mode. Regression test spawns a real child node process that awaits the foreground fetch and asserts it resolves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sbl update without --no-self runs the full refresh and prints its summary when no newer version exists
- [x] #2 fetchLatestVersion in foreground mode keeps the process alive until npm answers or the timeout fires
- [x] #3 the startup version hint stays non-blocking (background mode still unrefs)
- [x] #4 a regression test fails on the old code and passes on the fix
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Root cause: fetchLatestVersion unref'd the npm child, its stdout and the timer, so the awaited self-update check left nothing holding the event loop and Node exited 0 mid-await. Fix (89a6746): background option; only the startup hint unrefs; foreground timeout kills and releases the child. Evidence: new e2e tests (fake npm on PATH) failed before the fix with empty output and pass now; full suite 557 passed / 4 skipped; fixed build of sbl update without --no-self refreshes a 1.3.1 clone to 1.5.0 against the real registry.
<!-- SECTION:FINAL_SUMMARY:END -->
