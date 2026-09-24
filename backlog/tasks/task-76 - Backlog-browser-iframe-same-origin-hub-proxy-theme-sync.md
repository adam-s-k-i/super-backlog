---
id: TASK-76
title: 'Backlog browser iframe: same-origin hub proxy + theme sync'
status: Done
assignee:
  - '@adamh'
created_date: '2026-09-24 18:33'
updated_date: '2026-09-24 18:53'
labels:
  - dashboard
  - feature
dependencies: []
type: feature
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The dashboard embeds the Backlog.md browser in a cross-origin iframe (own port), so the dashboard cannot sync its light/dark theme and the visual seam is jarring. TASK-62 spike proved the hub can reverse-proxy the spawned browser under its own origin using cookie-based routing for the SPA's absolute paths, with multi-project isolation verified. Deliver Phase 1 from that recommendation: same-origin iframe + theme-mode sync with the dashboard toggle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hub serves the backlog browser iframe same-origin under /p/<slug>/bb/ (cookie-registered reverse proxy)
- [x] #2 Absolute SPA paths of the proxied browser (assets, chunks, its API) resolve through the hub without HTML rewriting
- [x] #3 Proxied requests for project A never reach project B browser (cookie isolation)
- [x] #4 Dashboard theme toggle syncs the iframe light/dark mode (backlog-theme) without a hard reload loop
- [x] #5 Existing hub routes keep working; tests cover proxy routing, isolation, and theme sync wiring
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TDD: failing hub tests for GET /p/<slug>/bb/ (cookie set, proxies browser root) and cookie-routed unknown root paths with project isolation. 2. Implement in hub.ts: proxy route + cookie routing for non-hub root paths, streaming-friendly (SSE) piping. 3. TDD: dashboard-render tests pin iframe src /p/<slug>/bb/ and theme-sync script; update dashboard.html (iframe src + backlog-theme sync on toggle). 4. Full suite + lint; feature branch + PR; then release 1.5.0 via release-please.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: new test/unit/hub-backlog-proxy.test.ts (6 tests) proves AC1 (GET /p/<slug>/bb/ proxies browser root, sets sbl_bb cookie), AC2 (absolute SPA path /chunk-*.css routed by cookie through the hub, no HTML rewriting), AC3 (alpha vs bravo browser isolation; requests without or with unknown cookie stay 404 and never reach a browser). AC4 pinned by dashboard-render tests: iframe uses bb/ under the hub and applyBacklogTheme syncs backlog-theme + .dark on load and on toggle (cross-origin serve mode degrades silently via try/catch). AC5: full suite 65 files / 553 passed / 4 skipped, lint 0 issues; CI green on PR #76 (squash-merged to master).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the TASK-62 Phase 1 recommendation: the hub now reverse-proxies the spawned backlog browser same-origin under /p/<slug>/bb/ with cookie-based routing for the SPA's absolute paths, and the dashboard theme toggle syncs the embedded UI's light/dark mode. Verified by 6 new proxy tests (routing, isolation, passthrough, error propagation), updated render pins/snapshot, and a fully green suite (553 passed) plus green CI on PR #76.
<!-- SECTION:FINAL_SUMMARY:END -->
