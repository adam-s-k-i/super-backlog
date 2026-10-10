---
id: TASK-101
title: 'Summary drift: sbl summary command with --check'
status: In Progress
assignee: []
created_date: '2026-10-10 15:07'
updated_date: '2026-10-10 15:41'
labels:
  - feature
  - phase/impl
dependencies:
  - TASK-100
references:
  - docs/superpowers/specs/2026-10-10-summary-drift-design.md
  - docs/superpowers/plans/2026-10-10-summary-drift.md
type: feature
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 2. New command sbl summary [--check] (src/commands/summary.ts) that loads backlog/docs/architecture.yml, runs detectDrift and prints doctor-style status, findings, notes and a next-step agent prompt. Extracts the doctor task-list helper into src/lib/task-list.ts (readTaskList) shared by doctor and summary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Output matches the spec samples: [ok]/[warn]/[fail] status line, aligned code/path/message finding lines, note lines, and next step: ask your agent: "<prompt>" for missing, invalid or drift
- [ ] #2 An invalid file lists at most 20 problems followed by '… and N more'; no drift check runs on an invalid file
- [ ] #3 --check prints the same status, finding and note lines without the next-step line and with identical exit codes
- [ ] #4 Exit codes: 0 valid and clean; 4 missing, schema/layout warnings or drift; 1 invalid or not inside a project
- [ ] #5 readTaskList lives in src/lib/task-list.ts and sbl doctor uses it with unchanged behaviour
- [ ] #6 CLI dispatch, sbl --help and the README command table list sbl summary
- [ ] #7 Unit tests for every output state plus an E2E test against dist/bin.js in a temp git repo (missing path exits 4, fixed file exits 0); npm test and npm run lint pass
<!-- AC:END -->
