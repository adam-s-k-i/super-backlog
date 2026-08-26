// test/unit/dashboard-render.test.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PIPELINE_PHASES, renderDashboard } from '../../src/dashboard/render.js';
import type { DashboardData } from '../../src/dashboard/data.js';

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
  source: 'backlog-json',
  deps: [],
  activity: [],
  glossary: [],
};

const html = renderDashboard(SAMPLE);

function islandOf(doc: string): string {
  const m = /<script type="application\/json" id="sbl-data">([\s\S]*?)<\/script>/.exec(doc);
  if (!m) return '';
  return m[1];
}

describe('renderDashboard contract', () => {
  it('matches the approved snapshot', () => {
    expect(html).toMatchSnapshot();
  });

  it('starts with <!doctype html>', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('embeds the JSON data island with < escaped as \\u003c', () => {
    const island = islandOf(html);
    expect(island).toBeTruthy();
    const parsed = JSON.parse(island) as DashboardData;
    expect(parsed.project.name).toBe('demo-project');
    expect(parsed.tasks).toHaveLength(4);
    // the XSS probe never survives unescaped
    expect(html).not.toContain('<script>alert');
    expect(island).not.toContain('<');
    expect(parsed.tasks[0]?.description).toBe('Handles <script>alert(1)</script> safely');
  });

  it('contains all four section headings', () => {
    for (const heading of ['Overview', 'Milestones', 'Tasks', 'Workflow cheat sheet']) {
      expect(html).toContain(heading);
    }
  });

  it('contains the quick-command strings', () => {
    expect(html).toContain('backlog browser');
    expect(html).toContain('sbl dashboard --serve');
  });

  it('references no external URLs', () => {
    expect(html).not.toContain('src="http');
    expect(html).not.toContain('href="http');
  });

  it('keeps the inline app script within 150 lines of vanilla JS', () => {
    const m = /<script id="sbl-app">([\s\S]*?)<\/script>/.exec(html);
    expect(m).toBeTruthy();
    const lines = (m?.[1] ?? '').split('\n').length;
    expect(lines).toBeLessThanOrEqual(150);
  });

  it('uses prefers-color-scheme for dark/light and a system font stack', () => {
    expect(html).toMatch(/@media \(prefers-color-scheme: dark\)/);
    expect(html).toMatch(/font-family:[^;]*(system-ui|-apple-system|Segoe UI)/);
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

  it('renders every phase into the cheat-sheet grid', () => {
    for (const phase of PIPELINE_PHASES) {
      // static content is HTML-escaped by the renderer (& → &amp;)
      expect(html).toContain(phase.name.replace(/&/g, '&amp;'));
    }
  });
});
