# Project Summary Page — Design Spec

- **Date:** 2026-10-09
- **Status:** Approved visual design (prototype `design-demos/project-summary-v5.html`); spec approved 2026-10-09 with all six open questions decided as recommended
- **Scope:** New hub subpage `/p/<slug>/summary/`, curated `backlog/docs/architecture.yml` per project, automatic project facts, a server-side layout engine, a generator skill, docs and dogfood

## Problem

The hub serves one dashboard per project, and that dashboard is about *work*: statuses, KPIs, tasks, activity. Nothing in super-backlog answers the first question a newcomer, a returning maintainer or a reviewer asks: *what is this project, how is it built, and where is the work happening?* Every project is different (this TypeScript CLI, a WordPress plugin plus theme, a static site), so the answer cannot be computed from a task list. It needs a small amount of curated knowledge plus facts the hub can derive on its own.

The feature adds a management summary page per project: a node-link architecture diagram with labelled zones, flows and highlights, plus a profile ("Steckbrief") with key facts, open work, commands and tech stack. An agent produces and refreshes the curated part through a shipped skill; the hub computes the rest.

## Rejected alternatives

Three earlier prototype rounds live in `design-demos/` for reference only. v2 was a plain card grid with no relationships. v3 "Aufriss" drew free-form connection lines between stacked groups and became unreadable as soon as more than a handful of edges existed (lines crossed cards and each other). v4 "Stockwerke" removed the lines and stacked zones as floors; it was tidy but not graphical enough to show how components depend on each other. v5 keeps the lines but constrains them with a grid and an orthogonal router, which is the approved direction.

## Decisions

### Routing and navigation

| # | Decision | Choice |
|---|---|---|
| R1 | Route | `GET /p/<slug>/summary/` serves the summary page; `GET /p/<slug>/summary` redirects 302 to the trailing-slash form, like `/bb`. `index.html` is accepted as an alias, like the dashboard. |
| R2 | Generation | The summary is rendered in the same regenerate step as the dashboard (`generateDashboard` in `hub.ts`, `regenerateInto` in `commands/dashboard.ts`) and written atomically to a sibling temp file: `<dashboard file without .html>.summary.html`. The hub derives that path from `HubProject.file`; `register()` keeps its signature. A failing summary render never blocks the dashboard write; the summary file then carries the error notice (E3). |
| R3 | Serving | Served with `cache-control: no-store` and `text/html; charset=utf-8` by the existing `serveFile`; 404 "summary not generated yet" when the file is missing. The host allowlist applies unchanged. |
| R4 | Summary page chrome | The prototype app bar: brand with project name, tabs **Dashboard** (`../`), **Summary** (current, `aria-current="page"`), **Backlog** (`../bb/`, same tab; the hub starts the Backlog browser on demand), the path crumb and the theme toggle. No project switcher: the hub root `/` already lists projects. |
| R5 | Dashboard link | `dashboard.html` gains a page-tab row directly under the brand row in the sidebar: **Dashboard** (current) and **Summary** (`summary/`). The Backlog quick-action button and its overlay stay as they are. |
| R6 | Live reload | The summary page embeds the dashboard's EventSource snippet with the path `../api/events` (the page lives one level deeper). The existing recursive watcher on `backlog/` already covers `backlog/docs/architecture.yml`; task edits and architecture edits both trigger the debounced regenerate and broadcast `reload`. Manifest changes (`package.json`, tags) are picked up on the next regenerate; they are not watched. The Node 24 + Windows watch limitation applies unchanged. |

### Data sources

| # | Decision | Choice |
|---|---|---|
| D1 | Two sources | **Automatic facts** are computed by the hub at render time in a new `src/dashboard/summary-facts.ts`. **Curated content** comes from `backlog/docs/architecture.yml`, parsed and validated in `src/dashboard/summary-schema.ts`. The page states for every block which source it came from (collapsible "Data source" section, as in the prototype). |
| D2 | Manifests | In order of precedence: `package.json` (name, version, license, `dependencies` count, `scripts`), `composer.json` (name, version, license, `require` minus `php`/`ext-*`, `scripts`), WordPress headers (`style.css` with `Theme Name:` or a root `*.php` with `Plugin Name:`; reads Name, Version, License). The first manifest found supplies name/version/license; dependency counts are summed across the manifests present. |
| D3 | Repository facts | Releases = count of git tags matching `^v?\d` (`git tag --list` via `runCapture`; 0 and "git unavailable" when git fails). CI = number of `.github/workflows/*.yml|yaml`. LOC and test files are counted over `git ls-files -z` (fallback: a directory walk skipping `node_modules`, `vendor`, `dist`, `build`, `.git`) for the dominant language set: `.ts .tsx .js .mjs .cjs` when `package.json` leads, `.php` when `composer.json` or a WordPress header leads. Test files match `*.test.*`, `*.spec.*` or live under `test/`, `tests/`, `__tests__/`. Reading stops after 10 MB and the LOC fact is then shown as `≈`. |
| D4 | Versions | Resolved versions for tech-stack entries come from `package-lock.json` (`packages["node_modules/<name>"].version`) and `composer.lock` (`packages[].version`); both are JSON. Without a lockfile the declared range is shown. |
| D5 | Backlog data | Open work and phases reuse `collectDashboardData` (`tasks`, `phase`, status). Open = not done by the existing `isDone` rule. The summary never calls the Backlog CLI a second time: `renderSummary` receives the `DashboardData` already collected for the dashboard. |
| D6 | Reduced view | Without `architecture.yml` the page renders header facts, open work (all open tasks, unmapped), commands from `scripts` (`npm run <name>` / `pnpm run` / `bun run` by `detectPackageManager`, `composer <name>`), tech stack from manifests grouped **Runtime** / **Development**, and in place of the canvas a notice: "No architecture file yet. Run the `architecture-summary` skill in your agent or create `backlog/docs/architecture.yml` (schema: docs link)." |
| D7 | YAML parsing | No new dependency. `src/lib/yamlmini.ts` gains `parseYamlSubset(text)` for a documented subset: block mappings and sequences with two-space indentation, single-line flow sequences `[a, b]` and flow mappings `{ k: v }` (one level, no nesting), plain/single/double-quoted scalars, integers, booleans, `>` and `\|` block scalars, `#` comments. Inside a flow collection a plain scalar ends at `,`, `}` or `]`, so values containing commas must be quoted there. Rejected: anchors, aliases, tags, multi-documents, nested flow collections, tabs. A parse error reports line and column. Rationale: the file must be hand-editable with comments (JSON is not), the repo's one runtime dependency is a deliberate property, and the subset is ~250 lines with its own tests. The schema is designed so that every value fits the subset. |

### `architecture.yml` schema

Path: `backlog/docs/architecture.yml`. Maximum 256 KB, ≤ 40 nodes, ≤ 120 edges, ≤ 12 flows, ≤ 12 highlights, ≤ 40 stack entries, grid ≤ 8 × 8. Identifiers (`id`, kind keys, flow ids) match `^[a-z][a-z0-9-]{0,31}$`. Color tokens are one of `accent`, `ok`, `warn`, `violet`, `rose`, `muted`, `dim`.

| Key | Type | Rules |
|---|---|---|
| `schema` | int | Required, must be `1`. |
| `pitch` | string | Required, ≤ 400 chars. `**bold**` is the only markup; everything else is escaped. |
| `grid` | `{ cols, rows }` | Required; 2–8 each. |
| `kinds` | map id → `{ label, color, dashed? }` | Optional. Default set: `actor` (muted), `core` (accent), `output` (ok), `optional` (violet), `external` (dim, dashed). A given map replaces the default set (max 6 entries). |
| `zones[]` | `{ label, cols: [c0,c1], rows: [r0,r1] }` | Optional. Inclusive cell ranges inside the grid; zones may not overlap. |
| `nodes[]` | see below | Required, ≥ 2. `id` unique; `label` ≤ 28 chars; `sub` ≤ 32 chars (mono subtitle); `kind` in effective kinds; `cell: [col,row]` inside the grid and unique; `purpose` ≤ 600; `why` ≤ 600; `files[]` ≤ 12 strings; `commands[]` ≤ 6 of `{ run, note? }`, `run` ≤ 200 chars single line. |
| `edges[]` | `{ from, to, label, text? }` | Required, ≥ 1. `from`/`to` are node ids, `from ≠ to`, pair unique; `label` ≤ 24 chars; `text` ≤ 300 (step description in flows). Reads "*from* → *label* → *to*": the source uses, calls or writes the target; the arrowhead sits at the target. |
| `flows[]` | `{ id, label, color?, command?, text?, steps[] }` | Optional. Each step is `from>to` and must name an existing edge; 1–12 steps; `color` defaults to the sequence accent, ok, warn, violet, rose. |
| `highlights[]` | `{ node, title, text }` | Optional. "Besonderheiten". The 1-based list position is the badge number drawn on `node` (a node may carry at most one badge; a second highlight for the same node is a validation error). |
| `stack[]` | `{ name, group, package?, version?, role?, nodes[] }` | Optional. `package` is the manifest/lockfile name used for version resolution (D4); explicit `version` wins; `nodes[]` are node ids. |
| `commands` | map group → `{ run, note? }[]` | Optional. ≤ 6 groups × 8 entries. |
| `tasks` | map task id → node id | Optional. Task ids are compared case-insensitively against the backlog; unknown ids produce a warning and are ignored. |

Validation runs after parsing and collects every problem as `{ path, message, level }` with `level` `error` or `warning`. Errors (unknown kind, bad cell, dangling edge, duplicate id, missing required key, size limits) make the file **invalid**; warnings (unknown task id, dangling stack node, flow referencing a missing edge → that flow is dropped) keep it valid.

Error behavior:

- **E1 File missing:** reduced view (D6), no notice banner.
- **E2 Parse or validation errors:** reduced view plus a notice card above the profile listing the first 20 problems with `path: message` (`nodes[3].cell: outside grid 5x5`). The page always renders; no 500.
- **E3 Unexpected exception while rendering:** the summary file is written with the notice "summary could not be rendered (`<message>`)" and the reduced view; the dashboard file is unaffected.
- **E4 Warnings only:** full view; the warnings appear inside the "Data source" section, plus the layout warnings (L6).

Example for this repository (abridged `purpose`/`why`; the dogfood file carries the full text):

```yaml
schema: 1
pitch: >
  CLI kit that wires **Backlog.md** and **Superpowers** into any project: a binding
  agent pipeline with gates, glue skills, a live dashboard and a verified uninstall.
grid: { cols: 5, rows: 5 }
zones:
  - { label: Entry, cols: [0, 0], rows: [2, 4] }
  - { label: Kit (sbl), cols: [1, 3], rows: [1, 4] }
  - { label: Target project / external, cols: [4, 4], rows: [0, 4] }
nodes:
  - id: dev
    label: Human & agent
    sub: shell · Claude Code
    kind: actor
    cell: [0, 2]
    purpose: Starts every flow; human and agent use the same commands.
    why: One entry for both; what the agent may read is versioned in the repo.
    files: [AGENTS.md, CLAUDE.md]
    commands:
      - { run: sbl init, note: wire a project }
  - id: browser
    label: Browser
    sub: localhost:6428
    kind: actor
    cell: [0, 4]
    purpose: Shows dashboard, summary and the embedded Backlog browser; holds the SSE connection.
    why: The browser is the only UI, nothing to install.
  - id: cli
    label: sbl CLI
    sub: bin.ts · commands/
    kind: core
    cell: [1, 2]
    purpose: Parses arguments, dispatches seven commands, normalises exit codes, runs preflight and self-update.
    why: One global command for every project; five exit codes keep CI and agents unambiguous.
    files: [src/bin.ts, src/cli.ts, src/commands/]
    commands:
      - { run: sbl doctor, note: check the environment }
  - id: planner
    label: Init planner
    sub: init/planner.ts
    kind: core
    cell: [2, 1]
    purpose: Turns detected state plus options into a declarative Action[] without side effects.
    why: Actions are data, so planning is unit-testable and --dry-run is free.
    files: [src/init/planner.ts]
    commands:
      - { run: sbl init --dry-run, note: plan only }
  - id: executor
    label: Executor
    sub: init/execute.ts
    kind: core
    cell: [3, 1]
    purpose: Applies each action atomically; content comes from templates stamped with the kit version.
    why: Degraded situations become warnings or refusals, never silent overwrites.
    files: [src/init/execute.ts, src/lib/atomic.ts, src/templates/]
  - id: ownership
    label: Ownership & uninstall
    sub: lib/ownership.ts
    kind: core
    cell: [2, 2]
    purpose: Decides per artifact whether the kit owns it and removes only what it can prove.
    why: Ambiguity is reported as kept, never changed.
    files: [src/lib/ownership.ts, src/commands/uninstall.ts]
  - id: phase
    label: Phase labels
    sub: lib/phase.ts
    kind: core
    cell: [2, 3]
    purpose: Reads and sets the pipeline label of a task; doctor checks hygiene.
    why: A label instead of a file means every session resumes at the last gate.
    files: [src/lib/phase.ts, src/commands/phase.ts]
  - id: router
    label: Model router
    sub: src/models/ · opt-in
    kind: optional
    cell: [3, 3]
    purpose: Maps cheaper models to simple agents; installed only with --models.
    why: Opt-in keeps the default untouched.
    files: [src/models/]
  - id: hub
    label: Dashboard hub
    sub: dashboard/ · :6428
    kind: output
    cell: [1, 4]
    purpose: One port for many projects; reads tasks via the Backlog CLI, renders HTML, pushes SSE reloads.
    why: No frontend build, no framework, no database.
    files: [src/dashboard/, src/templates/dashboard.html, src/templates/summary.html]
    commands:
      - { run: sbl dashboard, note: start the hub }
  - id: project
    label: Project files
    sub: AGENTS.md · skills
    kind: output
    cell: [4, 1]
    purpose: Everything written into the target project carries an ownership proof.
    why: One workflow block for all harnesses; CLAUDE.md holds only a pointer.
    files: [AGENTS.md, .claude/skills/, .opencode/skill/]
  - id: npm
    label: npm registry
    sub: super-backlog
    kind: external
    cell: [4, 0]
    purpose: Distributes the package and answers the self-update version check.
    why: release-please tags, publish ships; no manual releases.
  - id: backlog
    label: Backlog.md CLI
    sub: backlog/ · tasks
    kind: external
    cell: [4, 4]
    purpose: Owns tasks, milestones and decisions as Markdown; the kit talks to it only through its CLI.
    why: No fork, no vendoring; devDependency on latest.
  - id: superpowers
    label: Superpowers
    sub: methodology skills
    kind: external
    cell: [4, 3]
    purpose: Supplies the agent methodology via plugin entry or marketplace, never as a copy.
    why: The kit owns only the glue (decision D6).
edges:
  - { from: dev, to: cli, label: sbl … }
  - { from: cli, to: npm, label: version check, text: update checks its own version before refreshing. }
  - { from: cli, to: planner, label: plans }
  - { from: planner, to: executor, label: "Action[]", text: The action list is the only interface between planning and writing. }
  - { from: executor, to: project, label: writes }
  - { from: project, to: superpowers, label: plugin entry }
  - { from: cli, to: ownership, label: uninstall }
  - { from: ownership, to: project, label: removes }
  - { from: ownership, to: router, label: cleans up }
  - { from: cli, to: phase, label: phase }
  - { from: phase, to: backlog, label: task edit }
  - { from: cli, to: hub, label: dashboard }
  - { from: hub, to: backlog, label: task list --json }
  - { from: hub, to: browser, label: HTML + SSE }
flows:
  - { id: init, label: sbl init, command: sbl init, steps: [dev>cli, cli>planner, planner>executor, executor>project, project>superpowers] }
  - { id: update, label: sbl update, command: sbl update, color: warn, steps: [dev>cli, cli>npm, cli>planner, planner>executor, executor>project] }
  - { id: dashboard, label: sbl dashboard, command: sbl dashboard, color: ok, steps: [dev>cli, cli>hub, hub>backlog, hub>browser] }
  - { id: uninstall, label: sbl uninstall, command: sbl uninstall, color: rose, steps: [dev>cli, cli>ownership, ownership>project, ownership>router] }
highlights:
  - { node: planner, title: "Plan, then act", text: "Pure planner, atomic executor, --dry-run for free." }
  - { node: project, title: Ownership by marker, text: "Marker, fingerprint or exact default value as proof." }
  - { node: ownership, title: Verified uninstall, text: Removes only proven ownership and reports every decision. }
  - { node: hub, title: Live without a build, text: "One HTML file, SSE reload, many projects on one port." }
stack:
  - { name: TypeScript, package: typescript, group: Runtime, role: "language, tsc build to dist/", nodes: [cli, planner, executor, hub] }
  - { name: cross-spawn, package: cross-spawn, group: Runtime, role: the only runtime dependency, nodes: [executor, cli] }
  - { name: Vitest, package: vitest, group: Quality, role: unit, integration and e2e tests, nodes: [planner, executor, hub] }
  - { name: backlog.md, package: backlog.md, group: Integration, role: "devDependency, task data", nodes: [backlog, hub, phase] }
commands:
  Quick start:
    - { run: sbl init, note: wire a project }
    - { run: sbl dashboard, note: dashboard on :6428 }
  Development:
    - { run: npm test, note: build + Vitest }
    - { run: npm run lint, note: markdownlint + cspell }
tasks:
  TASK-85: hub
```

### Layout engine contract

`src/dashboard/summary-layout.ts`, pure and synchronous, runs on the server at render time. The browser receives finished geometry and only performs cosmetic text fitting (ellipsis inside node boxes) and a label re-placement with measured text widths once web fonts are loaded, using the same candidate slots the server emitted.

| # | Rule | Detail |
|---|---|---|
| L1 | Inputs | Validated nodes (`id`, `cell`), edges (`from`, `to`, `label`), grid size, zones. Constants: node 156 × 56 px, column gap 104, row gap 48, margins 18 / 36 / 20, port spacing 18 px. Label widths are estimated with a per-character width table for Plus Jakarta Sans 12.5 px / 500 (fallback 7 px per char) plus 2 px. |
| L2 | Determinism | Same input → byte-identical output. Node order, edge order and flow order are the YAML order; all sorts use stable comparators with id tie-breaks. No randomness, no DOM. |
| L3 | Routes | Per edge, in this order: straight horizontal (same row, intermediate cells empty) → straight vertical (same column) → `VH` (vertical first, corner cell `[from.col, to.row]` empty, both legs clear) → `HV` (corner `[to.col, from.row]`). "Empty" means no node occupies the cell; zones do not block. Nothing else is tried: a route is straight or a single-corner L. |
| L4 | Ports | Every edge end attaches to one side (T/B/L/R) chosen by the route kind. Ports on one side are sorted by the partner's position (the prototype's key function) so siblings leaving the same side never cross each other; they are spread symmetrically around the side's centre at 18 px spacing. Straight edges reuse the source coordinate on the target so they stay perfectly straight. Corners are drawn with a 7 px quadratic bend. |
| L5 | Labels and badges | Each label is placed on the edge's longest segment by scoring five positions × two sides (above/below for horizontal, left/right for vertical): +5 outside the canvas, +3 overlapping a node, +2 overlapping a placed label, +1 crossing another edge's segment; lowest score wins, ties by candidate order. Edges are processed longest segment first. The flow step badge sits on the line just before the label, moved past it when too close to the segment start. The chosen slot index and the full candidate list are emitted so the browser can re-score with measured widths. |
| L6 | Diagnostics | Output carries `warnings[]`: `route-fallback` (no valid straight/L route; the engine draws the nearest L anyway, straight through whatever is in the way, and the page shows the warning in "Data source"), `label-collision` (best score > 0), `crossing` (two segments of different edges intersect at an interior point). Counts: `crossings`, `collisions`. Fixtures in tests assert both are 0; the engine does not promise 0 for arbitrary input, it reports it so the author (or skill) can move cells. |
| L7 | Canvas | Width = 2·18 + cols·156 + (cols−1)·104; height = 36 + rows·56 + (rows−1)·48 + 20; emitted as the SVG `viewBox`. Zones are drawn as rectangles 12 px around their cell range with the label inside the top-left corner. Nodes are emitted in reading order (row, then column) which is also the tab order. |

### Rendering

| # | Decision | Choice |
|---|---|---|
| V1 | Approach | Same as the dashboard: a static template `src/templates/summary.html` with placeholders (`__PROJECT_NAME__`, `__SUMMARY_NOTICE__`, `__SBL_TOKENS_CSS__`, `__SBL_SUMMARY_JSON__`) filled by `renderSummary(data, summary)` in `src/dashboard/summary-render.ts`; one JSON island with facts, validated content, layout geometry and warnings; inline JS builds the SVG and the panels client-side exactly as the prototype does. No bundler, no framework, no external script. |
| V2 | Shared tokens | The colour token block (`:root` dark, `:root[data-theme="light"]`) moves from `dashboard.html` into `src/templates/sbl-tokens.css`, injected into both templates at render time. It gains `--violet`, `--rose` and their `-bg`/`-line` variants from the prototype (light and dark values). The existing "no raw colors outside token blocks" test covers the tokens file and both templates. |
| V3 | Fonts | The same Google Fonts link as the dashboard (Plus Jakarta Sans 400–800, JetBrains Mono 400–700) with the same fallback stacks. |
| V4 | Page sections | Header (name pill, pitch, six facts: version · license, lines, test files, dependencies, releases, open tasks); canvas card (flow chips, legend, SVG stage, panel); profile row (Highlights, Open work + Commands, Tech stack); collapsible "Data source" (automatic vs curated lists, warnings, the file path). |
| V5 | Interactions | From the prototype, unchanged: click / Enter / Space on a node selects it and fills the panel (purpose, "why built this way", files as chips, connections as buttons that select the neighbour, open work mapped to that node, commands with copy buttons); clicking the selected node or **Esc** clears; hover and focus highlight incident edges; flow chips (`aria-pressed`) dim everything else, number the steps on the lines and list them in the panel with the flow command; tech-stack buttons dim nodes that do not use the entry; highlight numbers in the list select their node and scroll to the panel. The dashed marching animation on hot edges stops under `prefers-reduced-motion`. |
| V6 | Narrow widths | Below 760 px the SVG keeps a `min-width` of 860 px inside a horizontally scrolling stage; the profile row collapses to one column; at 380 px everything remains reachable. |
| V7 | Copy | Copy buttons use `navigator.clipboard.writeText` with the dashboard's feedback pattern ("copied ✓" / toast); the page never executes anything. |

### Accessibility

- Nodes are `<g role="button" tabindex="0" aria-label="<label> (<kind label>)">` in reading order; the panel is `aria-live="polite"`; chips and stack buttons expose `aria-pressed`; the SVG has `role="group"` and an `aria-label` with node and edge counts; the toast is `role="status"`.
- Every piece of information in the diagram exists as text: connections per node in the panel, flows as an ordered list, highlights as a numbered list, kinds in a legend that uses shape (dashed border) as well as colour.
- Visible `:focus-visible` ring on every control (reuse `--focus-ring`); copy and close buttons are at least 24 × 24 px; Esc always returns to the neutral state and blurs the node.
- All text/background pairs come from the token set that already meets WCAG AA in both themes; the two new hues are chosen to meet 4.5:1 on `--surface` in both themes.

### Theming

Default follows `prefers-color-scheme`, the explicit choice is read from and written to `localStorage['sbl-theme']` by the same pre-paint resolver and toggle as the dashboard, so switching on one page switches the other. The prototype's `sbl-summary-theme` key is not used.

### Security

- Every curated string goes through the render `esc()` on the server for the template parts and through the inline `esc()` for client-built markup; the JSON island escapes `<` as today (`jsonIsland`). The only markup transformation is `**bold**` → `<b>` applied *after* escaping the pitch.
- Colours and kinds never reach `style` attributes as raw strings: the client maps the validated token name to `var(--<token>)` through a fixed lookup; anything else falls back to `--line-strong`.
- Node ids, flow ids and edge ids are validated by regex before they become `data-*` attributes.
- Commands are text: rendered in `<code>`, copied on click, never linked, never executed, never passed to the CLI. File entries are chips, not links.
- The YAML parser enforces the 256 KB limit before parsing and the schema enforces count limits, so a hostile file cannot blow up the render or the SVG.
- The hub's host allowlist and `no-store` serving apply unchanged; the summary adds no API endpoint.

### Generator skill

A new glue skill `architecture-summary` ships in `src/templates/skill-architecture-summary.md`, joins `GLUE_SKILLS`, is copied to `.claude/skills/` and `.opencode/skill/` with the fingerprint line, and is listed in the uninstall paths. Procedure: read manifests, directory layout and tests; read existing `architecture.yml` if present and keep curated prose unless the code contradicts it; propose nodes (6–14), zones, edges, 3–5 flows and 4–6 highlights; write the file; run `sbl doctor` (new check 5: `architecture.yml` parses and validates, reports every problem with path) and fix until clean; present the diff for review. Boundaries: never invent files or commands that do not exist; keep `purpose`/`why` under three sentences; prefer grid positions that yield straight or single-corner routes (the doctor check also prints the layout warnings from L6).

**Decision: in scope**, as the last implementation unit. Without it the curated file is a manual chore and the feature is unlikely to be used; with it the page can be produced for any project in one agent turn. It is independently releasable, so it can slip to the next minor if the schedule demands.

## Data flow

1. `sbl dashboard` (fresh or attached) triggers `regenerate`: `collectDashboardData` → `renderDashboard` → dashboard file; then `collectSummaryFacts(cwd)` + `loadArchitecture(cwd)` → `layoutArchitecture` → `renderSummary` → summary file. Any throw in the summary chain yields E3 and leaves the dashboard untouched.
2. A change under `backlog/` (tasks, `docs/architecture.yml`) fires the watcher → debounced regenerate → `reload` broadcast → both open pages reload.
3. `GET /p/<slug>/summary/` serves the file; the inline JS reads the JSON island, builds the SVG from the emitted geometry, re-scores labels with measured widths after `document.fonts.ready`, and wires interactions.

## Testing

- **Unit, parser** (`test/unit/yamlmini.test.ts`): block/flow collections, quoted and block scalars, comments, every rejected construct with line/column, CRLF input, the 256 KB limit.
- **Unit, schema** (`test/unit/summary-schema.test.ts`): the example above validates clean; one test per rule (missing `schema`, unknown kind, duplicate cell, cell outside grid, dangling edge, overlapping zones, flow step without edge → warning and dropped flow, second highlight on one node, size limits, unknown task id → warning); error objects carry `path` and `message`.
- **Unit, facts** (`test/unit/summary-facts.test.ts`): temp projects with `package.json`, `composer.json`, a WordPress plugin header; LOC and test-file counts with the walk fallback; tag count through an injected `runCapture`; the 10 MB approximation flag; scripts → commands per package manager.
- **Unit, layout** (`test/unit/summary-layout.test.ts`): fixtures `architecture.super-backlog.yml` and `architecture.kursbuchung.yml` (the two prototype datasets) produce `crossings === 0`, `collisions === 0`, `warnings.length === 0`; output is deep-equal across two runs and after JSON round-trip; each route kind (H, V, VH, HV) on a minimal grid; an impossible route (both corner cells occupied) yields `route-fallback` and still returns a polyline; port order on one side never crosses; label slot scoring prefers the collision-free candidate.
- **Render / snapshot** (`test/unit/summary-render.test.ts`): full view snapshot for the super-backlog fixture; reduced view snapshot (no file); notice rendering for an invalid file; `<script>` and `"` in pitch, labels, commands and file names never appear unescaped; `**bold**` becomes `<b>` only in the pitch; the EventSource path is `../api/events`; the `sbl-theme` resolver is present; the tokens file contains the two new hues in both theme blocks; `dashboard.html` snapshot updated for the page tabs.
- **Integration** (`test/integration/serve.test.ts`): `GET /p/<slug>/summary/` → 200 and the summary marker; `/summary` → 302; missing file → 404 text; writing `architecture.yml` into a temp project triggers a `reload` event and the next GET contains a node from the file (skipped where recursive watch is unsupported, like the existing reload test); an invalid file still yields 200 with the notice.
- **Glue skills** (`test/unit/glue-skills.test.ts`): frontmatter, `sbl doctor` loop, "never invent" boundary; `test/unit/doctor.test.ts`: check 5 passes on a clean file, fails with paths on a broken one, is skipped when the file is absent; uninstall removes the new skill directories.
- **Manual:** theme toggle round-trips between the two pages; keyboard-only tour (Tab → Enter → Esc, flow chips, stack buttons); 380 px viewport scrolls the canvas; reduced-motion stops the dash animation.

## Docs

- New `docs/guide/project-summary.md`: what the page shows, the schema table, the error behaviour, the skill, the YAML subset. Linked from `quickstart.md` and the dashboard section of `README.md` (one sentence each). The Docs-Gate requirement for `feat` PRs touching `src/` is satisfied.
- This repo's own `backlog/docs/architecture.yml` is created with the skill and reviewed by the user (dogfood).

## Implementation units

Each unit is one backlog task with its own tests; order is dependency order. Units 1–4 are pure modules and can run in parallel after unit 1.

1. **YAML subset parser** — `parseYamlSubset` in `src/lib/yamlmini.ts`, limits, tests.
2. **Schema and validation** — `src/dashboard/summary-schema.ts`, types, `loadArchitecture(cwd)`, two fixture files under `test/fixtures/summary/`.
3. **Automatic facts** — `src/dashboard/summary-facts.ts`: manifests, WordPress headers, LOC/tests, tags, workflows, lockfile versions, script commands.
4. **Layout engine** — `src/dashboard/summary-layout.ts` with the L1–L7 contract and fixture tests.
5. **Template and render** — `src/templates/summary.html`, `src/templates/sbl-tokens.css` extraction (dashboard refactor), `src/dashboard/summary-render.ts`, interactions, reduced view, notices, snapshots.
6. **Hub routing and navigation** — route, sibling file, regenerate both, SSE path, dashboard page tabs, integration tests, guide page and README/quickstart mentions.
7. **Generator skill and doctor check** — `skill-architecture-summary.md`, `GLUE_SKILLS`, uninstall paths, doctor check 5, tests.
8. **Dogfood** — generate and review this repo's `architecture.yml`, verify in the live hub, screenshot for the guide.

## Out of scope

- Editing `architecture.yml` from the page or any write operation on project data.
- A project switcher in the app bar, cross-project overviews, or hosting the summary on GitHub Pages.
- Resolving versions for languages other than npm/Composer lockfiles; CI status (green/red) from GitHub.
- Automatic node detection from code without the skill; the hub computes facts, never architecture.
- Full YAML support (anchors, tags, nested flow collections).

## Resolved questions

Decided 2026-10-09: every recommendation below was accepted as written.

1. **UI language.** The prototype is German, the dashboard is English. Decision: English chrome ("Highlights", "Open work", "Commands", "Tech stack", "Data source"); curated content stays in whatever language the author writes.
2. **Skill in this release or a follow-up.** Decision: in scope as unit 7 (see Generator skill); split into its own PR so it can slip without blocking the page.
3. **YAML subset parser vs. a dependency vs. JSON.** Decision: the subset parser (D7); revisit only if a second feature needs YAML beyond the subset.
4. **Doctor check.** Adding check 5 widens `sbl doctor`. Decision: include it; it is the only verification loop an agent has while writing the file.
5. **Who writes this repo's `architecture.yml`.** Decision: the skill generates it in unit 8 and the user reviews the prose before it is committed; the abridged example in this spec is the seed.
6. **Backlog tab target on the summary page.** Full-page `../bb/` (R4) versus the dashboard's overlay. Decision: full page; the overlay belongs to the dashboard and duplicating it adds code for no gain.
