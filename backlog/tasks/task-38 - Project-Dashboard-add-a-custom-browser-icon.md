---
id: TASK-38
title: 'Project Dashboard: add a custom browser icon'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 19:13'
updated_date: '2026-08-27 20:52'
labels:
  - ux
dependencies: []
type: feature
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The generated dashboard.html currently has no favicon, so browser tabs show a generic icon. Add an inline SVG favicon using the existing brand glyph so no extra asset file is needed and the dashboard is recognizable in tabs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dashboard.html includes a favicon link
- [x] #2 The icon uses an inline SVG data URI
- [x] #3 The icon is visible in browser tabs
- [x] #4 No additional file dependency is introduced
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an inline SVG favicon <link> to src/templates/dashboard.html <head> using the accent-colored circle glyph.\n2. Add a unit test asserting the generated HTML contains a favicon link and no external URL dependency.\n3. Update snapshot if needed.\n4. Run npm test, build, lint.\n5. Manually open dashboard.html in browser context and verify the favicon is present in DOM.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: added an inline SVG favicon <link> to src/templates/dashboard.html using the accent-colored circle glyph. Added unit test in test/unit/dashboard-render.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an inline SVG favicon to dashboard.html using the super-backlog accent circle. Verified with npm test (329 passed), build, lint, and generated dashboard.html containing the favicon link.
<!-- SECTION:FINAL_SUMMARY:END -->
