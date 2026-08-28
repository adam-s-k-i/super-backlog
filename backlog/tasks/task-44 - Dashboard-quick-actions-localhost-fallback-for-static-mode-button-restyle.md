---
id: TASK-44
title: 'Dashboard quick actions: localhost fallback for static mode + button restyle'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-28 11:50'
updated_date: '2026-08-28 11:57'
labels: []
dependencies: []
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The three quick-action buttons (backlog browser, backlog board, sbl dashboard --serve) do nothing useful in the static dashboard (file:// or GitHub Pages): the fetch to /api/run fails and the silent fallback copies only the label, not the command. Restyle buttons as compact cards with a prominent title and the command shown subtly below (remove the ' copy' suffix). Static clicks should POST to the local serve server at http://127.0.0.1:6428/api/run and fall back to clipboard copy with visible feedback. Ensure drafts are shown in both static and dynamic dashboards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Served mode: browser/board buttons POST to same-origin /api/run; static mode: they POST to http://127.0.0.1:6428/api/run; on failure the real command string is copied to clipboard with transient visible feedback
- [x] #2 The 'sbl dashboard --serve' button always copies its command to clipboard with feedback; the ' copy' suffix text is removed from all buttons
- [x] #3 Buttons render as cards: prominent title (Backlog Browser, Backlog Board, Live Dashboard) with the command in dim mono below
- [x] #4 /api/run responds to OPTIONS preflight and sends access-control-allow-origin so static pages can reach it
- [x] #5 Rendered dashboard (static and served are the same HTML) contains the drafts island and calls renderDrafts; covered by tests
- [x] #6 Root dashboard.html regenerated and committed; full test suite and lint pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TDD: render tests for new button card structure (title+command, no copy suffix), server tests for CORS preflight+header on /api/run, drafts island/render assertion. 2. Template: restyle buttons, new click handler (same-origin when http, 127.0.0.1:6428 when file://, clipboard+feedback fallback; serve button always copies). 3. server.ts: OPTIONS + access-control-allow-origin on /api/run. 4. Update snapshot, regenerate root dashboard.html. 5. Full suite + lint.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Quick-action buttons reworked: card layout with prominent title + dim mono command, no ' copy' suffix. Static dashboard (file:// or GitHub Pages) now POSTs to the local serve server at http://127.0.0.1:6428/api/run (same-origin when served); on failure the real command is copied to clipboard with transient 'copied'/'started' feedback. /api/run answers OPTIONS preflight and sends access-control-allow-origin. Drafts are embedded in the data island and rendered by renderDrafts in both modes (same HTML). Root dashboard.html regenerated. Verified: 362 passed/3 skipped (Node24 watcher skips), snapshot updated, lint clean.
<!-- SECTION:FINAL_SUMMARY:END -->
