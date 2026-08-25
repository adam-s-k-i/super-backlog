---
id: TASK-3
title: Capture Project Dashboard screenshot for README
status: Done
assignee: []
created_date: '2026-08-25 23:27'
updated_date: '2026-08-25 23:48'
labels:
  - ux
dependencies: []
type: docs
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Render dashboard.html in a headless browser and save docs/assets/dashboard.png; activate the commented README image link so the landing page shows the cockpit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/assets/dashboard.png exists and shows the rendered dashboard
- [ ] #2 active markdown image link in README replaces the HTML comment placeholder
- [ ] #3 doc-rot guard test updated to expect the active link
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: headless Edge screenshot of dashboard.html saved to docs/assets/dashboard.png (59.8 KB, visually verified: header, overview cards, task table, cheat sheet all rendered). README link activated, doc-rot test flipped to assert the active link plus asset existence. Full suite 114/114 passing.

Correction: suite is 113 tests (not 114) - the docs guard was replaced 1:1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Captured docs/assets/dashboard.png via headless Edge from dashboard.html (visually verified render), activated the README image link, flipped the doc-rot guard to require the active link plus committed asset. Verified: full suite 113/113 passing incl. updated guard.
<!-- SECTION:FINAL_SUMMARY:END -->
