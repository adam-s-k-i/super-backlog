---
id: TASK-73
title: >-
  Dashboard: milestones into Status, tasks table page size + default sort, modal
  padding and list overflow
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-30 17:32'
updated_date: '2026-08-30 17:42'
labels:
  - feature
  - dashboard
dependencies: []
type: feature
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three UI changes to the served dashboard: (1) remove section 04 Milestones and render the milestone bars inside section 02 Status next to the donut, renumbering later sections; (2) tasks table defaults to 20 rows sorted by updated, with a page-size selector (10/20/50/100/all); (3) task and draft modals get more padding and list bullets must not overflow the content box.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Section 04 Milestones is gone; milestone bars render in section 02 Status beside the donut; sections renumbered without gaps (07 total) and sidebar matches
- [x] #2 Tasks table shows at most 20 rows by default, sorted by updated by default; a selector offers 10/20/50/100/all and changing it re-renders
- [x] #3 Dialog content has visibly more padding and ul bullets stay inside the content box for task and draft modals
- [x] #4 Render tests + snapshot updated; full suite and lint green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. RED: render tests for section renumber (bars in sec-02, no sec-04), page-size selector + default sort updated, dialog padding + ul containment; update stale section assertions. 2. Implement template changes. 3. Snapshot refresh + review diff. 4. Full suite + lint. 5. Live probe via hub + playwright screenshot. 6. Finalize; local commit; push only after user OK.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: render tests 89/89 incl. 3 new layout-v3 tests (RED verified: 7 failures before impl); snapshot refreshed and reviewed (53+/25-); full suite 64 files / 544 passed; lint OK. Live probe: hub + full-page screenshot - bars beside donut in sec-02 (glossary term Milestone preserved in bars sub-head), sidebar 7 sections, tasks default UPDATED desc with 20 rows + selector 10/20/50/100/all, dialog padding 6px 32px 32px with #task-dialog ul containment.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dashboard v3: milestones merged into Status beside the donut (7 sections), tasks table defaults to 20 rows sorted by updated with a page-size selector, dialogs got more padding and list bullets stay inside the content box; verified by tests, suite, lint, and a live hub screenshot.
<!-- SECTION:FINAL_SUMMARY:END -->
