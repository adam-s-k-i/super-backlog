---
id: TASK-15
title: 'Dashboard v2: HTS-style project cockpit with freshness hook'
status: To Do
assignee: []
created_date: '2026-08-26 02:24'
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
- [ ] #1 dashboard.html renders in HTS design with sidebar and 7 numbered sections
- [ ] #2 donut, milestone bars, 30-day sparkline, stepper and dependency graph render from backlog data as inline SVG
- [ ] #3 glossary tooltips work for built-in terms and project terms override via backlog/docs/glossary.md
- [ ] #4 post-commit hook regenerates dashboard on backlog-touching commits, never blocks, composes with guard hook, --no-refresh-hook opts out
- [ ] #5 uninstall removes the refresh block and keeps foreign content
- [ ] #6 full suite green including new collector/hook/graph tests and updated snapshot
<!-- AC:END -->
