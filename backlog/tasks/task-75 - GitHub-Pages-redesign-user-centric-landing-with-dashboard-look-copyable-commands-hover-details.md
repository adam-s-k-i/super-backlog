---
id: TASK-75
title: >-
  GitHub Pages redesign: user-centric landing with dashboard look, copyable
  commands, hover details
status: To Do
assignee: []
created_date: '2026-08-30 17:50'
labels:
  - feature
  - docs
  - ux
  - phase/spec
dependencies: []
references:
  - design-demos/pages-landing-prototype.html
type: feature
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Redesign the VitePress docs site UX/UI in the Project Dashboard look and feel: landing page with prominent step-by-step install/run/dashboard box (copyable commands), command grid with copy buttons, explanations as hover tooltips or details modals, parameter tooltips with full copyable command, version display, subtle interactive animations; static dashboard.html on Pages shows a hint that the Backlog button needs a local hub. Prototype approval required before implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prototype approved by user before implementation
- [ ] #2 Landing page: framed step box (step 1..n, copyable), all-commands codeblock below, version visible
- [ ] #3 Command grid: big styled copyable commands; details on hover tooltip or modal; parameter tooltips carry the full copyable command
- [ ] #4 Dashboard look and feel (tokens, fonts, cards) via VitePress theme customization
- [ ] #5 Static dashboard on Pages shows hint that Backlog button needs sbl dashboard (local hub) - only in the hosted variant
- [ ] #6 Subtle animations only (hover lift, copy feedback); full suite + lint green
<!-- AC:END -->
