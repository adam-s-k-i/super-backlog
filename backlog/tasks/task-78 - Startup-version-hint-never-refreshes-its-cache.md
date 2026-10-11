---
id: TASK-78
title: Startup version hint never refreshes its cache
status: Done
assignee: []
created_date: '2026-10-09 16:41'
updated_date: '2026-10-11 10:56'
labels:
  - bug
  - cli
dependencies:
  - TASK-77
priority: medium
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The startup hint (applyVersionHint -> defaultFetchLatest, background mode) is fire-and-forget: the npm child, its stdout and the timer are unref'd, so for short commands (sbl update, sbl phase ...) the process exits before 'npm view super-backlog version' answers and writeCache never runs. Evidence: ~/.super-backlog/version-check.json still held {checkedAt 2026-08-30, latest 1.3.2} on 2026-10-09 while 1.5.0 was published, so users never see the 'is available' hint. Note: sbl --version returns before the hint runs. Builds on the unmerged TASK-77 branch (fix/update-silent-exit); foreground mode used by sbl update's self-check must stay unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A regression e2e test with a fake npm on PATH shows the stale cache is refreshed after a short sbl command exits; it fails on the old code
- [x] #2 Startup stays non-blocking: the command exits without waiting for npm
- [x] #3 Foreground fetchLatestVersion (sbl update self-check, TASK-77) is unchanged and its tests still pass
- [x] #4 No extra npm spawn when the cache is fresh or SBL_SKIP_UPDATE_CHECK is set
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Root cause (confirmed): identical hint code refreshes the cache only when the process outlives npm (control run: exit at 86ms -> npm never ran; kept alive 3s -> cache written). On Windows libuv kills non-detached children with the parent (job object); on POSIX the parent that would writeCache is gone.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Root cause: the startup hint fetched in-process with every handle unref'd; short commands exit before npm answers (on Windows libuv even kills the non-detached npm child with its parent), so writeCache never ran. Control run with identical code: exit at 86ms -> npm never ran, no cache; kept alive 3s -> cache written. Fix: applyVersionHint now calls deps.refresh(); the CLI wires it to spawnVersionRefresh(), which starts dist/version-refresh.js detached (stdio ignore, windowsHide, unref'd). The worker runs refreshVersionCache = foreground fetchLatestVersion (10s timeout, windowsHide for npm.cmd) + writeCache. The now-unused background option and defaultFetchLatest were removed; the foreground path used by sbl update (TASK-77) is unchanged. Evidence: new e2e test (fake npm, 1.5s delay) failed on the old code and passes now: CLI exits with the cache still stale, the cache is refreshed afterwards and the next run prints the hint; fresh cache and SBL_SKIP_UPDATE_CHECK spawn no npm. Full suite 563 passed / 4 skipped. Real registry: built sbl phase exits in 186ms, stale 1.3.2 cache becomes 1.5.0 about 2s later. Not covered by automation: absence of a console-window flash on Windows (windowsHide set on both spawns).

2026-10-11: rescued from the unmerged branch claude/stoic-mahavira-c79969 by cherry-picking onto master (v1.10.1); only conflict was the e2e test imports (master moved cleanup to async rm with retries). Full suite on master base: 80 files, 1112 passed / 5 skipped; lint clean.
<!-- SECTION:FINAL_SUMMARY:END -->
