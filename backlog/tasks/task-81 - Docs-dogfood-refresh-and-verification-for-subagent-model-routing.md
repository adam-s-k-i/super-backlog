---
id: TASK-81
title: 'Docs, dogfood refresh and verification for subagent model routing'
status: Done
assignee: []
created_date: '2026-10-09 17:48'
updated_date: '2026-10-09 20:58'
labels:
  - feature
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
- [x] #1 harness-support.md, quickstart.md and README.md describe the routing rule and the pointer refresh
- [x] #2 This repo's AGENTS.md block and CLAUDE.md pointer are refreshed by sbl update and the hand-written routing sections are removed; a second update reports no changes
- [x] #3 tsc, npm test and npm run lint pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented the routing rule and pointer refresh in harness-support.md, quickstart.md and README.md (b080249); dogfood refresh via sbl update --no-self and removal of the hand-written routing sections from AGENTS.md/CLAUDE.md (58ebe95). Verified: tsc --noEmit clean, npm test 67 files 579 passed / 4 skipped, npm run lint clean, second sbl update --no-self reports no changes; final whole-branch review: ready to merge.
<!-- SECTION:FINAL_SUMMARY:END -->
