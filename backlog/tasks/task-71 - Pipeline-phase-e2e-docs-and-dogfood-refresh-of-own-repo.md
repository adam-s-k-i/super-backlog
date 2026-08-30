---
id: TASK-71
title: 'Pipeline phase: e2e, docs, and dogfood refresh of own repo'
status: In Progress
assignee:
  - '@adamh'
created_date: '2026-08-30 13:16'
updated_date: '2026-08-30 13:47'
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
- [x] #1 E2E test walks the full phase lifecycle with the real backlog CLI; transition rejection on unlabeled tasks exits 1
- [x] #2 docs/guide/pipeline-phases.md exists, is registered in the VitePress sidebar, and README links it
- [x] #3 Local update --no-self refreshed AGENTS.md marker to the current kit version and installed skill copies match the new templates
- [x] #4 npm test and npm run lint green; manual acceptance checklist from the plan handed to the user - production decision stays with the user
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Manual acceptance walkthrough (plan section Manual acceptance checklist) done by the user, not the agent
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. E2E test test/e2e/phase.e2e.test.ts (real backlog CLI via PATH, full lifecycle). 2. docs/guide/pipeline-phases.md + sidebar + README. 3. Dogfood: update --no-self refreshes own AGENTS.md + skills. 4. npm test + npm run lint green. 5. Finalize + hand acceptance checklist to user.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: e2e 2/2 (full lifecycle spec->plan->impl->verify->done + unlabeled rejection exit 1; scaffold mirrors sbl init by writing backlog/config.yml directly since backlog init is interactive); npm test 63 files / 532 passed; npm run lint exit 0. Dogfood: node dist/bin.js update --no-self advanced AGENTS.md marker 0.1.0 -> 1.3.1 with phase table + rule 5 and refreshed 6 skill copies; .super-backlog/ gitignored (machine-local router state). P12 verified in practice: stale marker block recognized and replaced.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added phase e2e against the real backlog CLI, pipeline-phases guide (sidebar + README), and refreshed this repo's own glue files via local update; suite and lint green. Manual acceptance handed to the user - production decision (R4) stays with the user.
<!-- SECTION:FINAL_SUMMARY:END -->
