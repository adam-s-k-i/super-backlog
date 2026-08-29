# Dashboard Model-Router Modal — Design Spec

- **Date:** 2026-08-29
- **Status:** Approved (chat design gate, TASK-49)
- **Scope:** Dashboard UI for the model router; two new write endpoints

## Problem

Configuring the model router requires terminal commands (`sbl models
enable|disable|discover`, `sbl init --models`). The dashboard can only read
the config (`GET /api/models`, `POST /api/models/discover`).

## Decisions

| # | Decision | Choice |
|---|---|---|
| M1 | Write surface | `POST /p/<slug>/api/models/enable` and `.../disable` call `writeRouterConfig(cwd, bool)` and return `{ ok: true, config }`. |
| M2 | Install | NOT exposed as an API. `sbl init --models` copies adapter files into the repo; the modal shows it as a copyable command instead of re-implementing the installer in the browser. |
| M3 | Installed signal | `GET /api/models` additionally returns `installed: boolean` — whether `.super-backlog/models.json` exists (config load alone always yields defaults). |
| M4 | UI entry | A "Models" trigger in the sidebar next to the version line opens a centered modal (existing dialog patterns). |
| M5 | Modal content | Status line (installed / enabled), Enable/Disable action with button feedback, Discover action showing the ranked workhorse/budget tiers, and — when not installed — the copyable `sbl init --models` hint. |
| M6 | Guards | The endpoints inherit the hub's Host allow-list (403) and JSON content-type (415) guards; localhost-only like every write API. |
| M7 | Errors | `{ ok: false, message }` with appropriate status; the UI surfaces failures via the shared feedback pattern. |

## Out of scope

- Editing tiers/families/mode by hand in the UI (discover + config file cover it)
- Running `sbl init --models` from the browser
- Any change to CLI behavior

## Testing

- Endpoint tests against a temp cwd: enable creates/updates `.super-backlog/models.json` with `enabled: true`; disable flips it; response carries the new config; `installed` flag reflects file existence.
- Hub-scoped route test: `POST /p/<slug>/api/models/enable` operates on the registered project's cwd.
- Render tests: sidebar trigger, modal markup, fetch wiring to the relative endpoints, discover result rendering markers.
- Docs: quickstart model-router section mentions the dashboard modal.
