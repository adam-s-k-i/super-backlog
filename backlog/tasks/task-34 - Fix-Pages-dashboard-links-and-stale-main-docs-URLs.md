---
id: TASK-34
title: Fix Pages dashboard links and stale /main/ docs URLs
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 15:08'
updated_date: '2026-08-27 16:05'
labels:
  - bug
dependencies: []
references:
  - v0.9.0
type: bug
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VitePress SPA router intercepts clicks on /dashboard.html (not in the route map) and shows its own 404 even though the static file exists. Nav item and landing-page button need target=_blank. Also docs/guide/quickstart.md still references /main/ raw URLs (404); must be /master/.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Nav Dashboard link and landing Project Dashboard button use target=_blank
- [x] #2 No /main/ raw.githubusercontent URLs remain in docs (installer URLs use /master/)
- [x] #3 Regression test in docs.test.ts asserts both
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TDD: docs.test.ts regression tests (no /main/ raw URLs in docs, dashboard links carry target=_blank). 2. config.mts nav item + index.md landing button: target _blank/rel noreferrer. 3. quickstart.md /main/ -> /master/. 4. vitepress build + full suite green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Released in v0.9.0: GitHub release https://github.com/adam-s-k-i/super-backlog/releases/tag/v0.9.0, npm https://www.npmjs.com/package/super-backlog/v/0.9.0. CI, Deploy Pages and Release workflows green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Root cause of the dead dashboard links: dashboard.html is a public static file outside the VitePress route map, so the SPA router swallowed clicks and rendered its own 404 despite the file existing (200). Nav item (config.mts) and landing button (index.md) now use target=_blank rel=noreferrer; verified in the built dist output. Stale /main/ installer URLs in README.md and docs/guide/quickstart.md corrected to /master/. Regression coverage: 3 new doc-rot tests in docs.test.ts (10/10 green); full suite + markdownlint/cspell clean.
<!-- SECTION:FINAL_SUMMARY:END -->
