---
id: TASK-99
title: 'Summary reduced view: open work squeezed into one third of the width'
status: In Progress
assignee: []
created_date: '2026-10-10 10:34'
updated_date: '2026-10-10 10:34'
labels:
  - bug
  - phase/impl
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
  - src/templates/summary.html
type: bug
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On a project without backlog/docs/architecture.yml (reduced view, no Highlights section) the profile row .around keeps its three grid tracks but renders only two sections (Open work + Commands, Tech stack). Open work is squeezed into the first track (~1/3 of 1280px) with heavy title wrapping, and the third track stays empty. Same happens in the full view when architecture.yml has no highlights.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With two sections the profile row uses two tracks, open work wider than tech stack (about 1.6fr / 1fr); with three sections the existing three-track layout is unchanged
- [ ] #2 Responsive breakpoints still collapse to one column at <=640px
- [ ] #3 A test covers the two-section case
- [ ] #4 npm test passes
<!-- AC:END -->
