---
id: TASK-105
title: 'Flaky e2e: background fetchLatestVersion test under full-suite load'
status: Done
assignee: []
created_date: '2026-10-10 17:27'
updated_date: '2026-10-10 18:42'
labels:
  - bug
dependencies: []
references:
  - test/e2e/version-check.e2e.test.ts
  - src/lib/version-check.ts
type: bug
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
test/e2e/version-check.e2e.test.ts > 'background mode never holds the process open for a slow npm' failed in 2 of 4 full npm test runs on 2026-10-10 but passes when run alone. Reproduce under load, find the root cause (product: background mode genuinely holding the process; or test: timing under parallel load) and fix it without weakening what the test proves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The failing assertion and its root cause are identified from a reproduction under load and documented in the task notes
- [x] #2 The fix addresses that root cause (product code if background mode can hold the process, otherwise the test) without weakening what the test proves
- [x] #3 The background test passes in repeated full-suite runs under load (evidence in the task notes)
- [x] #4 Full test suite, build and lint pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause (reproduced 2026-10-10, 1 of 6 full npm test runs in the worktree after 10 green vitest runs and 400 green stress trials):
- None of the test's assertions failed. The afterEach cleanup threw: `Error: EPERM, Permission denied: \?\C:\...\sbl-fake-npm-SiOfSC` at `rmSync(d, { recursive: true, force: true })`. Vitest reports a failing afterEach as a failure of the test that just ran.
- Background mode works as designed: the child always printed 'started', never 'late:', exited with status 0 in about 100 ms (max 835 ms with 24 CPU hogs, max 645 ms over 400 parallel stress trials). Both hypotheses (slow startup, process held open) are ruled out, and src/lib/version-check.ts needs no change.
- Because the child exits right away, the fake npm it spawned (cmd.exe -> npm.cmd -> node fake-npm.mjs) is still starting up when afterEach runs. On Windows, the files it holds open (and any AV scan on them) block deleting the temp dir. The race only loses under full-suite load.

Fix: only the test cleanup now tolerates the orphaned fake npm; the assertions are unchanged, so the test proves the same thing. A first attempt used `rmSync` with maxRetries/retryDelay, and a scratch repro showed it does not help: with a file held open without FILE_SHARE_DELETE, Node 24's native rmSync throws EPERM after 0 ms whatever maxRetries is set to. The async `fs.promises.rm` reports EBUSY, retries, and succeeded after ~1.5 s once the handle closed. afterEach is now async and uses `rm(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })` (linear backoff, up to ~5.5 s).

Verification 2026-10-10: 8 of 8 consecutive full `npm test` runs (build + vitest, 75 files, 851 passed / 5 skipped) green with the fix (before: 1 of 6 failed). `npm run lint` and `tsc -p tsconfig.json --noEmit` clean.
<!-- SECTION:NOTES:END -->
