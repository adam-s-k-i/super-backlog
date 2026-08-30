---
id: TASK-71
title: 'Pipeline phase: e2e, docs, and dogfood refresh of own repo'
status: To Do
assignee: []
created_date: '2026-08-30 13:16'
labels:
  - feature
  - phase/spec
dependencies:
  - TASK-66
  - TASK-67
  - TASK-69
  - TASK-70
references:
  - docs/superpowers/plans/2026-08-30-pipeline-phase.md
type: feature
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Final unit: e2e test walking spec->plan->impl->verify->done against the real backlog CLI in a temp project, user-facing docs (guide page, sidebar, README), and a local update --no-self run refreshing this repo's own AGENTS.md and installed skills from the stale 0.1.0 block. Implements plan Task 7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 E2E test walks the full phase lifecycle with the real backlog CLI; transition rejection on unlabeled tasks exits 1
- [ ] #2 docs/guide/pipeline-phases.md exists, is registered in the VitePress sidebar, and README links it
- [ ] #3 Local update --no-self refreshed AGENTS.md marker to the current kit version and installed skill copies match the new templates
- [ ] #4 npm test and npm run lint green; manual acceptance checklist from the plan handed to the user - production decision stays with the user
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Manual acceptance walkthrough (plan section Manual acceptance checklist) done by the user, not the agent
<!-- DOD:END -->
