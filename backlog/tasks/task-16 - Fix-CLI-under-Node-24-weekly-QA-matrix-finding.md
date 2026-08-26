---
id: TASK-16
title: Fix CLI under Node 24 (weekly QA matrix finding)
status: To Do
assignee: []
created_date: '2026-08-26 04:36'
labels:
  - ci
  - qa
dependencies: []
references:
  - 'https://github.com/adam-s-k-i/super-backlog/actions/runs/32930705248'
type: bug
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Weekly QA run 32930705248 (windows-latest, Node 24) fails during npm test with the kit error message: package.json is not valid JSON - fix it manually, then re-run. Something in the init/e2e path parses JSON differently under Node 24. Re-enable Node 24 in qa-weekly.yml matrix once fixed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 npm test passes on Node 24 locally or via CI matrix leg
- [ ] #2 qa-weekly.yml matrix includes Node 24 again
- [ ] #3 Root cause documented in task notes
<!-- AC:END -->
