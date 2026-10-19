---
id: TASK-125
title: Bump dependencies and release 1.10.3
status: To Do
assignee: []
created_date: '2026-10-19 17:33'
updated_date: '2026-10-19 17:36'
labels:
  - chore
  - phase/spec
dependencies:
  - TASK-121
  - TASK-122
  - TASK-123
  - TASK-124
  - TASK-126
references:
  - docs/superpowers/plans/2026-10-19-fewer-interruptions.md
type: chore
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
backlog.md 1.54.0, cspell 10.4.0, vitest 5.0.5, happy-dom 21.0.3 (fall back to latest 20.x if tests break); PR with Release-As: 1.10.3 and automerge. Plan tasks 6-7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 npm outdated lists nothing for these four packages; npm test and npm run lint pass
- [ ] #2 PR merged with Release-As: 1.10.3; release-please tags v1.10.3 and npm publishes it
<!-- AC:END -->
