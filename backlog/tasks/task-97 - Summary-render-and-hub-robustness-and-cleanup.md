---
id: TASK-97
title: 'Summary render and hub: robustness and cleanup'
status: To Do
assignee: []
created_date: '2026-10-10 10:28'
labels:
  - chore
  - phase/spec
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
  - src/dashboard/summary-render.ts
  - src/dashboard/render.ts
type: chore
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the project-summary final review (v1.7.0). Small robustness gaps in summary rendering and hub integration: write failures are silent, the E3 fallback shows a contradictory data-source line, placeholder expansion is sequential, and some test assertions are weak or too broad.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 writeSummaryPage logs an atomicWrite failure to stderr, so the hub no longer serves an unexplained 404
- [ ] #2 The E3 error fallback does not say 'No curated file yet' when a curated file exists but failed to load, and does not collect facts a second time
- [ ] #3 Placeholder expansion is single-pass in both summary-render and renderDashboard, so __SBL_*__ text inside substituted content is not expanded; a test covers it
- [ ] #4 The duplicated token-CSS injection is a shared tokensCss() helper; data-source counts use plural()
- [ ] #5 Temporary sbl-dashboard-*.summary.html files are cleaned up when the hub stops
- [ ] #6 sbl doctor guards the layoutArchitecture call so an unexpected throw becomes a problem line instead of a crash
- [ ] #7 Tests: the V2 no-raw-colours regex strips only the token :root block; the 'keeps the dashboard intact' summary 404 assertion checks the body text; the full-view snapshot is reduced to stable structure instead of ~2150 lines of geometry; a DOM-level test exercises the client script (flow select, tabs)
- [ ] #8 npm test passes
<!-- AC:END -->
