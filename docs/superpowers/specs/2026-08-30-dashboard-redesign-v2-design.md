# Dashboard Redesign v2 — Design Spec

- **Date:** 2026-08-30
- **Status:** Approved (chat design gate)
- **Scope:** `src/templates/dashboard.html` and `src/dashboard/data.ts` only; no CLI
  behavior change, no new HTTP endpoints

## Problem

The dashboard (v1.3.0) has grown feature by feature and shows it: drafts are a
bare text list buried in section 01, the Status section is a single donut, the
Activity section a minimal sparkline, the tasks table sorts `task-10` before
`task-2` and prints raw timestamps, the model-router entry is an easy-to-miss
sidebar text link, the typeface silently falls back to Segoe UI (the `@font-face`
blocks only reference `local('Inter')`), and the UI is dark-only.

## Decisions

### Structure

| # | Decision | Choice |
|---|---|---|
| S1 | Section order | 01 Board & Quick Actions · 02 Status · 03 Feature Cycle · 04 Milestones · 05 Drafts · 06 Tasks · 07 Activity · 08 Decisions & Docs. Sidebar nav, `sec-*` ids, and `sec-num` labels renumbered to match. |
| S2 | Model router entry | The sidebar text link (`#models-btn`, `.side-models`) is replaced by a full `cmd-btn` next to the Backlog button in section 01 (title "Model Router", cmd-line "workhorse · budget · tiers"). It opens the existing `#models-dialog`; modal behavior unchanged. |
| S3 | Drafts placement | The drafts block moves out of section 01 into the new section 05 with its own `sec-head` (tagline: "ideas before they enter the backlog"). |

### Drafts (section 05)

| # | Decision | Choice |
|---|---|---|
| D1 | List UI | Drafts render as clickable cards styled like `flow-card` (id in mono, title, status chip via `toneOf`). Click opens a modal. |
| D2 | Detail modal | Same layout as the task dialog: id, status chip, title, description, meta row (priority, assignee, created/updated when present), AC checklist when present. Reuses the `#task-dialog` element and `openDetail` patterns (a shared `openDoc(kind, id)` or a sibling `openDraftDetail`; implementation may unify). |
| D3 | Data model | `readDraftFile` is extended the way tasks were enriched in PR #53: parse `SECTION:DESCRIPTION` / AC marker blocks plus `priority`, `assignee`, `created`, `updated` simple keys. `DashboardDraft` gains those optional fields; `id`/`title`/`status` stay required. Empty state ("No drafts.") unchanged. |

### Status (section 02)

| # | Decision | Choice |
|---|---|---|
| K1 | KPI tiles | A row of four stat tiles above the donut: **Progress & forecast**, **Velocity**, **WIP & blocked**, **Age**. Numbers in mono, caption + trend line per tile. |
| K2 | Metric definitions | No status history exists, so all metrics are declared approximations over `created`/`updated`: velocity = done tasks with `updated` in the last 7 days (delta vs. the 7 days before); forecast = open tasks ÷ velocity → projected date, hidden when velocity is 0; WIP = status contains "progress"/"review"; blocked = unresolved deps (existing `isDoneStatus` walk) or status contains "block"; age = days since `created` (fallback `updated`). Each tile carries a `data-tip` explaining the approximation. |
| K3 | Aging chart | New SVG strip below the donut: one lane per non-done status, one dot per open task positioned by age in days; dots ≥ 14 days get the warn tone; hover shows id + title + age, click opens the task modal. |
| K4 | Interactivity | Donut stays as is. WIP and blocked tiles act as status filters for the tasks table (same mechanism as the sidebar pills). |
| K5 | Task mapping | `DashboardTask` gains optional `created` (from `createdAt` / `created_at` / `created`). |

### Activity (section 07)

| # | Decision | Choice |
|---|---|---|
| A1 | Heatmap | The 30-day sparkline is replaced by a calendar heatmap: 26 weeks × 7 weekdays, GitHub style, intensity on an accent scale computed from tasks touched per day (`updated`, fallback `created`). Hover: date + count; click: a side panel lists that day's tasks, each opening the task modal. |
| A2 | KPI strip | Above the heatmap: 30-day total, average per week, most active weekday, current streak (consecutive days with activity, counting back from today). |
| A3 | Data | `computeActivity` range extends to 182 days and buckets carry the touched task ids (`{ date, count, ids }`); the existing 30-day consumers derive from the same data. Empty state ("No activity data.") unchanged. |

### Tasks table (section 06)

| # | Decision | Choice |
|---|---|---|
| T1 | Natural sort | The sort comparator becomes field-aware: string fields use `localeCompare(a, b, undefined, { numeric: true })` (→ task-1, task-2, …, task-10); `updated` compares raw ISO timestamps. Default sort stays id ascending. |
| T2 | Status badges | The status cell renders a `status-chip` with `toneOf(status)` — identical to the chip in the task modal — instead of plain text. Sorting/filtering still uses the raw status string. |
| T3 | Updated column | Center-aligned. Shows relative time in the browser locale via `Intl.RelativeTimeFormat` ("vor 2 Std.", "gestern"); the exact date+time in the user's timezone via `Intl.DateTimeFormat` goes into the cell's `data-tip` tooltip. Unparsable values fall back to the raw string. |

### Typography

| # | Decision | Choice |
|---|---|---|
| Y1 | System | Chosen from the 20-variant study: **Jakarta Friendly** — Plus Jakarta Sans for UI/body (headings 700), JetBrains Mono for ids, numbers, pills, captions, and `sec-num`. |
| Y2 | Loading | One Google Fonts stylesheet link with `display=swap`; fallback stacks `"Segoe UI", system-ui, sans-serif` and `Consolas, monospace`. Offline, the dashboard renders on the fallbacks. The `local('Inter')` `@font-face` blocks are removed. |

### Light theme

| # | Decision | Choice |
|---|---|---|
| L1 | Tokenization | Every hardcoded color in the template (chip borders/backgrounds like `#2b5642`/`#10202e`, spark/glow `rgba(...)`, backdrop, gradients) moves into CSS custom properties; component rules reference tokens only. |
| L2 | Light palette | Derived from the same hues (blue accent, green/amber/red semantics) on a light ground; accent darkened for contrast. Every text/background pair meets WCAG AA 4.5:1 in both themes. |
| L3 | Toggle | An icon button (sun/moon, `aria-label`, visible focus state) in the sidebar under the brand row toggles dark ↔ light. |
| L4 | Default & persistence | Default follows `prefers-color-scheme` (dark when unknown). An explicit choice is stored in `localStorage['sbl-theme']` and applied as `data-theme` on `<html>` by a tiny inline script before first paint (no flash). Storage access is wrapped in try/catch. |
| L5 | Charts | All SVG rendering (donut, bars, aging strip, heatmap, stepper) consumes tokens only and stays legible in both themes; the heatmap intensity scale is defined per theme. |

## Out of scope

- Any write operation on backlog data — drafts and tasks remain a read-only mirror.
- Status-history tracking; K2's metrics stay declared approximations.
- CLI changes, hub routing changes, or new HTTP endpoints.
- A responsive redesign: new elements must fit the existing < 900px single-column
  behavior, nothing more.

## Testing

- **Unit (data):** draft marker-block parsing; `created` mapping; extended
  activity buckets with ids; KPI computations (velocity windows, forecast
  hidden at velocity 0, blocked via deps and via status, age fallback) with a
  fixed `today`; streak/weekday aggregation.
- **Unit (template JS, via render tests):** field-aware comparator (task-2 <
  task-10; updated sorts chronologically); relative-time formatter falls back
  on unparsable input.
- **Render/snapshot:** new section order and numbering, model-router `cmd-btn`,
  drafts cards + modal markup, KPI tiles, aging strip and heatmap mounts,
  status chips in table rows, theme toggle markup; snapshots regenerated.
- **Theme guard:** a test scans the template's CSS for raw hex/rgba outside the
  token blocks so new hardcoded colors fail CI.
- **Manual:** `sbl dashboard` — toggle persists across reload, system default
  respected, fonts degrade gracefully offline, heatmap/day panel interaction.
