---
id: TASK-86
title: 'Summary page: architecture.yml schema and validation'
status: To Do
assignee: []
created_date: '2026-10-09 21:50'
updated_date: '2026-10-09 23:53'
labels:
  - feature
  - phase/verify
milestone: m-2
dependencies:
  - TASK-85
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
type: feature
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 2. src/dashboard/summary-schema.ts with types and loadArchitecture(cwd), plus fixtures test/fixtures/summary/architecture.super-backlog.yml and architecture.kursbuchung.yml.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 loadArchitecture(cwd) reads backlog/docs/architecture.yml and returns typed data or error objects carrying path and message (E1-E4)
- [ ] #2 The spec's full YAML example validates clean
- [ ] #3 One test per schema rule: missing schema, unknown kind, duplicate cell, cell outside grid, dangling edge, overlapping zones, flow step without edge (warning, flow dropped), second highlight on one node, size limits, unknown task id (warning)
- [ ] #4 Both fixture files exist and validate clean
<!-- AC:END -->
