---
id: TASK-119
title: 'Summary drift: honest git failure wording in the stale-file check'
status: Done
assignee: []
created_date: '2026-10-11 07:30'
updated_date: '2026-10-11 07:38'
labels:
  - bug
dependencies: []
references:
  - docs/superpowers/plans/2026-10-11-drift-git-failure.md
type: bug
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
staleFile() in src/dashboard/summary-drift.ts labels every non-127 'git log' failure as 'not a git repository'. Apply the classification PR #89 introduced in summary-facts (gitFailure helper): 'not a git repository' only when stderr says so; exit 127 or a spawn error -> 'git unavailable'; ENOBUFS -> buffer message; anything else -> 'git failed' with the first stderr line.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 stale-file note says 'not a git repository' only when git's stderr matches /not a git repository/i
- [x] #2 exit 127 or a spawn error code gives 'git unavailable'; ENOBUFS gives the 64 MB buffer message
- [x] #3 any other non-zero exit gives 'git failed' followed by the first stderr line in parentheses (no parentheses when stderr is empty)
- [x] #4 classification reuses gitFailure from summary-facts.ts; every branch has a unit test
- [x] #5 npm test, npm run lint and node dist/bin.js summary --check pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
staleFile() now classifies a failed 'git log' with gitFailure from summary-facts.ts (PR #89): ENOBUFS -> buffer message, exit 127 or spawn error -> 'git unavailable', 'not a git repository' only when stderr says so, otherwise 'git failed (<first stderr line>)'. Seven table rows in test/unit/summary-drift.test.ts cover each branch (red before the fix, green after). Gates: npm test 1082 passed/5 skipped, npm run lint 0 issues, tsc build ok, node dist/bin.js summary --check: valid, no drift.
<!-- SECTION:FINAL_SUMMARY:END -->
