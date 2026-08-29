---
id: TASK-50
title: 'Dashboard: task detail data source for descriptions and ACs'
status: Done
assignee: []
created_date: '2026-08-29 16:42'
updated_date: '2026-08-29 17:12'
labels: []
dependencies: []
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
backlog task list --json (schemaVersion 1) carries no description or acceptance criteria, so the task detail dialog has no rich content in production. Decide and implement a data source: per-task backlog task view --json calls (N+1, slow for large boards) vs reading task markdown files directly vs upstream flag. Includes mapping acceptanceCriteria shape from task view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Detail dialog shows description and ACs for real backlog data
- [x] #2 Collection stays fast for 100+ tasks
<!-- AC:END -->
