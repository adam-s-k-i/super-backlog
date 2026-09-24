---
id: TASK-76
title: 'Backlog browser iframe: same-origin hub proxy + theme sync'
status: In Progress
assignee:
  - '@adamh'
created_date: '2026-09-24 18:33'
updated_date: '2026-09-24 18:45'
labels:
  - dashboard
  - feature
  - phase/plan
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
- [ ] #1 Hub serves the backlog browser iframe same-origin under /p/<slug>/bb/ (cookie-registered reverse proxy)
- [ ] #2 Absolute SPA paths of the proxied browser (assets, chunks, its API) resolve through the hub without HTML rewriting
- [ ] #3 Proxied requests for project A never reach project B browser (cookie isolation)
- [ ] #4 Dashboard theme toggle syncs the iframe light/dark mode (backlog-theme) without a hard reload loop
- [ ] #5 Existing hub routes keep working; tests cover proxy routing, isolation, and theme sync wiring
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TDD: failing hub tests for GET /p/<slug>/bb/ (cookie set, proxies browser root) and cookie-routed unknown root paths with project isolation. 2. Implement in hub.ts: proxy route + cookie routing for non-hub root paths, streaming-friendly (SSE) piping. 3. TDD: dashboard-render tests pin iframe src /p/<slug>/bb/ and theme-sync script; update dashboard.html (iframe src + backlog-theme sync on toggle). 4. Full suite + lint; feature branch + PR; then release 1.5.0 via release-please.
<!-- SECTION:PLAN:END -->
