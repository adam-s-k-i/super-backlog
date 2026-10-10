---
id: TASK-100
title: 'Summary drift: detectDrift module and shared agent prompts'
status: In Progress
assignee: []
created_date: '2026-10-10 15:07'
updated_date: '2026-10-10 15:38'
labels:
  - feature
  - phase/impl
dependencies: []
references:
  - docs/superpowers/specs/2026-10-10-summary-drift-design.md
  - docs/superpowers/plans/2026-10-10-summary-drift.md
type: feature
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 1. New src/dashboard/summary-drift.ts with detectDrift(cwd, architecture, { tasks, deps }) returning { findings, notes } for the signals missing-path, done-task, unknown-task and stale-file, plus summaryAgentPrompt(state) for the missing/invalid/drift prompts shared by CLI and page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 detectDrift reports missing-path (trailing / requires a directory), done-task (isDone from metrics.ts), unknown-task and stale-file exactly as the spec's signal table defines
- [ ] #2 STALE_COMMIT_THRESHOLD = 20 is exported; 19 commits yield no finding, 20 yield one; the stale check uses at most two git calls
- [ ] #3 Skipped signals (tasks null, no git, not a repository, no history) produce a note; a throwing dep becomes a note and the other signals still run; detectDrift never throws
- [ ] #4 Findings are ordered by signal, then by path
- [ ] #5 summaryAgentPrompt returns the three prompt strings verbatim from the spec
- [ ] #6 test/unit/summary-drift.test.ts covers every case above; npm test and npm run lint pass
<!-- AC:END -->
