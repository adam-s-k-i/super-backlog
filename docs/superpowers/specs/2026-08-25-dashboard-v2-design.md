# Dashboard v2 — Project Cockpit Design Spec

- **Date:** 2026-08-25
- **Status:** Approved (blanket delegation: human partner approved all remaining decisions in chat, "folge im Zweifel deinen eigenen Empfehlungen", 2026-08-25 late evening)
- **Scope:** v2 of the Project Dashboard (`sbl dashboard` output), freshness automation, HTS-style design
- **Supersedes:** dashboard sections of 2026-08-25-super-backlog-kit-design.md (§5.4); kit otherwise unchanged

## 1. Problem & Goal

The v1 dashboard is functional but generic: plain table + cards, no diagrams,
no domain tooltips, and it goes stale the moment tasks change. Goal: a
project cockpit in the visual language of the HTS cheat-sheet
(hedgefond-trading-system/hts-cheatsheet.html) that lets a user grasp a
project in seconds, stays current automatically, and explains its own domain
vocabulary on hover.

## 2. Decisions (chat-approved)

| # | Decision |
|---|---|
| D1 | Freshness: marker-scoped **git post-commit hook** regenerates `dashboard.html` when a commit touches `backlog/**`; plus existing triggers (init, update, serve watcher, manual) |
| D2 | Content: **7 sections** — Identity/Quick-Actions, Status overview, Milestones, Tasks (interactive), Feature-cycle stepper, Activity timeline, Decisions/Docs + Glossary hint |
| D3 | Diagrams: **Kern-Set + dependency graph** — status donut, milestone bars, 30-day activity sparkline, workflow stepper (SVG, vanilla), layered dependency graph |
| D4 | Tooltips: built-in glossary (~15 terms) **plus project extension** via `backlog/docs/glossary.md` convention (`## Term` heading + following paragraph) |
| D5 | Architecture: **vanilla, zero-dep single file** (approach A); hand-rolled SVG, own tooltip engine; no chart libs |
| D6 | Design system: HTS tokens (dark `#0a0e16`, surface `#111826`, accent `#5cc8ff`, ok/warn/danger + tints, Cascadia/Consolas mono, Segoe UI), fixed left sidebar, numbered `sec-head` sections. **Dark-only** — the light scheme of v1 is dropped deliberately for design integrity |
| D7 | Hook is default-on with `init`, opt-out via `--no-refresh-hook`; composes with the guard hook via separate marker blocks; **never blocks a commit** |

## 3. Architecture & Freshness

Regeneration triggers:

| Trigger | Mechanism |
|---|---|
| `sbl init` | generates dashboard (new design) unless `--no-dashboard` |
| **post-commit hook** (new) | commit touches `backlog/**` → silent regeneration; failure = stderr note only, commit always succeeds |
| `sbl update` | refreshes templates + regenerates |
| `sbl dashboard --serve` | existing fs.watch live reload |
| `sbl dashboard` | manual |

Hook mechanics: marker block `# >>> super-backlog dashboard-refresh <version> >>>` …
`# <<< super-backlog dashboard-refresh <<<` appended/replaced in `.git/hooks/post-commit`
(same lifecycle code path as the guard: install-or-replace, remove-on-uninstall,
foreign content preserved). Hook body: POSIX sh + node, resolves the local
package via `node_modules/super-backlog/dist/dashboard/regen.js`; exits 0
unconditionally. Staged-diff check: only regenerate when the commit touched
`backlog/**` (cheap `git diff --name-only HEAD~1 HEAD -- backlog/` — after
commit, HEAD~1 is safe for non-initial commits; initial commit regenerates
unconditionally). New flags: `--no-refresh-hook` (init), uninstall removes the
block, `sbl update` refreshes it.

`dist/dashboard/regen.js` is a tiny entry: collect → render → atomic write;
all errors swallowed to stderr, exit 0.

## 4. Data Model & Collector

`DashboardData` v2 (additive):

```ts
deps:     Array<{ from: string; to: string }>
activity: Array<{ date: string; count: number }>   // 30 buckets, oldest → newest
glossary: Array<{ term: string; definition: string }>
```

- **deps** from the task list JSON dependency fields; dangling refs and cycles
  are tolerated (skipped in layering, never fatal).
- **activity**: 30 daily buckets ending today; each task contributes to the
  bucket of `updated_at` (fallback `created_at`, fallback today).
- **glossary**: built-in kit terms first, then project terms from
  `backlog/docs/glossary.md` (`## <Term>` heading, following non-heading block
  = definition) override/extend by term (case-insensitive). Missing/corrupt
  file → built-in glossary only.
- Existing graceful-degradation rules unchanged (`source:'fallback-empty'`).

## 5. Layout & Design System

- CSS custom properties lifted from HTS: `--bg #0a0e16`, `--surface #111826`,
  `--line #1e293c`, `--line-strong #2c3b57`, `--text #e8edf6`, `--muted #8fa0ba`,
  `--dim #5d6d88`, `--accent #5cc8ff`, `--ok #3ecf8e`, `--warn #ffb454`,
  `--danger #ff7a7a` (+ bg tints), mono: Cascadia Code/Consolas, prose: Segoe UI.
- **Fixed left sidebar** (~230px): project badge (● name), kicker
  `SUPERPOWERS × BACKLOG.MD`, numbered nav anchors (01–07), live status-count
  pills (click = filter task table). Collapses to a top strip under 900px.
- **Main column** sections with HTS `sec-head` pattern: marker glyph/number,
  H2, right-aligned muted tagline:
  01 Board & Quick Actions (command pills: backlog browser, backlog board,
  `sbl dashboard --serve`) · 02 Status Overview (donut + metric cards) ·
  03 Milestones (progress bars) · 04 Tasks (interactive table) ·
  05 Feature Cycle (stepper 1–7 + Done) · 06 Activity (sparkline + recent
  changes list) · 07 Decisions & Docs (list from `backlog/decisions`,
  `backlog/docs`) + glossary hint.
- Footer: generated-at, kit version, freshness note.

## 6. Interaction & Diagrams

- **Tooltip engine**: one floating element; any element with `data-tip` shows
  it on hover/focus; glossary terms render as dotted-underlined spans with
  `data-term`, definition resolved from the glossary island; smart viewport
  clamping; Esc/blur hides; focusable via `tabindex="0"`.
- **Donut**: SVG stroke-dasharray segments per status, center total; segment
  hover highlights matching table rows.
- **Milestone bars**: done/total with mono counters.
- **Sparkline**: 30-day SVG polyline + area, hover shows date/count.
- **Stepper**: 9 pipeline phases as numbered nodes (done/current styling).
- **Dependency graph**: layered SVG — columns = topological depth (cycle
  members appended to the deepest safe layer), nodes = task chips (id + title,
  status color), arrows for deps; hover highlights in/out-edges; click opens
  the detail panel. Pan/zoom is explicitly out of scope.
- **Detail panel**: right slide-in (like HTS "Klick → Detailpanel"): task
  details, acceptance criteria checkboxes, in/out dependencies (clickable),
  close on Esc/backdrop.
- Table: retained sort/filter; sidebar pills and donut segments act as
  filters; `/` focuses the filter input.

## 7. Error Handling

- Hook: never blocks; regen failures → single stderr line.
- Collector: unchanged never-crash philosophy; new fields degrade to empty.
- Glossary: corrupt project file → built-in only.
- Dep-graph: cycles/dangling tolerated deterministically.

## 8. Testing

- Unit: collector deps/activity/glossary (merge + override + corrupt file),
  hook render/install/remove/preserve, layering function (incl. cycle case).
- Snapshot: full-file snapshot updated to v2 layout (wholesale rewrite).
- Integration/e2e: init installs post-commit block; commit touching `backlog/**`
  in a temp repo regenerates dashboard.html; commit touching nothing relevant
  does not; `--no-refresh-hook` skips; uninstall removes block, keeps foreign
  content; serve test unchanged.
- Template JS budget test updated to the new cap (≤650 lines).

## 9. Out of Scope

Pan/zoom on the graph, light theme, CI-side regeneration, per-project
landscape diagrams (potential v3), localization.
