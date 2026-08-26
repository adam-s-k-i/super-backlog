---
id: TASK-15
title: 'Dashboard v2: HTS-style project cockpit with freshness hook'
status: Done
assignee: []
created_date: '2026-08-26 02:24'
updated_date: '2026-08-26 10:13'
labels:
  - dashboard
  - ux
dependencies: []
type: feature
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rebuild the Project Dashboard in the HTS cheat-sheet design language (dark #0a0e16, cyan #5cc8ff, mono numerals, sidebar, numbered sections): 7 sections, SVG donut/bars/sparkline/stepper plus interactive layered dependency graph, hover tooltips for glossary terms (built-in + project glossary from backlog/docs/glossary.md), detail panel, and a marker-scoped post-commit hook that regenerates the dashboard whenever a commit touches backlog/ (never blocking). Spec: docs/superpowers/specs/2026-08-25-dashboard-v2-design.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dashboard.html renders in HTS design with sidebar and 7 numbered sections
- [x] #2 donut, milestone bars, 30-day sparkline, stepper and dependency graph render from backlog data as inline SVG
- [x] #3 glossary tooltips work for built-in terms and project terms override via backlog/docs/glossary.md
- [x] #4 post-commit hook regenerates dashboard on backlog-touching commits, never blocks, composes with guard hook, --no-refresh-hook opts out
- [x] #5 uninstall removes the refresh block and keeps foreign content
- [x] #6 full suite green including new collector/hook/graph tests and updated snapshot
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: SDD run in worktree feat/dashboard-v2 (ledger .superpowers/sdd/2026-08-26-dashboard-v2/progress.md). 176-test suite on branch, 191/191 after merge with automation stream. Reviews: batch A/B/C approved, final whole-branch review With-fixes -> fix e1ebc06 (cycleSnap layering + v2 screenshot 161KB) re-reviewed ADDRESSED. Post-merge CI success (Guard/Lint/test x2), Deploy Pages success. Dogfood: dashboard.html regenerated via sbl update + hook.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dashboard v2 shipped: HTS-style dark cockpit (sidebar, 7 sections, donut/bars/sparkline/stepper, layered dependency graph with cycle-safe layering, glossary tooltips with project override, detail panel) plus post-commit freshness hook (never blocks, --no-refresh-hook opt-out, composes with guard). Verified: 191/191 tests post-merge, CI+Pages success, live on GitHub Pages.
<!-- SECTION:FINAL_SUMMARY:END -->
