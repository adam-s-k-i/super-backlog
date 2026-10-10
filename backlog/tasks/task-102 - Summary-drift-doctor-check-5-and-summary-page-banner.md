---
id: TASK-102
title: 'Summary drift: doctor check 5 and summary page banner'
status: To Do
assignee: []
created_date: '2026-10-10 15:07'
updated_date: '2026-10-10 15:38'
labels:
  - feature
  - phase/plan
dependencies:
  - TASK-101
references:
  - docs/superpowers/specs/2026-10-10-summary-drift-design.md
  - docs/superpowers/plans/2026-10-10-summary-drift.md
type: feature
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 3. Doctor check 5 reports drift as one warn line; the summary page shows a subtle drift banner with a copy-prompt button, and the missing-file notice gets the same copy button. Includes pruning the Done tasks entries from the dogfood architecture.yml and making the doctor E2E tolerant of repo drift.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Doctor check 5 prints '[warn] architecture.yml valid, N drift findings – run sbl summary for details' on drift; a throw in layout or drift detection becomes a problem line instead of a crash
- [ ] #2 buildSummaryModel sets model.drift ({ count, codes, prompt } or null); drift detection reuses the hub's already-loaded task list and any throw yields drift null
- [ ] #3 noticeHtml renders the drift banner with a copy button carrying the drift prompt; the missing-file notice has a copy button with the missing prompt; prompt text is HTML-escaped; only existing tokens are used
- [ ] #4 test/e2e/doctor.e2e.test.ts passes whether or not the repo has drift (exit 4 accepted only when the drift line is the sole warning)
- [ ] #5 The dogfood backlog/docs/architecture.yml no longer maps the Done tasks TASK-85..92
- [ ] #6 Doctor and summary-render tests cover the new behaviour; npm test and npm run lint pass
<!-- AC:END -->
