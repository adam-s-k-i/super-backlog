---
id: TASK-98
title: 'Summary: handle stale tasks entries in architecture.yml'
status: Done
assignee: []
created_date: '2026-10-10 10:28'
updated_date: '2026-10-10 17:12'
labels:
  - enhancement
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
  - backlog/docs/architecture.yml
type: enhancement
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the project-summary release (v1.7.0). The tasks map in backlog/docs/architecture.yml links task ids to diagram nodes, but nothing tells the author when mapped tasks are Done or archived, so the map goes stale (the dogfood file still maps TASK-85..92, all Done). Decide how stale entries are surfaced and keep the dogfood file current.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Behaviour is decided and documented in the guide: sbl doctor warns about tasks entries whose task is Done or archived, or the summary page ignores them
- [x] #2 The architecture-summary skill tells the agent to prune Done task ids when it updates architecture.yml
- [x] #3 The dogfood backlog/docs/architecture.yml has no stale tasks entries and sbl doctor reports it clean
- [x] #4 npm test passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded by summary drift detection (spec 2026-10-10): sbl summary, doctor check 5 and the summary page report Done and unknown tasks entries as drift, the architecture-summary skill prunes them, and the dogfood file is clean.
<!-- SECTION:FINAL_SUMMARY:END -->
