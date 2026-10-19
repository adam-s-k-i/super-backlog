---
id: TASK-124
title: Fix the blank embedded Backlog browser in the dashboard
status: To Do
assignee: []
created_date: '2026-10-19 17:33'
updated_date: '2026-10-19 18:12'
labels:
  - fix
  - phase/impl
dependencies: []
references:
  - docs/superpowers/plans/2026-10-19-fewer-interruptions.md
type: bug
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
backlog browser's SPA router sees /p/<slug>/bb/ and renders nothing ('No routes matched'); its websocket is not proxied. bb/ sets the routing cookie and redirects to /, / proxies by cookie, HTTP upgrades are piped to the browser process. Plan task 5.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /p/<slug>/bb/ answers 302 to / with the sbl_bb cookie
- [ ] #2 GET / with a valid sbl_bb cookie proxies the browser root; without a cookie it still serves the hub index
- [ ] #3 Websocket upgrades with the cookie reach the browser process (unit test with a fake upstream)
- [ ] #4 Manual check: the Backlog overlay in sbl dashboard renders the board with no router or websocket console errors
<!-- AC:END -->
