# Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Project Dashboard as an HTS-style interactive cockpit (7 sections, SVG diagrams, dependency graph, glossary tooltips, detail panel) and keep it permanently fresh via a marker-scoped post-commit hook.

**Architecture:** Collector v2 extends `DashboardData` (deps/activity/glossary, graceful degradation unchanged). Renderer emits one self-contained dark HTML file using HTS design tokens. Freshness: `dist/dashboard/regen.js` entry + post-commit hook block installed by init/update, composing with the guard hook.

**Tech Stack:** unchanged — zero runtime deps, TypeScript ESM, Vitest, vanilla SVG/JS in template.

**Spec:** `docs/superpowers/specs/2026-08-25-dashboard-v2-design.md`
**Design reference (visual source of truth for markup/styling):** `.superpowers/sdd/2026-08-26-dashboard-v2/design-reference.html` (HTS cheat-sheet copy; read it before writing template code)

## Global Constraints

- Zero runtime dependencies; dark-only design (D6); no external URLs in output.
- Hook NEVER blocks a commit (exit 0 always, stderr note on failure).
- Marker blocks: `# >>> super-backlog dashboard-refresh <version> >>>` … `# <<< super-backlog dashboard-refresh <<<`.
- New flag `--no-refresh-hook` on init; uninstall removes the block; update refreshes it.
- Glossary: built-in terms overridden case-insensitively by `backlog/docs/glossary.md` (`## Term` heading + following block).
- Dep-graph tolerates cycles and dangling refs deterministically (append cycle members to deepest safe layer).
- All existing tests keep passing except the template snapshot + JS-budget cap (updated deliberately: new cap ≤650 template JS lines).

---

### Task 1: Collector v2 — deps, activity, glossary

**Files:**
- Modify: `src/dashboard/data.ts` (extend `DashboardData`, add collectors)
- Test: `test/unit/dashboard-data.test.ts` (extend)

**Interfaces:**
- Produces (added to `DashboardData`):
  - `deps: Array<{ from: string; to: string }>`
  - `activity: Array<{ date: string; count: number }>` (30 buckets oldest→newest, ISO `YYYY-MM-DD`)
  - `glossary: Array<{ term: string; definition: string }>`

- [ ] **Step 1: Failing tests** — extend `test/unit/dashboard-data.test.ts`:
  - deps parsed from fixture tasks (`dependsOn`/`deps` array-of-ids field tolerated; unknown shapes → `[]`); dangling `to` ids are kept (graph filters later) but malformed entries dropped.
  - activity: fixture tasks with `updated_at`/`created_at` across known dates → 30 buckets ending "today" (inject `today` via options param `collectDashboardData(cwd, { kitVersion, today?: string })`, default real now); task with both missing counts into today's bucket; counts summed per day; result length always 30, oldest first.
  - glossary: built-in terms present (e.g. `AC`, `DoD`, `Milestone`, `Review Gate`, `TDD`); project file `backlog/docs/glossary.md` with `## AC` + paragraph overrides built-in `AC` case-insensitively and adds new terms; corrupt/missing file → built-in only; heading without following text → skipped.
- [ ] **Step 2:** RED → implement (bucketing: `Date`-math on ISO strings, UTC; glossary parse: split headings, trim, skip empties) → GREEN.
- [ ] **Step 3:** Commit `feat(dashboard): collector v2 - deps, activity, glossary (TASK-15)`.

### Task 2: Design tokens + v2 layout skeleton

**Files:**
- Rewrite: `src/templates/dashboard.html` (full v2 markup/CSS; port JS in Tasks 3–5)
- Modify: `src/dashboard/render.ts` (section scaffolding, new data islands)
- Test: `test/unit/dashboard-render.test.ts` (replace snapshot + structural asserts)

**Interfaces:**
- Consumes: `DashboardData` v2, `KIT_VERSION`.
- Produces: HTML with required structure (asserted): `<aside class="sbl-side">` (badge `● <name>`, kicker `SUPERPOWERS × BACKLOG.MD`, nav anchors `#sec-01…#sec-07`, status pills `.pill[data-status]` with counts), main sections `sec-01`…`sec-07` each with `.sec-head` (`.sec-num`, `h2`, `.tagline`), footer with generated-at + kit version + freshness note. CSS custom properties exactly: `--bg:#0a0e16; --surface:#111826; --line:#1e293c; --line-strong:#2c3b57; --text:#e8edf6; --muted:#8fa0ba; --dim:#5d6d88; --accent:#5cc8ff; --ok:#3ecf8e; --warn:#ffb454; --danger:#ff7a7a;` plus `--ok-bg/--warn-bg/--danger-bg/--accent-dim` tints; fonts Cascadia Code/Consolas mono + Segoe UI. Media query `@media (max-width:900px)` collapses sidebar to top strip. No `src="http`/`href="http`.

- [ ] **Step 1:** Rewrite structural tests (section ids 01–07 present, tokens present verbatim, sidebar elements, no external URLs, dark-only: no `prefers-color-scheme` block) → RED.
- [ ] **Step 2:** Rebuild template skeleton + render.ts section emission (data islands: `sbl-data` as before + `sbl-glossary`) → GREEN; update snapshot file.
- [ ] **Step 3:** Commit `feat(dashboard): v2 layout skeleton in HTS design language (TASK-15)`.

### Task 3: Diagrams — donut, milestone bars, sparkline, stepper

**Files:**
- Modify: `src/templates/dashboard.html` (client JS renders SVG into section mounts)
- Modify: `src/dashboard/render.ts` (emit `PIPELINE_PHASES` island for stepper)
- Test: `test/unit/dashboard-render.test.ts` (extend asserts)

**Interfaces:**
- Client JS functions (global, tested via structural asserts + snapshot): `renderDonut(mount, statuses)`, `renderBars(mount, milestones)`, `renderSparkline(mount, activity)`, `renderStepper(mount, phases)` — each pure-DOM SVG builders using `document.createElementNS`.
- Donut: stroke-dasharray circle segments, center total (mono 2rem); segment hover → `highlight-status` event filtering table rows.
- Sparkline: polyline + area over 30 buckets; `<title>` per point with `YYYY-MM-DD: n`.

- [ ] **Step 1:** Structural asserts: functions exist, mounts `#donut`, `#bars`, `#spark`, `#stepper` present, JS budget cap raised to ≤650 lines (update old cap test) → RED.
- [ ] **Step 2:** Implement → GREEN (snapshot update).
- [ ] **Step 3:** Commit `feat(dashboard): svg donut, bars, sparkline, stepper (TASK-15)`.

### Task 4: Dependency graph

**Files:**
- Modify: `src/templates/dashboard.html`
- Create: `src/dashboard/layering.ts` (pure, unit-tested)
- Test: `test/unit/layering.test.ts` (new), render asserts

**Interfaces:**
- `assignLayers(nodes: string[], deps: Array<{from,to}>): Map<string, number>` — depth = 1 + max(depth of prerequisites), cycle members appended to deepest safe layer (iterative fixpoint, deterministic order = input node order).
- Client `renderDepGraph(mount, tasks, deps)`: columns per layer, task chips (`<g class="node" data-id>` status-colored), SVG arrows `from→to`; hover on chip adds `.hot` to chip + connected edges; click → `openDetail(id)`.

- [ ] **Step 1:** Failing layering tests: linear chain, diamond, cycle `A→B→C→A` (all get finite layers, no crash), dangling `to` ignored → RED.
- [ ] **Step 2:** Implement layering + graph renderer; structural asserts (functions, `#depgraph` mount, `.node`/`.edge` classes) → GREEN.
- [ ] **Step 3:** Commit `feat(dashboard): layered dependency graph with hover/click (TASK-15)`.

### Task 5: Tooltips, glossary, detail panel, filter wiring

**Files:**
- Modify: `src/templates/dashboard.html`
- Modify: `src/dashboard/render.ts` (glossary island)
- Test: render asserts

**Interfaces:**
- Single floating `#sbl-tip` element; delegation on `[data-tip]` (hover+focus) and `[data-term]` (definition from `sbl-glossary` island, case-insensitive); viewport clamping; Esc/blur hides.
- Glossary terms in static section texts wrapped as `<span class="term" data-term="…">`.
- `openDetail(id)`/`closeDetail()`: right slide-in `#sbl-detail` with title, status, ACs (checkbox states), in/out deps clickable; backdrop click + Esc close.
- Sidebar pills + donut segments set table filter; `/` focuses `#taskfilter`.

- [ ] **Step 1:** Structural asserts (`#sbl-tip`, `#sbl-detail`, delegation strings `data-term`, `openDetail`, keyboard Esc handler, `/` handler) → RED.
- [ ] **Step 2:** Implement → GREEN.
- [ ] **Step 3:** Commit `feat(dashboard): glossary tooltips, detail panel, filter wiring (TASK-15)`.

### Task 6: Freshness hook + regen entry + CLI flag

**Files:**
- Create: `src/dashboard/regen.ts` (compiled `dist/dashboard/regen.js`): `collectDashboardData(cwd) → renderDashboard → atomicWrite(dashboard.html)`; all errors → `console.error`, `process.exit(0)`.
- Create: `src/templates/dashboard-refresh-hook.sh` (marker block; POSIX sh; runs `git diff --name-only HEAD~1 HEAD -- backlog/ 2>/dev/null | head -n1` non-empty → `node "$root/node_modules/super-backlog/dist/dashboard/regen.js" || true`; initial-commit safe: if `git rev-parse --verify HEAD~1` fails → regenerate).
- Modify: `src/lib/hooks.ts` (generic block install/remove for a second hook kind — refactor shared helper, keep guard behavior byte-identical)
- Modify: `src/commands/dashboard.ts`/`init.ts`/planner+executor (new action `install-refresh-hook`, flag `--no-refresh-hook` default false)
- Modify: `src/commands/uninstall.ts` (remove refresh block)
- Test: `test/unit/hooks.test.ts` (extend), `test/unit/planner.test.ts` (flag), `test/e2e/hook-regen.e2e.test.ts` (new)

**Interfaces:**
- `installRefreshHook(gitDir, version)` / `removeRefreshHook(gitDir): boolean` mirroring guard semantics (preserve foreign content, replace own block).
- e2e: temp repo → init → write `backlog/tasks/TASK-99.md` via CLI-free file write + `git add`+`git commit` → assert `dashboard.html` mtime/content changed and includes task title; commit touching only `README.md` → unchanged; `--no-refresh-hook` init → no block in post-commit; uninstall removes block, foreign post-commit content preserved.

- [ ] **Step 1:** Failing tests (hook unit + planner flag + e2e) → RED.
- [ ] **Step 2:** Implement → GREEN; full suite.
- [ ] **Step 3:** Commit `feat(dashboard): post-commit freshness hook + regen entry (TASK-15)`.

### Task 7: Docs, dogfood, final verification

**Files:**
- Modify: `README.md` (dashboard section: v2 features + freshness hook), `docs/guard.md` (hook coexistence note), `docs/troubleshooting.md` (hook never blocks note)
- Dogfood: run `sbl update` on this repo → new dashboard.html committed

- [ ] **Step 1:** Docs updates; `npm run lint`-compatible markdown.
- [ ] **Step 2:** Full suite + `node dist/cli.js update` on this repo; commit regenerated dashboard.
- [ ] **Step 3:** Commit `docs(dashboard): v2 docs + dogfooded cockpit (TASK-15)`.

---

## Self-Review Notes

- Spec coverage: D1→T6, D2→T2, D3→T3+T4, D4→T1+T5, D5→T2–T5, D6→T2, D7→T6. §7 error handling→T1/T4/T6 tests. §8 testing→each task.
- Interfaces consistent: `DashboardData` v2 fields defined T1, consumed T2–T5; hook helpers mirror guard signatures.
- Forward dependency: T3–T5 client JS grows one template file sequentially — batches ordered, no parallel dispatch on that file.
