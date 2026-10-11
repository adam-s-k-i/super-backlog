---
id: TASK-114
title: 'Router v2: managed-block examples rendered from the configuration'
status: Done
assignee: []
created_date: '2026-10-11 00:17'
updated_date: '2026-10-11 01:13'
labels:
  - feature
  - phase/verify
dependencies:
  - TASK-113
references:
  - docs/superpowers/plans/2026-10-11-router-v2.md
type: feature
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 4: {{MODEL_EXAMPLES}} placeholder, renderModelExamples, agentsBlockContents(version, cwd), planner order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 default rendering stays byte-identical to the current example paragraph
- [x] #2 enabled rendering lists configured tiers and wraps at 80 columns
- [x] #3 install-model-router is planned before inject-agents-block
<!-- AC:END -->
