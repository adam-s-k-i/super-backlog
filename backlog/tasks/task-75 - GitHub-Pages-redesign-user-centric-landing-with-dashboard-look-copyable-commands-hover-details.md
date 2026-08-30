---
id: TASK-75
title: >-
  GitHub Pages redesign: user-centric landing with dashboard look, copyable
  commands, hover details
status: Done
assignee: []
created_date: '2026-08-30 17:50'
updated_date: '2026-08-30 18:35'
labels:
  - feature
  - docs
  - ux
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
- [x] #1 Prototype approved by user before implementation
- [x] #2 Landing page: framed step box (step 1..n, copyable), all-commands codeblock below, version visible
- [x] #3 Command grid: big styled copyable commands; details on hover tooltip or modal; parameter tooltips carry the full copyable command
- [x] #4 Dashboard look and feel (tokens, fonts, cards) via VitePress theme customization
- [x] #5 Static dashboard on Pages shows hint that Backlog button needs sbl dashboard (local hub) - only in the hosted variant
- [x] #6 Subtle animations only (hover lift, copy feedback); full suite + lint green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: vitepress build green after fixing rollup absolute-img + markdown 4-space indents (dedented block starts); landing screenshot from vitepress preview verified (logo full-width, command grid, steps frame, codeblock, hosted note). Dashboard hint present in template + public copy + built dist (rg 1 match each). Full suite 64 files / 544 passed; lint OK (MD033 allow-list extended for landing markup). Theme: custom.css maps dashboard tokens (light+dark) + fonts to VitePress vars.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Landing rebuilt user-centric in dashboard look: full-width logo hero, copyable command grid with hover tooltips and details modals, framed 3-step start box, all-commands block, npm version chip, hosted-dashboard explanation; whole docs themed with cockpit tokens; static dashboard warns that the Backlog button needs a local hub. Verified by vitepress build, preview screenshot, suite, and lint.
<!-- SECTION:FINAL_SUMMARY:END -->
