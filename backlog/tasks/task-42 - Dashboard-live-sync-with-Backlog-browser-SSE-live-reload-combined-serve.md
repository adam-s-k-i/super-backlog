---
id: TASK-42
title: Dashboard live-sync with Backlog browser (SSE live-reload + combined serve)
status: In Progress
assignee:
  - '@adam'
created_date: '2026-08-27 21:56'
updated_date: '2026-08-27 21:57'
labels: []
dependencies: []
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a user edits tasks in the Backlog browser (backlog browser), our project dashboard should update automatically. The backlog.md binary has no hook/event API, but both watch the same source of truth: file changes in backlog/. The dashboard --serve watcher already regenerates dashboard.html on changes, but the open dashboard tab never reloads (no SSE/polling in the HTML). Add an SSE endpoint to the dashboard server that pushes a reload event after each successful regeneration, embed a tiny EventSource client script in the rendered dashboard, and add a combined 'sbl serve' command that starts the dashboard server and the Backlog browser together.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dashboard server exposes an SSE endpoint that emits a reload event after each successful debounced regeneration
- [ ] #2 Rendered dashboard.html opens an EventSource connection and reloads the page when a reload event arrives; file:// fallback must not break when no server is present
- [ ] #3 sbl serve starts the dashboard server and spawns the backlog browser (via resolveBacklogBin); missing backlog binary degrades gracefully with a warning, dashboard still serves
- [ ] #4 SSE clients are cleaned up on disconnect and on server close; regeneration failures never kill the server or SSE stream
- [ ] #5 Unit/integration tests cover SSE emission after regeneration, client cleanup, and serve command behavior
- [ ] #6 README and CLI --help mention the new serve command and live-reload behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. server.ts: SSE endpoint /api/events with client set, emit 'reload' after successful debounced regenerate(); cleanup on disconnect/close. 2. render.ts: inline EventSource script that reloads on event, guarded so file:// usage without server does not error. 3. cli.ts + new commands/serve.ts: 'sbl serve [--port N] [--no-open]' starts dashboard server and spawns backlog browser via resolveBacklogBin; missing binary -> warning, dashboard still serves. 4. Tests first (vitest): SSE emission after regen, client cleanup, serve command graceful degradation. 5. Update README + CLI help. 6. Full test suite + lint.
<!-- SECTION:PLAN:END -->
