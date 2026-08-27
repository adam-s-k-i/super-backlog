---
id: TASK-23
title: 'sbl init: preflight integration and --fix-all flag'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 11:44'
updated_date: '2026-08-27 12:15'
labels:
  - feature
milestone: m-0
dependencies:
  - TASK-22
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wire the preflight module (TASK-22) into sbl init. Without flag: safe fixes run automatically, system-changing fixes (Node install, execution policy) ask Y/n. With --fix-all: everything runs without prompting. After init completes, run doctor as final verification; installation is only reported successful when doctor shows 0 warnings. Goal: one command ends with a working sbl or the user knows exactly which single manual step remains.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sbl init --fix-all runs all preflight fixes without prompting
- [x] #2 Without --fix-all, system-changing fixes require interactive Y/n confirmation
- [x] #3 init ends with a doctor verification pass and only reports success at 0 warnings
- [x] #4 Failed fixes abort with a clear message containing the exact manual command
- [x] #5 Integration tests cover fix-all and interactive-consent paths
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend preflight with a units filter (init runs only node-version, execution-policy, npm-command; install-type fixes stay out of init). TDD: filter test first. 2. runInit gains an optional deps seam (preflight, doctor, confirm) for tests; cli.ts registers --fix-all + help text. 3. Behavior: preflight before actions; failed -> abort exit 1 with manual command; needs-manual -> continue with warning (keeps current policy-warning behavior); --fix-all -> fixAll:true, no prompts; otherwise interactive Y/n via sync stdin prompt (non-TTY defaults to no). 4. After actions: doctor verification pass; warnings -> exit 4. 5. Integration tests (in-process, injected fakes): fix-all path, consent path, failed-abort path, doctor verification. 6. Full suite green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TDD cycles: preflight units filter + package.json guard (2 unit tests), runInit deps seam (6 integration tests). Regression fix: defaultExecutor uses shell on win32 (.cmd shims need cmd.exe). Contract: blocking policy now exits 4 via doctor verification (e2e updated); needs-manual never changes exit code; router-lifecycle stubs doctor.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wired preflight into sbl init: safe units run before actions; fix-all bypasses prompts, otherwise interactive Y/n (non-TTY defaults to no); failed fixes abort with exit 1 and the exact manual command; doctor verification pass gates success at 0 warnings. Verified with 25 new/updated tests; full suite 281/281 green, tsc build clean.
<!-- SECTION:FINAL_SUMMARY:END -->
