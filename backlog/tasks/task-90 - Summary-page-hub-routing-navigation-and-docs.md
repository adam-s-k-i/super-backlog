---
id: TASK-90
title: 'Summary page: hub routing, navigation and docs'
status: Done
assignee: []
created_date: '2026-10-09 21:51'
updated_date: '2026-10-10 09:15'
labels:
  - feature
milestone: m-2
dependencies:
  - TASK-89
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
type: feature
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 6. Route /p/<slug>/summary/ with 302 from /summary, sibling file <file>.summary.html, regenerate writes both files, dashboard page tabs, integration tests, docs/guide/project-summary.md and README/quickstart mentions (R1-R6, Data flow, Docs).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /p/<slug>/summary/ returns 200 with the summary marker; /summary returns 302; missing file returns 404 text
- [ ] #2 Writing architecture.yml in a temp project triggers a reload event and the next GET contains a node from the file (skipped where recursive watch is unsupported)
- [ ] #3 An invalid file still yields 200 with the notice; a summary-chain failure leaves the dashboard untouched (E3)
- [ ] #4 Dashboard and summary pages link to each other via page tabs; the Backlog tab opens ../bb/ as a full page
- [ ] #5 docs/guide/project-summary.md exists and is linked from quickstart.md and README.md
<!-- AC:END -->
