---
id: TASK-35
title: Auto-refresh README dashboard screenshot with curated demo data
status: Done
assignee: []
created_date: '2026-08-27 15:08'
updated_date: '2026-08-27 16:05'
labels:
  - feature
dependencies: []
references:
  - v0.9.0
type: feature
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/assets/dashboard.png is captured manually and shows stale real-repo data. Add scripts/capture-dashboard.mjs that builds a curated demo backlog dataset (tasks across statuses, milestone, dependencies, 30-day activity) in a temp project, renders the dashboard from it, and captures docs/assets/dashboard.png via headless Edge. pages-deploy runs it and commits the png back when changed ([skip ci]). Also expose npm run screenshot for local use.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scripts/capture-dashboard.mjs regenerates docs/assets/dashboard.png from curated demo data
- [x] #2 pages-deploy workflow updates the png automatically when it changes
- [x] #3 npm run screenshot works locally
- [x] #4 Screenshot visually verified to show illustrative example data
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Released in v0.9.0: GitHub release https://github.com/adam-s-k-i/super-backlog/releases/tag/v0.9.0, npm https://www.npmjs.com/package/super-backlog/v/0.9.0. CI, Deploy Pages and Release workflows green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added scripts/capture-dashboard.mjs: builds a curated demo project (acme-webshop, 10 tasks across all statuses, 2 milestones, dependency edges, 30-day activity via relative dates) behind a fake backlog bin, renders the real dashboard from it, and captures docs/assets/dashboard.png via headless Edge (Win) or Chrome/Chromium (Linux CI). Verified by execution: 123.9 KB png showing the full cockpit with illustrative data (visually inspected). npm run screenshot wired; pages-deploy regenerates the png on every master push and opens a refresh PR (docs/dashboard-screenshot branch) when it changed. Full suite green.
<!-- SECTION:FINAL_SUMMARY:END -->
