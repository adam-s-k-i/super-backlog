---
id: TASK-62
title: 'Spike: theme the Backlog.md browser iframe to match the dashboard'
status: To Do
assignee: []
created_date: '2026-08-29 23:47'
labels:
  - dashboard
dependencies: []
references:
  - docs/superpowers/specs/2026-08-30-dashboard-redesign-v2-design.md
type: spike
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feasibility question, output is a recommendation not code: can the hub proxy the backlog browser under its own origin and inject dashboard CSS tokens reliably (live-reload, absolute paths, version drift of Backlog.md internals), or does Backlog.md offer upstream theming? Cross-origin iframe (own port) makes direct injection impossible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Upstream theming options of Backlog.md checked and documented
- [ ] #2 Proxy + style-injection approach prototyped or ruled out with reasons
- [ ] #3 Recommendation with effort estimate reported; any prototype code labeled throwaway
<!-- AC:END -->
