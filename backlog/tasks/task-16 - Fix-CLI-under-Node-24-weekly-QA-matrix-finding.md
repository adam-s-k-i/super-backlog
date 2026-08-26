---
id: TASK-16
title: Fix CLI under Node 24 (weekly QA matrix finding)
status: Done
assignee: []
created_date: '2026-08-26 04:36'
updated_date: '2026-08-26 20:55'
labels:
  - ci
  - qa
dependencies: []
references:
  - 'https://github.com/adam-s-k-i/super-backlog/actions/runs/32930705248'
type: bug
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Weekly QA run 32930705248 (windows-latest, Node 24) fails during npm test with the kit error message: package.json is not valid JSON - fix it manually, then re-run. Something in the init/e2e path parses JSON differently under Node 24. Re-enable Node 24 in qa-weekly.yml matrix once fixed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 npm test passes on Node 24 locally or via CI matrix leg
- [x] #2 qa-weekly.yml matrix includes Node 24 again
- [x] #3 Root cause documented in task notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: Node 24 on Windows triggers a libuv assertion in fs.watch(..., { recursive: true }) when watching overlapping paths. The crash appeared as a Vitest worker exit and the 'package.json is not valid JSON' messages were just expected stderr from negative tests. Fix: src/dashboard/server.ts now checks recursiveWatchSupported(platform, nodeVersion) and skips recursive watching on win32 Node >= 24, logging a warning instead. Watcher tests in test/integration/serve.test.ts are skipped on that platform. Verification: Weekly QA run 33012558138 passed Tests on windows-latest Node 24 and ubuntu-latest Node 24; local npm test 227/227 passed; lint clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed Node 24 Windows crash: recursive directory watch disabled with a platform/version guard, watcher tests skipped on affected platform, Node 24 re-enabled in qa-weekly.yml. Verified by green Weekly QA run on windows-latest + Node 24.
<!-- SECTION:FINAL_SUMMARY:END -->
