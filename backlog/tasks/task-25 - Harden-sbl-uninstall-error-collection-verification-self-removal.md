---
id: TASK-25
title: 'Harden sbl uninstall: error collection, verification, self-removal'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 11:44'
updated_date: '2026-08-27 12:30'
labels:
  - feature
milestone: m-0
dependencies: []
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make sbl uninstall as resilient as the new install flow. (1) Steps no longer abort mid-process: errors are collected and reported as error: lines with non-zero exit code; the fail-fast JSON validation of package.json/opencode.json stays (prevents data loss). (2) Final verification pass after uninstall: scan for kit-owned leftovers (AGENTS.md block, skill dirs, git hooks, opencode.json entry, dashboard.html) and report clean or a list of remnants with reasons. (3) Global self-removal: after successful project cleanup, run npm uninstall -g super-backlog as the last step (automatic with --fix-all, Y/n otherwise; on failure print the exact manual command).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A failing uninstall step does not abort remaining steps; errors are collected, reported and produce a non-zero exit code
- [x] #2 Uninstall ends with a verification pass reporting clean or leftover kit artifacts with reasons
- [x] #3 Global package removal is offered (Y/n) or automatic with --fix-all, with manual fallback command on failure
- [x] #4 JSON validation fail-fast behavior is preserved
- [x] #5 Tests cover partial-failure collection, verification pass and self-removal gating
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TDD: new test/integration/uninstall-hardening.test.ts (failing step does not abort, verification pass reports remnants or clean, self-removal gating). 2. uninstall.ts: verdict type gains error; each removal step wrapped in try/catch -> error collected, exit 1 at end; JSON fail-fast stays. 3. Verification pass after report: probe AGENTS.md block, skill dirs, hooks, opencode.json entry, dashboard -> print clean or remnant list. 4. Self-removal: --fix-all auto, else Y/n (non-TTY prints manual command); deps seam removeGlobal/confirm for tests; npm via .cmd on win32. 5. cli.ts: register --fix-all for uninstall + help. 6. Full suite green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TDD: 6 integration tests first (5 failed as expected). Error collection via attempt() wrapper per step; verdict type gains error (models/uninstall.ts ReportLine widened). Verification pass verifyRemnants() probes AGENTS.md/CLAUDE.md blocks, skill dirs, hooks (GUARD_RE/REFRESH_RE), opencode.json plugin, dashboard; defensive try/catch for unreadable files. Self-removal last step, fix-all or Y/n (non-TTY prints manual command). Test realism: AGENTS.md-as-directory forces EISDIR (chmod read-only unreliable on Windows with rename-based atomicWrite).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
sbl uninstall is now resilient: steps no longer abort mid-process (errors collected as error: lines, exit 1), JSON fail-fast preserved, a verification pass reports clean or leftover kit artifacts, and the global npm package is removed as the last step (automatic with fix-all, Y/n otherwise, manual command on decline/failure). Verified with test/integration/uninstall-hardening.test.ts (6 tests); full suite 287/287 green, tsc build clean.
<!-- SECTION:FINAL_SUMMARY:END -->
