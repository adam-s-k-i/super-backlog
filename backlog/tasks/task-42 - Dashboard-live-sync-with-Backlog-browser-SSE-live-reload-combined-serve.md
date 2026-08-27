---
id: TASK-42
title: Dashboard live-sync with Backlog browser (SSE live-reload + combined serve)
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 21:56'
updated_date: '2026-08-27 22:22'
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
- [x] #1 Dashboard server exposes an SSE endpoint that emits a reload event after each successful debounced regeneration
- [x] #2 Rendered dashboard.html opens an EventSource connection and reloads the page when a reload event arrives; file:// fallback must not break when no server is present
- [x] #3 sbl serve starts the dashboard server and spawns the backlog browser (via resolveBacklogBin); missing backlog binary degrades gracefully with a warning, dashboard still serves
- [x] #4 SSE clients are cleaned up on disconnect and on server close; regeneration failures never kill the server or SSE stream
- [x] #5 Unit/integration tests cover SSE emission after regeneration, client cleanup, and serve command behavior
- [x] #6 README and CLI --help mention the new serve command and live-reload behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. server.ts: SSE endpoint /api/events with client set, emit 'reload' after successful debounced regenerate(); cleanup on disconnect/close. 2. render.ts: inline EventSource script that reloads on event, guarded so file:// usage without server does not error. 3. cli.ts + new commands/serve.ts: 'sbl serve [--port N] [--no-open]' starts dashboard server and spawns backlog browser via resolveBacklogBin; missing binary -> warning, dashboard still serves. 4. Tests first (vitest): SSE emission after regen, client cleanup, serve command graceful degradation. 5. Update README + CLI help. 6. Full test suite + lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: refactored server.ts to expose createReloadBroker() and createDebouncedReloader(). startServeServer wires the broker to /api/events and triggers reload broadcast after successful regeneration. Added EventSource client snippet to dashboard.html guarded by location.protocol so file:// stays silent. Added src/commands/serve.ts with sbl serve command that starts the dashboard server and spawns backlog browser --no-open --non-interactive; warns and continues if backlog CLI missing. Updated src/cli.ts help text and README.md. Added test/unit/serve-command.test.ts. Existing server-reload and integration/serve tests now pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented dashboard live-sync: SSE endpoint /api/events emits reload events after successful debounced regeneration; dashboard.html embeds an EventSource client that reloads on reload and stays silent on file://. Added sbl serve command that starts the dashboard server and spawns the Backlog browser, with graceful degradation when the backlog CLI is missing. Updated CLI help and README. Verified with 356 passing tests, build, and lint.
<!-- SECTION:FINAL_SUMMARY:END -->
