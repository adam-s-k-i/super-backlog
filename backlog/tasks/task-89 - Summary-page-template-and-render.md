---
id: TASK-89
title: 'Summary page: template and render'
status: Done
assignee: []
created_date: '2026-10-09 21:51'
updated_date: '2026-10-10 09:15'
labels:
  - feature
milestone: m-2
dependencies:
  - TASK-86
  - TASK-87
  - TASK-88
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
type: feature
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 5. src/templates/summary.html, extraction of src/templates/sbl-tokens.css from the dashboard, src/dashboard/summary-render.ts, interactions, reduced view, notices (V1-V7, accessibility, theming, security sections). UI chrome in English; curated content stays in the author's language.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Full-view snapshot for the super-backlog fixture and reduced-view snapshot (no architecture.yml) exist
- [ ] #2 An invalid file renders the notice instead of the diagram
- [ ] #3 <script> and quotes in pitch, labels, commands and file names never appear unescaped; **bold** becomes <b> only in the pitch
- [ ] #4 EventSource path is ../api/events; the sbl-theme resolver is present; sbl-tokens.css holds the two new hues in both theme blocks and the dashboard uses it unchanged visually
- [ ] #5 Keyboard tour (Tab, Enter, Esc, flow chips, stack buttons) and prefers-reduced-motion work
<!-- AC:END -->
