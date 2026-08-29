# Dashboard Redesign v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the dashboard (new section order, Drafts section with detail modal), add KPI tiles + aging chart to Status, replace the activity sparkline with a calendar heatmap, fix the tasks table (natural sort, status badges, locale-aware Updated column), promote the model-router link to a button, switch typography to Plus Jakarta Sans + JetBrains Mono, and add a light theme with a toggle.

**Architecture:** The dashboard is one self-contained HTML template (`src/templates/dashboard.html`) with ES5 inline JS reading JSON islands; `src/dashboard/data.ts` collects data from the Backlog.md CLI and files; `src/dashboard/render.ts` fills template placeholders. New server-side metric math goes into a new `src/dashboard/metrics.ts` so it is unit-testable; client-only behavior (sorting, `Intl` formatting, theme toggle) lives in the template and is verified by string/snapshot assertions in the render tests, matching the existing test conventions.

**Tech Stack:** TypeScript (Node 20+, ESM), Vitest, plain ES5 in the template, SVG hand-rendered via `svgEl` helpers, Google Fonts (only external resource).

**Spec:** `docs/superpowers/specs/2026-08-30-dashboard-redesign-v2-design.md`

## Global Constraints

- Template JS is ES5 inside the existing `'use strict'` IIFE: `var`, function declarations, string concatenation — no arrows, `const`/`let`, or template literals.
- All colors in the template CSS come from CSS custom properties; Task 1 adds a guard test that fails on raw hex/`rgb(`/`rgba(` outside the two token blocks.
- Dashboard UI copy is English.
- No new npm dependencies; the Google Fonts stylesheet is the only external resource, with full fallback stacks (`"Segoe UI", system-ui, sans-serif` / `Consolas, "Courier New", monospace`).
- Both themes must meet WCAG AA 4.5:1 for text on its surface.
- Run a single test file with `npx vitest run test/unit/<file>.ts`; the full suite (`npm test`) builds first via `pretest`.
- Conventional commit messages (`feat:`, `test:`, `refactor:` …). Work happens on a feature branch (`feat/dashboard-redesign-v2`) created via the using-git-worktrees skill at execution time.
- After template markup changes, regenerate the render snapshot with `npx vitest run test/unit/dashboard-render.test.ts -u` **only after** the non-snapshot assertions pass.
- The render test file's `SAMPLE` data must be kept type-correct against `DashboardData` as interfaces grow (drafts gain fields in Task 4/5, `kpis` arrives in Task 8).

---

### Task 1: Color tokenization, light theme, theme toggle

**Files:**
- Modify: `src/templates/dashboard.html` (CSS `:root`, all component rules with raw colors, sidebar markup, head inline script, app JS)
- Test: `test/unit/dashboard-render.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: CSS tokens used by every later task: `--sans` (Task 2), `--ok-line`, `--accent-bg`, `--accent-line`, `--warn-line`, `--danger-line`, `--backdrop`, `--tip-bg`, `--shadow-dialog`, `--shadow-tip`, `--glow-accent`, `--glow-accent-soft`, `--glow-warn`, `--glow-warn-soft`, `--focus-ring`, `--spark-fill`. Theme attribute contract: `document.documentElement` always carries `data-theme="dark"` or `data-theme="light"`.

- [ ] **Step 1: Write the failing guard + toggle tests**

Append to `test/unit/dashboard-render.test.ts`:

```ts
describe('theming', () => {
  it('defines colors only through tokens (no raw colors outside token blocks)', () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const outsideTokens = style
      .replace(/:root\s*\{[\s\S]*?\}/, '')
      .replace(/:root\[data-theme="light"\]\s*\{[\s\S]*?\}/, '');
    expect(outsideTokens).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(outsideTokens).not.toMatch(/\brgba?\(/);
  });

  it('ships a light theme block and a pre-paint theme resolver', () => {
    expect(html).toContain(':root[data-theme="light"]');
    expect(html).toContain("localStorage.getItem('sbl-theme')");
    expect(html).toContain('prefers-color-scheme: light');
  });

  it('renders the theme toggle button in the sidebar', () => {
    const aside = /<aside class="sbl-side">([\s\S]*?)<\/aside>/.exec(html)?.[1] ?? '';
    expect(aside).toContain('id="theme-toggle"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/dashboard-render.test.ts`
Expected: FAIL — raw colors found; light block, resolver, toggle missing.

- [ ] **Step 3: Tokenize the dark palette**

In the `:root` block of `src/templates/dashboard.html`, append after `--mono:`:

```css
    --ok-line:#2b5642;
    --accent-bg:#10202e;
    --accent-line:#274a63;
    --warn-line:#5c4520;
    --danger-line:#5c2c2c;
    --backdrop:rgba(4,7,12,.65);
    --tip-bg:rgba(13,19,32,.97);
    --shadow-dialog:0 24px 80px rgba(0,0,0,.55);
    --shadow-tip:0 10px 28px rgba(0,0,0,.5);
    --glow-accent:rgba(92,200,255,.6);
    --glow-accent-soft:rgba(92,200,255,.4);
    --glow-warn:rgba(255,180,84,.25);
    --glow-warn-soft:rgba(255,180,84,.3);
    --focus-ring:rgba(92,200,255,.15);
    --spark-fill:rgba(92,200,255,.09);
```

Then replace every raw color in component rules with its token. Complete replacement map (line refs are pre-edit):

| Raw value | Replace with | Occurs in |
|---|---|---|
| `#2b5642` | `var(--ok-line)` | `.pill[data-tone="ok"]`, `.status-chip[data-tone="ok"]` |
| `#10202e` | `var(--accent-bg)` | accent pill/chip backgrounds, `.dep-link` |
| `#274a63` | `var(--accent-line)` | accent pill/chip borders, `.dep-link` |
| `#5c4520` | `var(--warn-line)` | warn pill/chip borders |
| `#5c2c2c` | `var(--danger-line)` | danger pill/chip borders |
| `rgba(92,200,255,.6)` | `var(--glow-accent)` | `.brand-glyph` text-shadow |
| `rgba(4,7,12,.65)` | `var(--backdrop)` | all three `::backdrop` rules |
| `rgba(13,19,32,.97)` | `var(--tip-bg)` | `#sbl-tip` background |
| `0 10px 28px rgba(0,0,0,.5)` | `var(--shadow-tip)` | `#sbl-tip` box-shadow |
| `0 24px 80px rgba(0,0,0,.55)` | `var(--shadow-dialog)` | `#task-dialog`, `#backlog-dialog`, `#models-dialog` |
| `rgba(92,200,255,.15)` | `var(--focus-ring)` | `input[type="search"]:focus` box-shadow |
| `rgba(92,200,255,.4)` | `var(--glow-accent-soft)` | `.spark-line` drop-shadow filter |
| `rgba(92,200,255,.09)` | `var(--spark-fill)` | `.spark-area` fill |
| `rgba(255,180,84,.25)` | `var(--glow-warn)` | `.step.gate .step-num` box-shadow |
| `rgba(255,180,84,.3)` | `var(--glow-warn-soft)` | `.update-badge:hover` box-shadow |

- [ ] **Step 4: Add the light theme block**

Directly after the `:root { … }` block:

```css
  :root[data-theme="light"] {
    --bg:#f3f6fb;
    --bg-glow-1: rgba(11,116,181,.05);
    --bg-glow-2: rgba(23,122,78,.04);
    --surface:#ffffff;
    --surface-2:#e9eef7;
    --line:#d7dfeb;
    --line-strong:#b6c3d8;
    --text:#17202f;
    --muted:#4c5d77;
    --dim:#62718c;
    --accent:#0b74b5;
    --accent-dim:#bcdcf0;
    --ok:#177a4e;
    --ok-bg:#dff3e8;
    --warn:#8a5a00;
    --warn-bg:#fbecd2;
    --danger:#b83a3a;
    --danger-bg:#fbe3e3;
    --ok-line:#9fd4b8;
    --accent-bg:#e2f0f9;
    --accent-line:#a8cfe6;
    --warn-line:#e3c68e;
    --danger-line:#eab5b5;
    --backdrop:rgba(23,32,47,.45);
    --tip-bg:rgba(255,255,255,.98);
    --shadow-dialog:0 24px 80px rgba(23,32,47,.25);
    --shadow-tip:0 10px 28px rgba(23,32,47,.18);
    --glow-accent:rgba(11,116,181,.35);
    --glow-accent-soft:rgba(11,116,181,.25);
    --glow-warn:rgba(138,90,0,.2);
    --glow-warn-soft:rgba(138,90,0,.25);
    --focus-ring:rgba(11,116,181,.18);
    --spark-fill:rgba(11,116,181,.08);
  }
```

Verify contrast of the light values (`--text`/`--muted`/`--dim`/`--accent`/`--ok`/`--warn`/`--danger` against `--bg`/`--surface`/`--surface-2`) with a contrast checker; every pair used for text must reach 4.5:1 — adjust the failing value darker, keep the hue.

- [ ] **Step 5: Add the pre-paint resolver and the toggle**

At the end of `<head>` (after `</style>`):

```html
<script>
(function () {
  var theme = null;
  try { theme = localStorage.getItem('sbl-theme'); } catch (e) { theme = null; }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
</script>
```

Sidebar markup — wrap brand and toggle on one row (replace the current `.brand` line):

```html
  <div class="brand"><span class="brand-glyph">●</span><b>__PROJECT_NAME__</b>
    <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Switch color theme">◐</button>
  </div>
```

CSS (in the Sidebar block):

```css
  .theme-toggle {
    margin-left: auto; width: 28px; height: 28px; border-radius: 50%;
    font: inherit; font-size: .9rem; line-height: 1; cursor: pointer;
    color: var(--muted); background: var(--surface-2); border: 1px solid var(--line-strong);
  }
  .theme-toggle:hover { color: var(--accent); border-color: var(--accent); }
  .theme-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

App JS — add near the quick-action helpers (inside the main IIFE):

```js
  /* ---------- Theme toggle ---------- */
  var themeToggle = document.getElementById('theme-toggle');
  function syncThemeToggle() {
    if (!themeToggle) return;
    var mode = document.documentElement.getAttribute('data-theme');
    themeToggle.textContent = mode === 'light' ? '☾' : '☀';
    themeToggle.setAttribute('aria-label', mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('sbl-theme', next); } catch (e) { /* private mode */ }
      syncThemeToggle();
    });
    syncThemeToggle();
  }
```

- [ ] **Step 6: Run tests, then refresh the snapshot**

Run: `npx vitest run test/unit/dashboard-render.test.ts`
Expected: theming tests PASS, snapshot test FAILS (markup changed).
Run: `npx vitest run test/unit/dashboard-render.test.ts -u` then re-run without `-u` → all PASS.

- [ ] **Step 7: Manual smoke + commit**

Run `npm run dashboard`, verify: dark by default (or light if the OS prefers light), toggle flips instantly and survives reload, dialogs/pills/charts legible in both themes.

```bash
git add src/templates/dashboard.html test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): tokenize colors, add light theme with persistent toggle"
```

---

### Task 2: Typography — Plus Jakarta Sans + JetBrains Mono

**Files:**
- Modify: `src/templates/dashboard.html` (head links, `:root` tokens, `body` font, heading weights, removal of the `@font-face` Inter blocks)
- Test: `test/unit/dashboard-render.test.ts`

**Interfaces:**
- Consumes: token structure from Task 1.
- Produces: `--sans` and updated `--mono` tokens used verbatim by all later UI tasks.

- [ ] **Step 1: Write the failing tests**

```ts
describe('typography', () => {
  it('loads Plus Jakarta Sans and JetBrains Mono from Google Fonts with swap', () => {
    expect(html).toMatch(/fonts\.googleapis\.com\/css2\?[^"]*Plus\+Jakarta\+Sans/);
    expect(html).toMatch(/fonts\.googleapis\.com\/css2\?[^"]*JetBrains\+Mono/);
    expect(html).toContain('display=swap');
  });

  it('uses the new stacks and drops the fake Inter font-face', () => {
    expect(html).toContain('--sans:"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif;');
    expect(html).toContain('--mono:"JetBrains Mono",Consolas,"Courier New",monospace;');
    expect(html).not.toContain('@font-face');
    expect(html).not.toContain("local('Inter')");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/dashboard-render.test.ts`
Expected: FAIL on all four assertions.

- [ ] **Step 3: Implement**

In `<head>` before `<style>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
```

In `:root`: change `--mono` to `"JetBrains Mono",Consolas,"Courier New",monospace` and add `--sans:"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif;`. Delete the three `@font-face` blocks. Change `body { font-family: … }` to `font-family: var(--sans);`. Set `.sec-head h2 { font-weight: 700; }` and `.cmd-title { font-weight: 700; }` (Jakarta headings run at 700 per the chosen system).

- [ ] **Step 4: Run tests, refresh snapshot, commit**

Run: `npx vitest run test/unit/dashboard-render.test.ts` → typography tests PASS, snapshot stale → `-u`, re-run, all PASS. Manual smoke: fonts load; with DevTools offline the fallbacks render.

```bash
git add src/templates/dashboard.html test/unit/__snapshots__/dashboard-render.test.ts.snap test/unit/dashboard-render.test.ts
git commit -m "feat(dashboard): switch typography to Plus Jakarta Sans + JetBrains Mono"
```

---

### Task 3: Section reorder, model-router button, Drafts section shell

**Files:**
- Modify: `src/templates/dashboard.html` (sidebar nav, section blocks, cmd-row, `.side-models` CSS removal)
- Test: `test/unit/dashboard-render.test.ts`

**Interfaces:**
- Consumes: existing `#models-btn` JS wiring (keeps working because the id survives).
- Produces: section anchors `sec-01`…`sec-08` in the spec order; `#drafts` mount now lives in section 05. Later tasks mount into `sec-02` (KPIs/aging) and `sec-07` (heatmap).

- [ ] **Step 1: Update the SECTIONS fixture and add assertions (failing first)**

In `test/unit/dashboard-render.test.ts` replace the `SECTIONS` constant:

```ts
const SECTIONS = [
  ['01', 'Board & Quick Actions'],
  ['02', 'Status'],
  ['03', 'Feature Cycle'],
  ['04', 'Milestones'],
  ['05', 'Drafts'],
  ['06', 'Tasks'],
  ['07', 'Activity'],
  ['08', 'Decisions & Docs'],
] as const;
```

Update the two tests that say "seven" sections to "eight" (names only — the loops already iterate `SECTIONS`). Add:

```ts
describe('v2 structure', () => {
  it('renders the model router as a command button next to Backlog', () => {
    const row = /<div class="cmd-row" id="cmd-buttons">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
    expect(row).toContain('id="backlog-btn"');
    expect(row).toContain('id="models-btn"');
    expect(row).toContain('Model Router');
    expect(html).not.toContain('class="side-models"');
  });

  it('hosts drafts in their own section 05', () => {
    const sec = /<section id="sec-05">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
    expect(sec).toContain('<h2>Drafts</h2>');
    expect(sec).toContain('id="drafts-list"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/dashboard-render.test.ts` — FAIL.

- [ ] **Step 3: Implement the reorder**

Sidebar nav becomes:

```html
    <a href="#sec-01"><span class="n">01</span>Board &amp; Quick Actions</a>
    <a href="#sec-02"><span class="n">02</span>Status</a>
    <a href="#sec-03"><span class="n">03</span>Feature Cycle</a>
    <a href="#sec-04"><span class="n">04</span>Milestones</a>
    <a href="#sec-05"><span class="n">05</span>Drafts</a>
    <a href="#sec-06"><span class="n">06</span>Tasks</a>
    <a href="#sec-07"><span class="n">07</span>Activity</a>
    <a href="#sec-08"><span class="n">08</span>Decisions &amp; Docs</a>
```

Reorder the `<section>` blocks to match, renumber each `id="sec-NN"` and `<span class="sec-num">NN</span>`. The Feature Cycle block (stepper + `#phase-detail` + Flow) moves between Status and Milestones. Remove the drafts `<div id="drafts">…</div>` from section 01 and create section 05:

```html
<section id="sec-05">
  <div class="sec-head"><span class="sec-num">05</span><h2>Drafts</h2><span class="tagline">ideas before they enter the backlog &middot; click a card for details</span></div>
  <div id="drafts" class="mount">
    <ul id="drafts-list" class="drafts-list"></ul>
  </div>
</section>
```

(The `<h3 class="sub-head">Drafts</h3>` heading is dropped — the section head replaces it.)

In section 01, replace the single-button row with:

```html
    <div class="cmd-row" id="cmd-buttons">
      <button type="button" class="cmd-btn" id="backlog-btn"><span class="cmd-title">Backlog</span><span class="cmd-line">board &middot; tasks &middot; docs &middot; decisions</span></button>
      <button type="button" class="cmd-btn" id="models-btn"><span class="cmd-title">Model Router</span><span class="cmd-line">workhorse &middot; budget &middot; tiers</span></button>
    </div>
```

Delete the old sidebar `<button type="button" id="models-btn" class="side-models">model router</button>` and the `.side-models` CSS rules.

**Caution:** `cmdFeedback` swaps `.cmd-title` text on the models button now; that is fine — `renderModelsDialog` never calls it on `#models-btn`.

- [ ] **Step 4: Run tests, refresh snapshot, commit**

`npx vitest run test/unit/dashboard-render.test.ts` → structure tests PASS → `-u` → all PASS. Also run `npx vitest run test/unit` to catch cross-file fallout (hub tests don't touch the template — expected green).

```bash
git add src/templates/dashboard.html test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): reorder sections, promote model router to command button, dedicated drafts section"
```

---

### Task 4: Data layer — `created` on tasks, enriched drafts

**Files:**
- Modify: `src/dashboard/data.ts`
- Test: `test/unit/dashboard-data.test.ts`

**Interfaces:**
- Consumes: existing `readSimpleKeys(path, keys)`, `parseTaskFile(content)`, `asString`.
- Produces:
  - `DashboardTask` gains `created?: string`.
  - `DashboardDraft` becomes `{ id: string; title: string; status: string; description?: string; priority?: string; assignee?: string; created?: string; updated?: string; acs: DashboardAC[] }`.

- [ ] **Step 1: Write the failing tests**

In `test/unit/dashboard-data.test.ts` (follow the file's existing temp-dir helpers for `readDrafts` tests; if none exist, create a temp dir via `mkdtempSync(join(tmpdir(), 'sbl-'))` with a `backlog/drafts` subfolder):

```ts
describe('normalizeTasks created mapping', () => {
  it('maps createdAt / created_at / created', () => {
    const tasks = normalizeTasks([
      { id: 't-1', title: 'a', status: 'To Do', createdAt: '2026-08-01' },
      { id: 't-2', title: 'b', status: 'To Do', created_at: '2026-08-02' },
      { id: 't-3', title: 'c', status: 'To Do', created: '2026-08-03' },
      { id: 't-4', title: 'd', status: 'To Do' },
    ]);
    expect(tasks.map((t) => t.created)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', undefined]);
  });
});

describe('readDrafts enrichment', () => {
  it('parses description, ACs and meta from the draft file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbl-drafts-'));
    mkdirSync(join(dir, 'backlog', 'drafts'), { recursive: true });
    writeFileSync(
      join(dir, 'backlog', 'drafts', 'task-9 - idea.md'),
      [
        '---',
        'id: task-9',
        'title: Offline mode',
        'status: Draft',
        'priority: low',
        'assignee: adam',
        'created_date: 2026-08-10',
        'updated_date: 2026-08-12',
        '---',
        '<!-- SECTION:DESCRIPTION:BEGIN -->',
        'Cache the board locally.',
        '<!-- SECTION:DESCRIPTION:END -->',
        '<!-- AC:BEGIN -->',
        '- [ ] #1 works without network',
        '- [x] #2 syncs on reconnect',
        '<!-- AC:END -->',
      ].join('\n'),
      'utf8',
    );
    const drafts = readDrafts(dir);
    expect(drafts).toHaveLength(1);
    const d = drafts[0]!;
    expect(d.description).toBe('Cache the board locally.');
    expect(d.priority).toBe('low');
    expect(d.assignee).toBe('adam');
    expect(d.created).toBe('2026-08-10');
    expect(d.updated).toBe('2026-08-12');
    expect(d.acs).toEqual([
      { text: 'works without network', checked: false },
      { text: 'syncs on reconnect', checked: true },
    ]);
  });
});
```

Add the needed imports (`mkdtempSync`, `mkdirSync`, `writeFileSync`, `tmpdir`) if not already present.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/dashboard-data.test.ts`
Expected: FAIL — `created` undefined everywhere, drafts carry no detail fields (TypeScript may already fail compilation on `d.description`; that counts as RED).

- [ ] **Step 3: Implement**

In `src/dashboard/data.ts`:

```ts
export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignee?: string;
  created?: string;
  updated?: string;
  milestone?: string;
  description?: string;
  acs: DashboardAC[];
}

export interface DashboardDraft {
  id: string;
  title: string;
  status: string;
  description?: string;
  priority?: string;
  assignee?: string;
  created?: string;
  updated?: string;
  acs: DashboardAC[];
}
```

In `normalizeTasks`, after the `assignee` line:

```ts
    created: asString(t['createdAt']) ?? asString(t['created_at']) ?? asString(t['created']),
```

Replace `readDraftFile`:

```ts
function readDraftFile(path: string): DashboardDraft | null {
  const keys = readSimpleKeys(path, [
    'id', 'title', 'status', 'priority', 'assignee',
    'created_date', 'updated_date', 'created', 'updated',
  ]);
  const id = asString(keys.id);
  const title = asString(keys.title);
  const status = asString(keys.status);
  if (!id || !title || !status) return null;
  let detail: { description?: string; acs: DashboardAC[] } = { acs: [] };
  try {
    detail = parseTaskFile(readFileSync(path, 'utf8'));
  } catch {
    // keys-only draft when the file cannot be re-read
  }
  return {
    id,
    title,
    status,
    description: detail.description,
    priority: asString(keys.priority),
    assignee: asString(keys.assignee),
    created: asString(keys['created_date']) ?? asString(keys['created']),
    updated: asString(keys['updated_date']) ?? asString(keys['updated']),
    acs: detail.acs,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/dashboard-data.test.ts` → PASS.
Run: `npx vitest run test/unit/dashboard-render.test.ts` — the `SAMPLE.drafts` entry must now be `{ id: 'DRAFT-1', title: 'Idea: offline mode', status: 'Draft', acs: [] }` to satisfy the type; fix it and refresh the snapshot if the JSON island changed.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/data.ts test/unit/dashboard-data.test.ts test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): task created date and enriched draft details in the data layer"
```

---

### Task 5: Draft cards and draft detail modal

**Files:**
- Modify: `src/templates/dashboard.html` (renderDrafts, new openDraftDetail, small CSS)
- Test: `test/unit/dashboard-render.test.ts`

**Interfaces:**
- Consumes: `DashboardDraft` shape from Task 4; existing `el`, `toneOf`, `metaGrid`-style helpers, `acSection`, `descParagraphs`, `#task-dialog` element, `copyCommand`.
- Produces: `openDraftDetail(draft)` (template-internal).

- [ ] **Step 1: Write the failing tests**

```ts
describe('drafts v2', () => {
  it('renders drafts as clickable cards with status chips', () => {
    expect(html).toContain('function openDraftDetail');
    expect(html).toMatch(/renderDrafts[\s\S]*?flow-card/);
  });

  it('offers the promote command in the draft modal', () => {
    expect(html).toContain('backlog draft promote ');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

`npx vitest run test/unit/dashboard-render.test.ts` — FAIL.

- [ ] **Step 3: Implement**

Replace the Drafts block in the app JS:

```js
  /* ---------- Drafts ---------- */
  function draftMetaGrid(d) {
    var grid = el('div', 'detail-meta');
    function cell(label, value, tone) {
      var c = el('div', 'meta-cell');
      c.appendChild(el('span', 'meta-label', label));
      var v = el('span', 'meta-value' + (value ? '' : ' empty'), value || '—');
      if (value && tone) v.setAttribute('data-tone', tone);
      c.appendChild(v);
      return c;
    }
    grid.appendChild(cell('Priority', d.priority, priorityTone(d.priority)));
    grid.appendChild(cell('Assignee', d.assignee));
    grid.appendChild(cell('Created', d.created));
    grid.appendChild(cell('Updated', d.updated));
    return grid;
  }
  function openDraftDetail(d) {
    if (!dialog) return;
    var content = el('div', 'dialog-content');
    var head = el('div', 'detail-head');
    head.appendChild(el('span', 'detail-id', d.id));
    var chip = el('span', 'status-chip', d.status);
    chip.setAttribute('data-tone', toneOf(d.status));
    head.appendChild(chip);
    var closeBtn = el('button', 'detail-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close details');
    closeBtn.addEventListener('click', closeDetail);
    head.appendChild(closeBtn);
    content.appendChild(head);
    var title = el('h3', 'detail-title', d.title);
    title.id = 'detail-title-h';
    dialog.setAttribute('aria-labelledby', 'detail-title-h');
    content.appendChild(title);
    if (d.description) content.appendChild(descParagraphs(d.description));
    else content.appendChild(el('p', 'detail-desc', 'No description.'));
    content.appendChild(draftMetaGrid(d));
    if (d.acs && d.acs.length > 0) content.appendChild(acSection(d));
    var cmd = el('button', 'phase-cmd detail-cmd');
    cmd.type = 'button';
    var cmdLine = 'backlog draft promote ' + d.id.replace(/^task-/i, '');
    cmd.appendChild(el('span', 'cmd-line', cmdLine));
    cmd.appendChild(el('span', 'cmd-title', 'copy'));
    cmd.addEventListener('click', function () { copyCommand(cmd, cmdLine); });
    content.appendChild(cmd);
    dialog.textContent = '';
    dialog.appendChild(content);
    dialog.showModal();
  }
  function renderDrafts(drafts) {
    var list = document.getElementById('drafts-list');
    if (!list) return;
    list.textContent = '';
    if (!drafts || drafts.length === 0) { list.appendChild(el('li', '', 'No drafts.')); return; }
    drafts.forEach(function (d) {
      var li = el('li', 'flow-card');
      var head = el('div', 'flow-card-head');
      head.appendChild(el('span', 'flow-card-id', d.id));
      var chip = el('span', 'status-chip', d.status);
      chip.setAttribute('data-tone', toneOf(d.status));
      head.appendChild(chip);
      li.appendChild(head);
      li.appendChild(el('div', 'flow-card-title', d.title));
      li.addEventListener('click', function () { openDraftDetail(d); });
      list.appendChild(li);
    });
  }
  renderDrafts(data.drafts);
```

**Ordering caution:** this block currently sits *before* the helpers it now uses (`toneOf`, `closeDetail`, `descParagraphs`, `acSection`, `priorityTone`, `dialog`). Function declarations hoist, but `var dialog` does not — **move the whole Drafts block below the Detail dialog block** (after `window.__sblOpenDetail = openDetail;`). Since `.drafts-list li` styling is replaced by `flow-card`, delete the `.drafts-list li { … }` rule and keep `.drafts-list` (the grid gap).

- [ ] **Step 4: Run tests, refresh snapshot, commit**

`npx vitest run test/unit/dashboard-render.test.ts` → new tests PASS → `-u` → all PASS. Manual smoke: click a draft (create one with `backlog draft create "Test"` if none), modal shows details, promote command copies.

```bash
git add src/templates/dashboard.html test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): draft cards with full detail modal"
```

---

### Task 6: Tasks table — natural sort, status badges, locale-aware Updated

**Files:**
- Modify: `src/templates/dashboard.html` (sort comparator, `renderTasks` cells, `Intl` helpers, `.cell-updated` CSS)
- Test: `test/unit/dashboard-render.test.ts`

**Interfaces:**
- Consumes: `toneOf`, `el`, existing `state`/`field`.
- Produces: template-internal `compareTasks(a, b, key)`, `formatRelative(value)`, `formatExact(value)` (reused by nothing else — the aging chart computes its own ages).

- [ ] **Step 1: Write the failing tests**

```ts
describe('tasks table v2', () => {
  it('sorts with numeric-aware comparison and chronological updated', () => {
    expect(html).toContain("localeCompare(field(b, key), undefined, { numeric: true, sensitivity: 'base' })");
    expect(html).toContain('function compareTasks');
  });

  it('renders status cells as chips and formats updated via Intl', () => {
    expect(html).toMatch(/cell-status[\s\S]{0,400}status-chip/);
    expect(html).toContain('Intl.RelativeTimeFormat');
    expect(html).toContain('Intl.DateTimeFormat');
  });

  it('centers the updated column', () => {
    expect(html).toMatch(/\.cell-updated\s*\{[^}]*text-align:\s*center/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

`npx vitest run test/unit/dashboard-render.test.ts` — FAIL.

- [ ] **Step 3: Implement**

Above `renderTasks` add:

```js
  function compareTasks(a, b, key) {
    if (key === 'updated') {
      var ta = Date.parse(field(a, key)) || 0;
      var tb = Date.parse(field(b, key)) || 0;
      if (ta !== tb) return ta - tb;
    }
    return field(a, key).localeCompare(field(b, key), undefined, { numeric: true, sensitivity: 'base' });
  }
  var relFmt = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;
  var exactFmt = window.Intl && Intl.DateTimeFormat ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;
  var REL_UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  function parseWhen(value) {
    if (!value) return null;
    /* date-only strings get a local noon so the day never shifts across timezones */
    var t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value);
    return isNaN(t) ? null : t;
  }
  function formatRelative(value) {
    var t = parseWhen(value);
    if (t === null || !relFmt) return value;
    var diff = (t - Date.now()) / 1000;
    for (var i = 0; i < REL_UNITS.length; i++) {
      if (Math.abs(diff) >= REL_UNITS[i][1] || i === REL_UNITS.length - 1) {
        return relFmt.format(Math.round(diff / REL_UNITS[i][1]), REL_UNITS[i][0]);
      }
    }
    return value;
  }
  function formatExact(value) {
    var t = parseWhen(value);
    return t === null || !exactFmt ? '' : exactFmt.format(new Date(t));
  }
```

In `renderTasks`, change the sort call to `.sort(function (a, b) { return compareTasks(a, b, state.key) * state.dir; })` and replace the cell loop:

```js
    rows.forEach(function (task) {
      var tr = el('tr', 'task-row');
      tr.setAttribute('data-task', task.id);
      KEYS.forEach(function (k) {
        var td = el('td', 'cell-' + k);
        if (k === 'status') {
          var chip = el('span', 'status-chip', field(task, k));
          chip.setAttribute('data-tone', toneOf(task.status));
          td.appendChild(chip);
        } else if (k === 'updated') {
          td.textContent = formatRelative(field(task, k));
          var exact = formatExact(field(task, k));
          if (exact) td.setAttribute('data-tip', exact);
        } else {
          td.textContent = field(task, k);
        }
        tr.appendChild(td);
      });
      tr.addEventListener('click', function () { openDetail(task.id); });
      tbody.appendChild(tr);
    });
```

CSS: `.cell-updated { font-family: var(--mono); color: var(--muted); text-align: center; }` and add `th[data-key="updated"] { text-align: center; }`.

(`toneOf` is a hoisted function declaration inside the same IIFE, so calling it from `renderTasks` — which is defined earlier in the file but only *invoked* after full parse — is safe.)

- [ ] **Step 4: Run tests, refresh snapshot, commit**

`npx vitest run test/unit/dashboard-render.test.ts` → PASS after `-u`. Manual smoke: sort by ID gives task-1 … task-2 … task-10; Updated shows "vor X Std."-style strings in a German-locale browser and the exact timestamp as tooltip; the tooltip uses the existing `data-tip` handler.

```bash
git add src/templates/dashboard.html test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): natural task sorting, status badges and locale-aware updated column"
```

---

### Task 7: Data layer — 26-week activity window with task ids

**Files:**
- Modify: `src/dashboard/data.ts` (`DashboardActivityBucket`, `computeActivity`)
- Test: `test/unit/dashboard-data.test.ts`

**Interfaces:**
- Consumes: existing `isoDay`, `shiftDay`.
- Produces: `DashboardActivityBucket = { date: string; count: number; ids: string[] }`; `export const ACTIVITY_DAYS = 182;` — buckets are exactly `ACTIVITY_DAYS` long, oldest first, ending at `today`. Tasks dated before the window are dropped (not clamped).

- [ ] **Step 1: Write the failing tests**

Update the existing `computeActivity` tests (they assert 30 buckets) and add:

```ts
describe('computeActivity v2', () => {
  it('produces 182 daily buckets carrying the touched task ids', () => {
    const out = computeActivity(
      [
        { id: 't-1', updated_at: '2026-08-29' },
        { id: 't-2', updated_at: '2026-08-29' },
        { id: 't-3', created_at: '2026-08-01' },
        { id: 'old', updated_at: '2020-01-01' },
      ],
      '2026-08-30',
    );
    expect(out).toHaveLength(182);
    expect(out[out.length - 1]!.date).toBe('2026-08-30');
    const aug29 = out.find((b) => b.date === '2026-08-29')!;
    expect(aug29.count).toBe(2);
    expect(aug29.ids).toEqual(['t-1', 't-2']);
    expect(out.every((b) => b.ids.length === b.count)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

`npx vitest run test/unit/dashboard-data.test.ts` — FAIL (30 buckets, no `ids`).

- [ ] **Step 3: Implement**

```ts
export interface DashboardActivityBucket {
  date: string;
  count: number;
  ids: string[];
}

export const ACTIVITY_DAYS = 182;

/** Bucket tasks into exactly ACTIVITY_DAYS UTC daily buckets ending at `today`, oldest first. */
export function computeActivity(rawTasks: RawTask[], today: string): DashboardActivityBucket[] {
  const byDay = new Map<string, string[]>();
  for (const t of rawTasks) {
    const day =
      isoDay(asString(t['updatedAt']) ?? asString(t['updated_at']) ?? asString(t['updated'])) ??
      isoDay(asString(t['createdAt']) ?? asString(t['created_at'])) ??
      today;
    const ids = byDay.get(day) ?? [];
    ids.push(asString(t['id']) ?? '');
    byDay.set(day, ids);
  }
  const start = shiftDay(today, -(ACTIVITY_DAYS - 1));
  const out: DashboardActivityBucket[] = [];
  for (let i = 0; i < ACTIVITY_DAYS; i++) {
    const date = shiftDay(start, i);
    const ids = byDay.get(date) ?? [];
    out.push({ date, count: ids.length, ids });
  }
  return out;
}
```

(Note the added `updatedAt`/`createdAt` camel-case fallbacks — schemaVersion-1 CLI output uses them; the old code silently dated every modern task "today".)

- [ ] **Step 4: Run tests and fix fixtures**

`npx vitest run test/unit/dashboard-data.test.ts` → PASS. Then `npx vitest run test/unit/dashboard-render.test.ts`: the `buckets()` helper in the render test builds `DashboardActivityBucket[]` — add `ids: []` there (`{ date, count, ids: [] }` — counts may stay synthetic in this fixture) and refresh the snapshot. The interim sparkline simply renders 182 points; it is replaced in Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/data.ts test/unit/dashboard-data.test.ts test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): 26-week activity buckets with touched task ids"
```

---

### Task 8: Metrics module and wiring

**Files:**
- Create: `src/dashboard/metrics.ts`
- Modify: `src/dashboard/data.ts` (add `kpis` to `DashboardData`, compute in `collectDashboardData`)
- Test: `test/unit/dashboard-metrics.test.ts` (new)

**Interfaces:**
- Consumes: `DashboardTask` (with `created`), `DashboardDep`, `DashboardActivityBucket` from `./data.js`.
- Produces:

```ts
export interface DashboardKpis {
  total: number;
  done: number;
  open: number;
  progressPct: number;          // 0..100, rounded
  velocity7: number;            // done tasks with `updated` within the last 7 days (today inclusive)
  velocityPrev7: number;        // done tasks with `updated` within the 7 days before that
  forecastDate: string | null;  // ISO day; null when velocity7 === 0 or open === 0
  wip: number;                  // status contains "progress" or equals "review"
  blocked: number;              // open with an unresolved dep, or status contains "block"
  oldestOpenId: string | null;
  oldestOpenDays: number | null;
  medianOpenAgeDays: number | null;
  activityTotal30: number;      // sum of the last 30 buckets
  activityAvgPerWeek: number;   // total over the full window / (window/7), one decimal
  busiestWeekday: number | null; // 0=Sunday..6=Saturday (UTC), null when no activity
  streakDays: number;           // consecutive active days ending today, or yesterday when today is 0
}
export function computeKpis(
  tasks: readonly DashboardTask[],
  deps: readonly DashboardDep[],
  activity: readonly DashboardActivityBucket[],
  today: string,               // YYYY-MM-DD
): DashboardKpis;
```

  and `DashboardData` gains `kpis: DashboardKpis`.

- [ ] **Step 1: Write the failing tests**

Create `test/unit/dashboard-metrics.test.ts`:

```ts
// test/unit/dashboard-metrics.test.ts
import { describe, expect, it } from 'vitest';

import { computeKpis } from '../../src/dashboard/metrics.js';
import { computeActivity } from '../../src/dashboard/data.js';
import type { DashboardTask } from '../../src/dashboard/data.js';

const TODAY = '2026-08-30';
function task(partial: Partial<DashboardTask> & { id: string; status: string }): DashboardTask {
  return { title: partial.id, acs: [], ...partial } as DashboardTask;
}

describe('computeKpis', () => {
  it('computes progress, velocity and forecast', () => {
    const tasks = [
      task({ id: 't-1', status: 'Done', updated: '2026-08-28' }),
      task({ id: 't-2', status: 'Done', updated: '2026-08-20' }),
      task({ id: 't-3', status: 'To Do', created: '2026-08-01' }),
      task({ id: 't-4', status: 'In Progress', created: '2026-08-25' }),
    ];
    const k = computeKpis(tasks, [], computeActivity([], TODAY), TODAY);
    expect(k.total).toBe(4);
    expect(k.done).toBe(2);
    expect(k.open).toBe(2);
    expect(k.progressPct).toBe(50);
    expect(k.velocity7).toBe(1);       // t-1 within Aug 24-30
    expect(k.velocityPrev7).toBe(1);   // t-2 within Aug 17-23
    // 2 open at 1 done/7d -> 14 days
    expect(k.forecastDate).toBe('2026-09-13');
  });

  it('hides the forecast without velocity and counts wip/blocked', () => {
    const tasks = [
      task({ id: 't-1', status: 'In Progress' }),
      task({ id: 't-2', status: 'Blocked' }),
      task({ id: 't-3', status: 'To Do' }),
      task({ id: 't-4', status: 'Done', updated: '2026-01-01' }),
    ];
    const deps = [{ from: 't-3', to: 't-1' }];
    const k = computeKpis(tasks, deps, computeActivity([], TODAY), TODAY);
    expect(k.forecastDate).toBeNull();
    expect(k.wip).toBe(1);
    expect(k.blocked).toBe(2); // t-2 by status, t-3 by unresolved dep on t-1
  });

  it('computes ages of open tasks from created with updated fallback', () => {
    const tasks = [
      task({ id: 'old', status: 'To Do', created: '2026-08-10' }),   // 20 days
      task({ id: 'mid', status: 'To Do', updated: '2026-08-24' }),   // 6 days (fallback)
      task({ id: 'done', status: 'Done', created: '2026-01-01' }),   // ignored
      task({ id: 'undated', status: 'To Do' }),                       // ignored
    ];
    const k = computeKpis(tasks, [], computeActivity([], TODAY), TODAY);
    expect(k.oldestOpenId).toBe('old');
    expect(k.oldestOpenDays).toBe(20);
    expect(k.medianOpenAgeDays).toBe(13); // median of [6, 20]
  });

  it('computes activity aggregates and streak', () => {
    const activity = computeActivity(
      [
        { id: 'a', updated_at: '2026-08-30' },
        { id: 'b', updated_at: '2026-08-29' },
        { id: 'c', updated_at: '2026-08-29' },
        { id: 'd', updated_at: '2026-08-27' },
      ],
      TODAY,
    );
    const k = computeKpis([], [], activity, TODAY);
    expect(k.activityTotal30).toBe(4);
    expect(k.streakDays).toBe(2);        // Aug 30 + Aug 29; gap on Aug 28
    expect(k.busiestWeekday).toBe(6);    // 2026-08-29 is a Saturday
    expect(k.activityAvgPerWeek).toBe(0.2); // 4 touches / 26 weeks, rounded to one decimal
  });
});
```

- [ ] **Step 2: Run to verify it fails**

`npx vitest run test/unit/dashboard-metrics.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement `src/dashboard/metrics.ts`**

```ts
// src/dashboard/metrics.ts
// All numbers are declared approximations: Backlog.md keeps no status
// history, so everything derives from created/updated timestamps.
import type { DashboardActivityBucket, DashboardDep, DashboardTask } from './data.js';

export interface DashboardKpis {
  total: number;
  done: number;
  open: number;
  progressPct: number;
  velocity7: number;
  velocityPrev7: number;
  forecastDate: string | null;
  wip: number;
  blocked: number;
  oldestOpenId: string | null;
  oldestOpenDays: number | null;
  medianOpenAgeDays: number | null;
  activityTotal30: number;
  activityAvgPerWeek: number;
  busiestWeekday: number | null;
  streakDays: number;
}

function isDone(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'done' || s === 'complete' || s === 'completed';
}

function isWip(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('progress') || s === 'review';
}

function utcDay(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const DAY_MS = 86_400_000;

export function computeKpis(
  tasks: readonly DashboardTask[],
  deps: readonly DashboardDep[],
  activity: readonly DashboardActivityBucket[],
  today: string,
): DashboardKpis {
  const todayMs = utcDay(today) ?? Date.UTC(1970, 0, 1);
  const total = tasks.length;
  const doneTasks = tasks.filter((t) => isDone(t.status));
  const done = doneTasks.length;
  const open = total - done;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const doneInWindow = (fromDaysAgo: number, toDaysAgo: number): number =>
    doneTasks.filter((t) => {
      const d = utcDay(t.updated);
      if (d === null) return false;
      const age = (todayMs - d) / DAY_MS;
      return age >= toDaysAgo && age < fromDaysAgo;
    }).length;
  const velocity7 = doneInWindow(7, 0);
  const velocityPrev7 = doneInWindow(14, 7);

  let forecastDate: string | null = null;
  if (velocity7 > 0 && open > 0) {
    const daysNeeded = Math.ceil((open / velocity7) * 7);
    forecastDate = new Date(todayMs + daysNeeded * DAY_MS).toISOString().slice(0, 10);
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const unresolved = new Set<string>();
  for (const dep of deps) {
    const from = byId.get(dep.from);
    const to = byId.get(dep.to);
    if (from && !isDone(from.status) && to && !isDone(to.status)) unresolved.add(dep.from);
  }
  const openTasks = tasks.filter((t) => !isDone(t.status));
  const wip = openTasks.filter((t) => isWip(t.status)).length;
  const blocked = openTasks.filter(
    (t) => t.status.toLowerCase().includes('block') || unresolved.has(t.id),
  ).length;

  const ages: { id: string; days: number }[] = [];
  for (const t of openTasks) {
    const d = utcDay(t.created) ?? utcDay(t.updated);
    if (d === null) continue;
    ages.push({ id: t.id, days: Math.max(0, Math.round((todayMs - d) / DAY_MS)) });
  }
  ages.sort((a, b) => b.days - a.days);
  const oldest = ages[0] ?? null;
  let medianOpenAgeDays: number | null = null;
  if (ages.length > 0) {
    const mid = Math.floor(ages.length / 2);
    medianOpenAgeDays =
      ages.length % 2 === 1 ? ages[mid]!.days : Math.round((ages[mid - 1]!.days + ages[mid]!.days) / 2);
  }

  const activityTotal30 = activity.slice(-30).reduce((sum, b) => sum + b.count, 0);
  const windowTotal = activity.reduce((sum, b) => sum + b.count, 0);
  const activityAvgPerWeek =
    activity.length > 0 ? Math.round((windowTotal / (activity.length / 7)) * 10) / 10 : 0;

  const perWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const b of activity) {
    const d = utcDay(b.date);
    if (d !== null) perWeekday[new Date(d).getUTCDay()]! += b.count;
  }
  const maxWeekday = Math.max(...perWeekday);
  const busiestWeekday = maxWeekday > 0 ? perWeekday.indexOf(maxWeekday) : null;

  let streakDays = 0;
  let i = activity.length - 1;
  if (i >= 0 && activity[i]!.count === 0) i--; // today may still be empty
  while (i >= 0 && activity[i]!.count > 0) {
    streakDays++;
    i--;
  }

  return {
    total, done, open, progressPct,
    velocity7, velocityPrev7, forecastDate,
    wip, blocked,
    oldestOpenId: oldest ? oldest.id : null,
    oldestOpenDays: oldest ? oldest.days : null,
    medianOpenAgeDays,
    activityTotal30, activityAvgPerWeek, busiestWeekday, streakDays,
  };
}
```

- [ ] **Step 4: Run to verify metric tests pass**

`npx vitest run test/unit/dashboard-metrics.test.ts` → PASS.

- [ ] **Step 5: Wire into `DashboardData`**

In `data.ts`: import `computeKpis` and `DashboardKpis` from `./metrics.js`, add `kpis: DashboardKpis;` to `DashboardData`, set `kpis: computeKpis([], [], base.activity, today)` in `base`, and in the success path `kpis: computeKpis(tasks, computeDeps(rawTasks), activity, today)` (compute `deps`/`activity` once into locals to avoid double work). In the render test `SAMPLE`, add a `kpis` object (compute-by-hand values are irrelevant to markup: `computeKpis(SAMPLE.tasks, SAMPLE.deps, SAMPLE.activity, '2026-08-26')` inline is fine and stays consistent).

- [ ] **Step 6: Run the full unit suite, commit**

`npx vitest run test/unit` → PASS (snapshot refresh if the JSON island grew — it did: `-u`).

```bash
git add src/dashboard/metrics.ts src/dashboard/data.ts test/unit/dashboard-metrics.test.ts test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): server-side KPI metrics (progress, velocity, wip, age, activity)"
```

---

### Task 9: Status section — KPI tiles and aging strip

**Files:**
- Modify: `src/templates/dashboard.html` (section 02 markup, KPI/aging renderers, special filters, CSS)
- Test: `test/unit/dashboard-render.test.ts`

**Interfaces:**
- Consumes: `data.kpis` (Task 8 shape), `data.tasks[].created` (Task 4), existing `setStatusFilter`, `renderTasks`, `toneOf`, `TONE_VAR`, `svgEl`, `attachTitle`, `openDetail`, `state`.
- Produces: `state.special` (`null | 'wip' | 'blocked'`) honored by `matches()`; mounts `#kpis`, `#aging`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('status kpis', () => {
  it('mounts KPI tiles and the aging strip in section 02', () => {
    const sec = /<section id="sec-02">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
    expect(sec).toContain('id="kpis"');
    expect(sec).toContain('id="aging"');
  });

  it('declares the approximation in tile tooltips and supports special filters', () => {
    expect(html).toContain('no status history');
    expect(html).toContain("state.special === 'wip'");
    expect(html).toContain("state.special === 'blocked'");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

`npx vitest run test/unit/dashboard-render.test.ts` — FAIL.

- [ ] **Step 3: Implement markup + CSS**

Section 02 becomes:

```html
<section id="sec-02">
  <div class="sec-head"><span class="sec-num">02</span><h2>Status</h2><span class="tagline">progress &middot; velocity &middot; wip &middot; age</span></div>
  <div id="kpis" class="mount"></div>
  <div id="donut" class="mount"></div>
  <h3 class="sub-head">Aging &mdash; open tasks by days in the backlog</h3>
  <div id="aging" class="mount"></div>
</section>
```

CSS (new block after the Donut styles):

```css
  /* ---------- KPI tiles ---------- */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 22px; }
  .kpi {
    display: block; text-align: left; font: inherit; color: inherit; cursor: default;
    background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px;
  }
  button.kpi { cursor: pointer; }
  button.kpi:hover { border-color: var(--accent); }
  button.kpi:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button.kpi[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-bg); }
  .kpi-big { font-family: var(--mono); font-size: 1.7rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .kpi-cap { display: block; color: var(--dim); font-size: .66rem; letter-spacing: 1.4px; text-transform: uppercase; margin-top: 4px; }
  .kpi-sub { display: block; font-size: .78rem; color: var(--muted); margin-top: 8px; }
  .kpi-sub[data-tone="ok"] { color: var(--ok); }
  .kpi-sub[data-tone="danger"] { color: var(--danger); }
  .kpi-link { font: inherit; background: none; border: none; padding: 0; color: var(--accent); cursor: pointer; font-family: var(--mono); font-size: .78rem; }
  .kpi-link:hover { filter: brightness(1.25); }
  /* ---------- Aging strip ---------- */
  .aging-lane-label { fill: var(--text); font-size: 12px; font-family: var(--mono); }
  .aging-axis { fill: var(--dim); font-size: 10px; font-family: var(--mono); }
  .aging-track { stroke: var(--line); }
  .age-dot { cursor: pointer; }
  .age-dot:hover { opacity: .8; }
```

- [ ] **Step 4: Implement JS**

Extend `state` initialization to `var state = { key: 'id', dir: 1, query: '', status: null, hoverStatus: null, special: null };` and extend `matches()` — insert before the query check:

```js
    if (state.special === 'wip' && !isWipStatus(task.status)) return false;
    if (state.special === 'blocked' && !isBlockedTask(task)) return false;
```

Add helpers next to `matches` (`depsOut` is a hoisted `var` — `undefined` until the dialog block runs, but `state.special` is always `null` before that, so the guard below is safe):

```js
  function isWipStatus(status) {
    var s = String(status || '').toLowerCase();
    return s.indexOf('progress') !== -1 || s === 'review';
  }
  function isBlockedTask(task) {
    var s = String(task.status || '').toLowerCase();
    if (isDoneStatus(task.status)) return false;
    if (s.indexOf('block') !== -1) return true;
    if (!depsOut) return false;
    var blockers = depsOut[task.id] || [];
    for (var i = 0; i < blockers.length; i++) {
      var dep = findTask(blockers[i]);
      if (dep && !isDoneStatus(dep.status)) return true;
    }
    return false;
  }
  function setSpecialFilter(kind) {
    state.special = state.special === kind ? null : kind;
    state.status = null;
    document.querySelectorAll('#pills .pill').forEach(function (pill) { pill.classList.remove('active'); });
    document.querySelectorAll('.kpi[data-special]').forEach(function (tile) {
      tile.setAttribute('aria-pressed', String(state.special === tile.getAttribute('data-special')));
    });
    renderTasks();
  }
```

Also clear `state.special = null;` inside `setStatusFilter` so pill filters and special filters never combine, and sync `aria-pressed` there too.

Renderers (place next to `renderDonut`):

```js
  var APPROX_TIP = 'Approximation from created/updated timestamps — Backlog.md keeps no status history.';
  function kpiTile(opts) {
    var node = el(opts.special ? 'button' : 'div', 'kpi');
    if (opts.special) {
      node.type = 'button';
      node.setAttribute('data-special', opts.special);
      node.setAttribute('aria-pressed', 'false');
      node.addEventListener('click', function () { setSpecialFilter(opts.special); });
    }
    node.setAttribute('data-tip', APPROX_TIP);
    node.appendChild(el('span', 'kpi-big', opts.big));
    node.appendChild(el('span', 'kpi-cap', opts.cap));
    if (opts.sub) {
      var sub = el('span', 'kpi-sub', opts.sub);
      if (opts.tone) sub.setAttribute('data-tone', opts.tone);
      node.appendChild(sub);
    }
    return node;
  }
  function renderKpis(mount, k) {
    mount.textContent = '';
    if (!k) return;
    var grid = el('div', 'kpi-grid');
    grid.appendChild(kpiTile({
      big: k.progressPct + '%', cap: 'complete',
      sub: k.done + ' / ' + k.total + ' done' + (k.forecastDate ? ' · at this pace done ~' + k.forecastDate : ''),
    }));
    var delta = k.velocity7 - k.velocityPrev7;
    grid.appendChild(kpiTile({
      big: String(k.velocity7), cap: 'done / last 7 days',
      sub: delta === 0 ? '± 0 vs previous week' : (delta > 0 ? '▲ +' : '▼ ') + delta + ' vs previous week',
      tone: delta > 0 ? 'ok' : delta < 0 ? 'danger' : undefined,
    }));
    grid.appendChild(kpiTile({
      big: String(k.wip), cap: 'in progress', special: 'wip',
      sub: k.blocked + ' blocked · click to filter', tone: k.blocked > 0 ? 'danger' : undefined,
    }));
    var age = kpiTile({
      big: k.oldestOpenDays === null ? '—' : k.oldestOpenDays + 'd', cap: 'oldest open task',
      sub: k.medianOpenAgeDays === null ? '' : 'median ' + k.medianOpenAgeDays + 'd open',
    });
    if (k.oldestOpenId) {
      var link = el('button', 'kpi-link', k.oldestOpenId);
      link.type = 'button';
      link.addEventListener('click', function () { openDetail(k.oldestOpenId); });
      age.appendChild(link);
    }
    grid.appendChild(age);
    mount.appendChild(grid);
  }
  function ageInDays(task) {
    var raw = task.created || task.updated;
    if (!raw) return null;
    var t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T12:00:00Z' : raw);
    if (isNaN(t)) return null;
    return Math.max(0, Math.round((Date.now() - t) / 86400000));
  }
  var STALE_DAYS = 14;
  function renderAging(mount, tasks) {
    mount.textContent = '';
    var lanes = [];
    var byStatus = {};
    tasks.forEach(function (t) {
      if (isDoneStatus(t.status)) return;
      var days = ageInDays(t);
      if (days === null) return;
      if (!byStatus[t.status]) { byStatus[t.status] = []; lanes.push(t.status); }
      byStatus[t.status].push({ task: t, days: days });
    });
    if (lanes.length === 0) {
      mount.appendChild(el('p', 'hint', 'No datable open tasks.'));
      return;
    }
    var maxDays = 1;
    lanes.forEach(function (s) { byStatus[s].forEach(function (e) { if (e.days > maxDays) maxDays = e.days; }); });
    var labelW = 130, w = 780, laneH = 34, padR = 20;
    var h = lanes.length * laneH + 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + w + ' ' + h, width: '100%', 'class': 'aging', role: 'img', 'aria-label': 'Open tasks by age in days' });
    lanes.forEach(function (s, i) {
      var y = i * laneH + 22;
      var lbl = svgEl('text', { x: labelW - 12, y: y + 4, 'text-anchor': 'end', 'class': 'aging-lane-label' });
      lbl.textContent = s;
      svg.appendChild(lbl);
      svg.appendChild(svgEl('line', { x1: labelW, y1: y, x2: w - padR, y2: y, 'class': 'aging-track' }));
      byStatus[s].forEach(function (e) {
        var cx = labelW + (w - labelW - padR) * e.days / maxDays;
        var dot = svgEl('circle', {
          cx: cx.toFixed(1), cy: y, r: 6, 'class': 'age-dot',
          fill: e.days >= STALE_DAYS ? 'var(--warn)' : TONE_VAR[toneOf(s)]
        });
        attachTitle(dot, e.task.id + ' · ' + e.task.title + ' · ' + e.days + 'd');
        dot.addEventListener('click', function () { openDetail(e.task.id); });
        svg.appendChild(dot);
      });
    });
    var axis0 = svgEl('text', { x: labelW, y: h - 4, 'class': 'aging-axis' });
    axis0.textContent = '0d';
    var axisMax = svgEl('text', { x: w - padR, y: h - 4, 'text-anchor': 'end', 'class': 'aging-axis' });
    axisMax.textContent = maxDays + 'd';
    svg.appendChild(axis0);
    svg.appendChild(axisMax);
    mount.appendChild(svg);
  }
```

Wire in the render-call block: `if ($('#kpis')) renderKpis($('#kpis'), data.kpis);` and `if ($('#aging')) renderAging($('#aging'), data.tasks);`.

- [ ] **Step 5: Run tests, refresh snapshot, commit**

`npx vitest run test/unit/dashboard-render.test.ts` → PASS after `-u`. Manual smoke: tiles show plausible numbers, WIP/blocked filter the table (and un-press when a sidebar pill is clicked), aging dots open the task modal, stale dots are amber, both themes legible.

```bash
git add src/templates/dashboard.html test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): status KPI tiles with wip/blocked filters and aging strip"
```

---

### Task 10: Activity — calendar heatmap, KPI strip, day panel

**Files:**
- Modify: `src/templates/dashboard.html` (section 07 markup, replace `renderSparkline`, CSS)
- Test: `test/unit/dashboard-render.test.ts`

**Interfaces:**
- Consumes: `data.activity` buckets with `ids` (Task 7), `data.kpis` activity fields (Task 8), `kpiTile(opts)` from Task 9, `findTask`, `openDetail`, `svgEl`, `attachTitle`, `el`.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing tests**

```ts
describe('activity heatmap', () => {
  it('replaces the sparkline with heatmap, kpis and day panel', () => {
    const sec = /<section id="sec-07">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
    expect(sec).toContain('id="activity-kpis"');
    expect(sec).toContain('id="heatmap"');
    expect(sec).toContain('id="day-panel"');
    expect(sec).toContain('last 26 weeks');
    expect(html).not.toContain('renderSparkline');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

`npx vitest run test/unit/dashboard-render.test.ts` — FAIL.

- [ ] **Step 3: Implement markup + CSS**

Section 07 (Activity) becomes:

```html
<section id="sec-07">
  <div class="sec-head"><span class="sec-num">07</span><h2>Activity</h2><span class="tagline">last 26 weeks &middot; click a day for its tasks</span></div>
  <div id="activity-kpis" class="mount"></div>
  <div id="heatmap" class="mount"></div>
  <div id="day-panel" class="flow-block" hidden></div>
</section>
```

CSS:

```css
  /* ---------- Activity heatmap ---------- */
  .hm-cell { cursor: pointer; }
  .hm-cell:hover { stroke: var(--accent); stroke-width: 1; }
  .hm-0 { fill: var(--surface-2); }
  .hm-1 { fill: var(--accent); opacity: .3; }
  .hm-2 { fill: var(--accent); opacity: .55; }
  .hm-3 { fill: var(--accent); opacity: .8; }
  .hm-4 { fill: var(--accent); }
  .hm-axis { fill: var(--dim); font-size: 9px; font-family: var(--mono); }
  #day-panel { margin-top: 16px; }
  #day-panel h4 { font-family: var(--mono); }
```

- [ ] **Step 4: Implement JS**

Delete `renderSparkline` (and its `$('#spark')` call). Add:

```js
  function weekdayName(idx, style) {
    /* 2024-01-07 was a Sunday; offset from it gives any weekday */
    var ref = new Date(Date.UTC(2024, 0, 7 + idx));
    try {
      return new Intl.DateTimeFormat(undefined, { weekday: style, timeZone: 'UTC' }).format(ref);
    } catch (e) {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx];
    }
  }
  function renderActivityKpis(mount, k) {
    mount.textContent = '';
    if (!k) return;
    var grid = el('div', 'kpi-grid');
    grid.appendChild(kpiTile({ big: String(k.activityTotal30), cap: 'tasks touched / 30 days' }));
    grid.appendChild(kpiTile({ big: String(k.activityAvgPerWeek), cap: 'avg per week (26w)' }));
    grid.appendChild(kpiTile({
      big: k.busiestWeekday === null ? '—' : weekdayName(k.busiestWeekday, 'long'),
      cap: 'most active day'
    }));
    grid.appendChild(kpiTile({ big: k.streakDays + 'd', cap: 'current streak' }));
    mount.appendChild(grid);
  }
  function renderDayPanel(panel, bucket) {
    panel.textContent = '';
    panel.hidden = false;
    var head = el('h4', '', bucket.date + ' — ' + bucket.count + ' task' + (bucket.count === 1 ? '' : 's'));
    panel.appendChild(head);
    var list = el('ul', 'flow-list');
    var shown = 0;
    bucket.ids.forEach(function (id) {
      var t = findTask(id);
      if (!t) return;
      shown++;
      var li = el('li', 'flow-card');
      var h = el('div', 'flow-card-head');
      h.appendChild(el('span', 'flow-card-id', t.id));
      var chip = el('span', 'status-chip', t.status);
      chip.setAttribute('data-tone', toneOf(t.status));
      h.appendChild(chip);
      li.appendChild(h);
      li.appendChild(el('div', 'flow-card-title', t.title));
      li.addEventListener('click', function () { openDetail(t.id); });
      list.appendChild(li);
    });
    if (shown === 0) panel.appendChild(el('p', 'flow-empty', 'No task details for this day.'));
    else panel.appendChild(list);
  }
  function renderHeatmap(mount, activity) {
    mount.textContent = '';
    if (!activity || activity.length === 0) {
      mount.appendChild(el('p', 'hint', 'No activity data.'));
      return;
    }
    var panel = document.getElementById('day-panel');
    var cell = 12, gap = 3, padL = 34, padT = 16;
    var first = new Date(activity[0].date + 'T00:00:00Z');
    var offset = first.getUTCDay();
    var cols = Math.ceil((activity.length + offset) / 7);
    var w = padL + cols * (cell + gap);
    var h = padT + 7 * (cell + gap) + 14;
    var max = 1;
    activity.forEach(function (b) { if (b.count > max) max = b.count; });
    var svg = svgEl('svg', { viewBox: '0 0 ' + w + ' ' + h, width: '100%', 'class': 'heatmap', role: 'img', 'aria-label': 'Daily task activity, last 26 weeks' });
    [1, 3, 5].forEach(function (row) {
      var lbl = svgEl('text', { x: padL - 6, y: padT + row * (cell + gap) + cell - 2, 'text-anchor': 'end', 'class': 'hm-axis' });
      lbl.textContent = weekdayName(row, 'short');
      svg.appendChild(lbl);
    });
    var lastMonth = '';
    activity.forEach(function (b, i) {
      var pos = i + offset;
      var col = Math.floor(pos / 7), row = pos % 7;
      var level = b.count === 0 ? 0 : Math.max(1, Math.ceil((b.count / max) * 4));
      var rect = svgEl('rect', {
        x: padL + col * (cell + gap), y: padT + row * (cell + gap),
        width: cell, height: cell, rx: 2.5,
        'class': 'hm-cell hm-' + level, 'data-date': b.date
      });
      attachTitle(rect, b.date + ': ' + b.count);
      rect.addEventListener('click', function () { if (panel) renderDayPanel(panel, b); });
      svg.appendChild(rect);
      var month = b.date.slice(0, 7);
      if (row === 0 && month !== lastMonth) {
        lastMonth = month;
        var m = svgEl('text', { x: padL + col * (cell + gap), y: padT - 5, 'class': 'hm-axis' });
        m.textContent = b.date.slice(5, 7);
        svg.appendChild(m);
      }
    });
    mount.appendChild(svg);
  }
```

Wire: `if ($('#activity-kpis')) renderActivityKpis($('#activity-kpis'), data.kpis);` and `if ($('#heatmap')) renderHeatmap($('#heatmap'), data.activity);` replacing the old spark call. Remove the now-unused `.spark-*` CSS rules **and** the `--spark-fill`/`--glow-accent-soft` tokens only if nothing else uses them (`--glow-accent-soft` stays if referenced elsewhere; verify with a search).

- [ ] **Step 5: Run tests, refresh snapshot, commit**

`npx vitest run test/unit/dashboard-render.test.ts` → PASS after `-u`. Manual smoke: heatmap shows the last 26 weeks, hover tooltips, clicking a day lists its tasks, KPI strip fills, both themes legible.

```bash
git add src/templates/dashboard.html test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(dashboard): activity calendar heatmap with day drill-down and KPI strip"
```

---

### Task 11: Full verification and docs touch-up

**Files:**
- Modify: `docs/guide/quickstart.md` (only if it names dashboard sections/features that moved), `cspell` dictionary if lint flags new words
- Test: whole suite

- [ ] **Step 1: Full suite**

Run: `npm test` (builds first, then all unit/integration/e2e vitest files).
Expected: PASS. Fix any straggler (integration tests serve the rendered template; none assert section numbers today, but verify).

- [ ] **Step 2: Lint**

Run: `npm run lint`. If cspell flags words from the new docs (e.g. "Jakarta"), add them to the cspell configuration file at the repo root rather than rewording.

- [ ] **Step 3: Docs check**

Grep `docs/guide/*.md` for "sec-0", "Activity", "model router", "sparkline" mentions that contradict the new layout; update the wording where stale. Do not regenerate the dashboard screenshot manually — CI's screenshot workflow does that on merge.

- [ ] **Step 4: Manual end-to-end pass**

`npm run dashboard` against this repo: walk all eight sections in both themes, exercise both modals (task + draft), model-router button, WIP/blocked filters, heatmap day panel, table sorting on every column, `/` focus shortcut, Escape closes dialogs.

- [ ] **Step 5: Commit and wrap up**

```bash
git add -A
git commit -m "chore(dashboard): verification pass and docs touch-up for redesign v2"
```

Then follow superpowers:verification-before-completion and superpowers:finishing-a-development-branch (PR against master; the `automerge` label applies per repo convention).
