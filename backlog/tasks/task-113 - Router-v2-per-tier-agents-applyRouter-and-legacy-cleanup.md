---
id: TASK-113
title: 'Router v2: per-tier agents, applyRouter and legacy cleanup'
status: Done
assignee: []
created_date: '2026-10-11 00:17'
updated_date: '2026-10-11 01:13'
labels:
  - feature
  - phase/verify
dependencies:
  - TASK-111
references:
  - docs/superpowers/plans/2026-10-11-router-v2.md
type: feature
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 3: sbl-light/standard/strong/top agents for Claude Code and OpenCode, applyRouter, removal of v1 agents, plugin and SessionStart hook, uninstall coverage. Critical area: independent Opus review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 applyRouter writes or updates the eight agent files with concrete models
- [x] #2 legacy v1 files, plugin and sbl SessionStart entries are removed while foreign hooks stay
- [x] #3 update only maintains router-installed harnesses
- [x] #4 uninstall removes v2 and v1 router files
<!-- AC:END -->
