// test/unit/dashboard-render.test.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PIPELINE_PHASES, renderDashboard } from '../../src/dashboard/render.js';
import type { DashboardActivityBucket, DashboardData } from '../../src/dashboard/data.js';

function buckets(nonZero: Record<number, number>): DashboardActivityBucket[] {
  const start = Date.UTC(2026, 6, 28); // 2026-07-28
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    count: nonZero[i] ?? 0,
  }));
}

const SAMPLE: DashboardData = {
  project: { name: 'demo-project', description: 'A demo <b>project</b>' },
  generatedAt: '2026-08-26T12:00:00.000Z',
  kitVersion: '0.1.0',
  statuses: [
    { status: 'Done', count: 1 },
    { status: 'In Progress', count: 2 },
    { status: 'To Do', count: 1 },
  ],
  milestones: [
    { name: 'M1', done: 1, total: 2 },
    { name: 'M2', done: 0, total: 2 },
  ],
  tasks: [
    {
      id: 'T-1', title: 'Ship auth flow', status: 'Done', priority: 'high', assignee: 'adam',
      updated: '2026-08-20', milestone: 'M1', description: 'Handles <script>alert(1)</script> safely',
      acs: [{ text: 'login works', checked: true }],
    },
    {
      id: 'T-2', title: 'Add OAuth refresh', status: 'In Progress', priority: 'medium', assignee: 'kim',
      updated: '2026-08-21', milestone: 'M1',
      acs: [{ text: 'token rotation', checked: true }, { text: 'docs updated', checked: false }],
    },
    {
      id: 'T-3', title: 'Write README', status: 'To Do', priority: 'low', milestone: 'M2',
      acs: [],
    },
    {
      id: 'T-4', title: 'Polish UI', status: 'In Progress', milestone: 'M2', updated: '2026-08-22',
      acs: [{ text: 'dark mode', checked: false }],
    },
  ],
  deps: [
    { from: 'T-2', to: 'T-1' },
    { from: 'T-4', to: 'T-2' },
  ],
  activity: buckets({ 0: 1, 25: 2, 29: 1 }),
  glossary: [
    { term: 'AC', definition: 'Acceptance criterion.' },
    { term: 'Review Gate', definition: 'Human checkpoint before proceeding.' },
  ],
  source: 'backlog-json',
};

const html = renderDashboard(SAMPLE);

function islandOf(doc: string, id: string): string {
  const m = new RegExp(`<script type="application\\/json" id="${id}">([\\s\\S]*?)<\\/script>`).exec(doc);
  return m?.[1] ?? '';
}

const SECTIONS = [
  ['01', 'Board & Quick Actions'],
  ['02', 'Status'],
  ['03', 'Milestones'],
  ['04', 'Tasks'],
  ['05', 'Feature Cycle'],
  ['06', 'Activity'],
  ['07', 'Decisions & Docs'],
] as const;

describe('renderDashboard v2 structure', () => {
  it('matches the approved snapshot', () => {
    expect(html).toMatchSnapshot();
  });

  it('starts with <!doctype html>', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('renders a fixed sidebar with project badge and kicker line', () => {
    expect(html).toContain('<aside class="sbl-side">');
    const aside = /<aside class="sbl-side">([\s\S]*?)<\/aside>/.exec(html)?.[1] ?? '';
    expect(aside).toContain('●');
    expect(aside).toContain('demo-project');
    expect(aside).toContain('SUPERPOWERS × BACKLOG.MD');
  });

  it('nav links to all seven numbered sections', () => {
    const aside = /<aside class="sbl-side">([\s\S]*?)<\/aside>/.exec(html)?.[1] ?? '';
    for (const [num] of SECTIONS) {
      expect(aside).toContain(`href="#sec-${num}"`);
    }
    for (const [, label] of SECTIONS) {
      expect(aside).toContain(label.replace('&', '&amp;'));
    }
  });

  it('emits live status pills with counts', () => {
    expect(html).toContain('class="pill"');
    expect(html).toMatch(/class="pill"[^>]*data-status="Done"/);
    expect(html).toMatch(/class="pill"[^>]*data-status="Done"[^>]*data-count="1"/);
    expect(html).toMatch(/data-status="In Progress"[^>]*data-count="2"/);
    expect(html).toMatch(/data-status="To Do"[^>]*data-count="1"/);
  });

  it('contains seven numbered main sections with HTS-style sec-heads', () => {
    for (const [num, label] of SECTIONS) {
      const section = new RegExp(`<section id="sec-${num}">([\\s\\S]*?)</section>`).exec(html)?.[1];
      expect(section, `section sec-${num}`).toBeTruthy();
      expect(section).toContain('<div class="sec-head">');
      expect(section).toContain(`>${num}<`);
      expect(section).toContain('<h2>');
      expect(section).toContain(label.replace('&', '&amp;'));
      expect(section).toContain('class="tagline"');
    }
  });

  it('keeps an empty mount element per diagram/content slot', () => {
    for (const mount of ['#quickactions', '#donut', '#bars', '#tasks', '#stepper', '#spark', '#docs']) {
      expect(html).toContain(`id="${mount.slice(1)}"`);
    }
  });

  it('retains the v1 sortable/filterable task table shell inside #tasks', () => {
    const tasksSection = /<section id="sec-04">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
    expect(tasksSection).toContain('id="taskfilter"');
    expect(tasksSection).toContain('id="tasks-table"');
    expect(tasksSection).toContain('data-key="status"');
    expect(tasksSection).toContain('id="task-rows"');
  });

  it('carries the exact HTS design tokens', () => {
    for (const token of [
      '--bg:#0a0e16',
      '--surface:#111826',
      '--line:#1e293c',
      '--line-strong:#2c3b57',
      '--text:#e8edf6',
      '--muted:#8fa0ba',
      '--dim:#5d6d88',
      '--accent:#5cc8ff',
      '--ok:#3ecf8e',
      '--warn:#ffb454',
      '--danger:#ff7a7a',
      '--ok-bg:',
      '--warn-bg:',
      '--danger-bg:',
      '--accent-dim:',
    ]) {
      expect(html).toContain(token);
    }
    expect(html).toContain('@font-face');
    expect(html).toContain("font-family: 'Inter'");
    expect(html).toContain('"Cascadia Code"');
    expect(html).toContain('Consolas');
    expect(html).toContain('"Segoe UI"');
  });

  it('is dark-only: no prefers-color-scheme block anywhere', () => {
    expect(html).not.toMatch(/prefers-color-scheme/);
  });

  it('collapses the sidebar under 900px', () => {
    expect(html).toMatch(/@media \(max-width:\s*900px\)/);
  });

  it('references no external URLs', () => {
    expect(html).not.toContain('src="http');
    expect(html).not.toContain('href="http');
  });

  it('ships an inline SVG favicon', () => {
    expect(html).toContain('<link rel="icon"');
    expect(html).toContain('data:image/svg+xml');
    expect(html).toContain("fill='%235cc8ff'");
  });
});

describe('renderDashboard data islands', () => {
  it('embeds the JSON data island with < escaped as \\u003c', () => {
    const island = islandOf(html, 'sbl-data');
    expect(island).toBeTruthy();
    const parsed = JSON.parse(island) as DashboardData;
    expect(parsed.project.name).toBe('demo-project');
    expect(parsed.tasks).toHaveLength(4);
    expect(parsed.deps).toEqual(SAMPLE.deps);
    // the XSS probe never survives unescaped
    expect(html).not.toContain('<script>alert');
    expect(island).not.toContain('<');
    expect(parsed.tasks[0]?.description).toBe('Handles <script>alert(1)</script> safely');
  });

  it('embeds the glossary island consumed by tooltips later', () => {
    const island = islandOf(html, 'sbl-glossary');
    expect(island).toBeTruthy();
    const parsed = JSON.parse(island) as DashboardData['glossary'];
    expect(parsed).toEqual(SAMPLE.glossary);
  });
});

describe('renderDashboard footer', () => {
  it('shows generated-at, kit version and the freshness note', () => {
    const footer = /<footer[^>]*>([\s\S]*?)<\/footer>/.exec(html)?.[1] ?? '';
    expect(footer).toContain('2026-08-26T12:00:00.000Z');
    expect(footer).toContain('v0.1.0');
    expect(footer).toContain('regenerated automatically on commits touching backlog/');
  });
});

describe('inline app budget', () => {
  it('keeps the inline app script within 650 lines of vanilla JS', () => {
    const m = /<script id="sbl-app">([\s\S]*?)<\/script>/.exec(html);
    expect(m).toBeTruthy();
    const lines = (m?.[1] ?? '').split('\n').length;
    expect(lines).toBeLessThanOrEqual(650);
  });
});

function appScript(): string {
  const m = /<script id="sbl-app">([\s\S]*?)<\/script>/.exec(html);
  return m?.[1] ?? '';
}

describe('client diagrams: donut, bars, sparkline, stepper', () => {
  it('defines the four global SVG builder functions', () => {
    const app = appScript();
    for (const fn of ['renderDonut(', 'renderBars(', 'renderSparkline(', 'renderStepper(']) {
      expect(app).toContain(`function ${fn}`);
    }
  });

  it('builds SVG nodes with createElementNS and donut segments via stroke-dasharray', () => {
    const app = appScript();
    expect(app).toContain('createElementNS');
    expect(app).toContain('stroke-dasharray');
    expect(app).toContain('stroke-dashoffset');
  });

  it('donut shows the center total in mono at 2rem and hover-filters by status', () => {
    const app = appScript();
    expect(app).toMatch(/'class': 'donut-total'/);
    expect(html).toMatch(/\.donut-total[^}]*font-size:\s*2rem/);
    expect(app).toContain('hoverStatus');
  });

  it('sparkline emits polyline + area with a <title> tooltip per point', () => {
    const app = appScript();
    expect(app).toContain('polyline');
    expect(app).toContain("svgEl('title'");
    expect(app).toMatch(/b\.date\s*\+\s*': '\s*\+\s*b\.count/);
  });

  it('stepper renders all nine phases from the sbl-phases island', () => {
    const island = islandOf(html, 'sbl-phases');
    expect(island).toBeTruthy();
    const phases = JSON.parse(island) as Array<Record<string, unknown>>;
    expect(phases).toHaveLength(9);
    expect(phases.map((p) => p['name'])).toEqual(PIPELINE_PHASES.map((p) => p.name));
    const app = appScript();
    expect(app).toContain("getElementById('sbl-phases')");
    expect(app).toContain('step-num');
    expect(app).toContain('step-label');
  });

  it('bootstraps every diagram into its section mount', () => {
    const app = appScript();
    for (const mount of ['donut', 'bars', 'stepper', 'spark']) {
      expect(app).toContain(`'${mount}'`);
    }
  });
});

describe('client dependency flow', () => {
  it('provides a #depgraph mount inside the feature cycle section', () => {
    const sec5 = /<section id="sec-05">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
    expect(sec5).toContain('id="depgraph"');
  });

  it('ships a renderFlow() that classifies pending tasks as Up Next or Blocked', () => {
    const app = appScript();
    expect(app).toContain('function renderFlow(');
    expect(app).toContain('Up Next');
    expect(app).toContain('Blocked');
    expect(app).toContain('Blocked by:');
  });

  it('uses isDoneStatus() to treat done/completed statuses as finished', () => {
    const app = appScript();
    expect(app).toContain('function isDoneStatus(');
    expect(app).toContain("s === 'done'");
    expect(app).toContain("s === 'complete'");
  });

  it('renders flow cards with status chips and blocker links', () => {
    const app = appScript();
    expect(app).toContain("'flow-card'");
    expect(app).toContain("'flow-card-id'");
    expect(app).toContain("'flow-card-title'");
    expect(app).toContain("'flow-card-blockers'");
    expect(app).toContain("'dep-link'");
  });
});

describe('tooltips, glossary terms and detail panel', () => {
  it('ships the single floating tooltip element and task dialog shell', () => {
    expect(html).toContain('id="sbl-tip"');
    expect(html).toContain('<dialog id="task-dialog"');
    expect(html).not.toContain('id="sbl-detail"');
    expect(html).not.toContain('id="sbl-backdrop"');
  });

  it('renders task titles with normal font weight', () => {
    expect(html).toMatch(/\.cell-title\s*\{[^}]*font-weight:\s*400/);
  });

  it('wraps the core glossary terms in static section copy', () => {
    for (const term of ['DoD', 'Milestone', 'Review Gate', 'TDD']) {
      expect(html, `term span for ${term}`).toContain(`data-term="${term}"`);
      expect(html, `class=term for ${term}`).toMatch(
        new RegExp(`<span class="term" data-term="${term}">`),
      );
    }
  });

  it('resolves data-term lookups case-insensitively from the sbl-glossary island', () => {
    const app = appScript();
    expect(app).toContain("getElementById('sbl-glossary')");
    expect(app).toContain('toLowerCase()');
    expect(app).toContain("'[data-tip],[data-term]'");
  });

  it('wires openDetail/closeDetail with dialog.showModal/close, backdrop click and clickable deps', () => {
    const app = appScript();
    expect(app).toContain('function openDetail(');
    expect(app).toContain('function closeDetail(');
    expect(app).toContain('dialog.showModal');
    expect(app).toContain('dialog.close');
    expect(app).toContain("addEventListener('click'");
    expect(app).toContain('__sblOpenDetail');
    expect(app.match(/Escape/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it('binds delegation for hover and focus tooltips with viewport clamping', () => {
    const app = appScript();
    expect(app).toContain("addEventListener('mouseover'");
    expect(app).toContain("addEventListener('focusin'");
    expect(app).toContain('innerWidth');
    expect(app).toContain('innerHeight');
  });

  it('focuses #taskfilter on / and drives the table filter from pills + donut segments', () => {
    const app = appScript();
    expect(app).toContain("key === '/'");
    expect(app).toContain("getElementById('taskfilter')");
    expect(app).toContain('#pills .pill');
    expect(app).toContain('setStatusFilter');
    expect(app).toMatch(/\.seg['"],|seg\.addEventListener\('click'/);
  });
});

describe('PIPELINE_PHASES', () => {
  it('has exactly nine phases in workflow order', () => {
    expect(PIPELINE_PHASES).toHaveLength(9);
    expect(PIPELINE_PHASES.map((p) => p.name)).toEqual([
      'Idea',
      'Brainstorming',
      'Design gate',
      'Spec-to-backlog',
      'Review gate',
      'Plan-before-code',
      'TDD implementation',
      'Verification & final summary',
      'Merge & archive',
    ]);
  });

  it('stays consistent with the injected workflow-block.md phase table', () => {
    const block = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'templates', 'workflow-block.md'),
      'utf8',
    );
    const tableNames = [...block.matchAll(/^\|\s*\d+\s*\|\s*(.+?)\s*\|/gm)].map((m) => m[1]);
    expect(tableNames).toEqual(PIPELINE_PHASES.map((p) => p.name));
  });
});

describe('carried Batch B review fixes', () => {
  it('tipShow hides the stale tooltip when term text resolves to empty (unresolved [data-term])', () => {
    const app = appScript();
    // falsy text must hide the tooltip instead of silently keeping the previous one visible
    expect(app).toMatch(
      /function tipShow\(text, x, y\) \{\s*if \(!tip\) return;\s*if \(!text\) \{ tip\.hidden = true; return; \}/,
    );
  });

  it('task rows set data-task and open the modal on click', () => {
    const app = appScript();
    expect(app).toContain("tr.setAttribute('data-task', task.id)");
    expect(app).toContain("openDetail(task.id)");
    expect(app).not.toContain("'task-detail'");
  });

  it('task titles are no longer bold in the table', () => {
    const app = appScript();
    expect(app).not.toMatch(/\.cell-title\s*\{[^}]*font-weight:\s*(bold|5\d\d|6\d\d|700)/);
  });
});

describe('live-reload script', () => {
  const liveScript = (): string => {
    // the live-reload snippet is the last inline script before </body>
    const m = /(<script>\s*\(function \(\) \{[\s\S]*?EventSource[\s\S]*?)<\/script>/.exec(html);
    return m?.[1] ?? '';
  };

  it('embeds an EventSource client that reloads on the reload event', () => {
    const live = liveScript();
    expect(live).not.toBe('');
    expect(live).toContain("new EventSource('/api/events')");
    expect(live).toContain("'reload'");
    expect(live).toContain('location.reload()');
  });

  it('only connects over http(s) so file:// usage stays silent', () => {
    const live = liveScript();
    expect(live).toContain('location.protocol');
    expect(live).toMatch(/https?/);
  });
});
