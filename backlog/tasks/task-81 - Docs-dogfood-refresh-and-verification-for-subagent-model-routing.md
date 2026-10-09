---
id: TASK-81
title: 'Docs, dogfood refresh and verification for subagent model routing'
status: To Do
assignee: []
created_date: '2026-10-09 17:48'
updated_date: '2026-10-09 17:53'
labels:
  - feature
  - phase/plan
dependencies:
  - TASK-80
references:
  - docs/superpowers/plans/2026-10-09-subagent-model-routing.md
  - docs/superpowers/specs/2026-10-09-subagent-model-routing-design.md
type: feature
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 3. Document the routing rule in docs/guide/harness-support.md, docs/guide/quickstart.md and README.md; refresh this repo via the local build (sbl update --no-self) and remove the hand-written routing sections from AGENTS.md and CLAUDE.md (spec M9); full verification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 harness-support.md, quickstart.md and README.md describe the routing rule and the pointer refresh
- [ ] #2 This repo's AGENTS.md block and CLAUDE.md pointer are refreshed by sbl update and the hand-written routing sections are removed; a second update reports no changes
- [ ] #3 tsc, npm test and npm run lint pass
<!-- AC:END -->
