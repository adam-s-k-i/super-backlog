---
id: TASK-84
title: Document line-ending handling and the manual upgrade from 1.3.2-1.5.0
status: In Progress
assignee: []
created_date: '2026-10-09 18:28'
updated_date: '2026-10-09 18:28'
labels:
  - docs
  - phase/impl
dependencies:
  - TASK-83
references:
  - docs/superpowers/plans/2026-10-09-crlf-managed-writes.md
type: docs
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the final review. Users on 1.3.2-1.5.0 cannot get past the silent sbl update exit (TASK-77) via sbl update itself; the docs must name the one-time manual install. The harness-support table also states that managed writes keep the file's line endings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/guide/troubleshooting.md has a section on the silent sbl update exit in 1.3.2-1.5.0 with the manual npm install -g command and the --no-self alternative
- [ ] #2 docs/guide/harness-support.md states that the AGENTS.md block and the CLAUDE.md pointer are written with the file's line endings
- [ ] #3 npm run lint is clean
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
See docs/superpowers/plans/2026-10-09-crlf-managed-writes.md (Task 2)
<!-- SECTION:PLAN:END -->
