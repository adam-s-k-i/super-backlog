// test/unit/summary-render.test.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DashboardData, DashboardTask } from '../../src/dashboard/data.js';
import { renderDashboard, tokensCss } from '../../src/dashboard/render.js';
import type { SummaryFacts } from '../../src/dashboard/summary-facts.js';
import {
  buildSummaryModel,
  buildSummaryView,
  codeMapHtml,
  emptyFacts,
  formatCount,
  noticeHtml,
  renderSummary,
  summaryFileFor,
  writeSummaryPage,
  type SummaryModel,
} from '../../src/dashboard/summary-render.js';
import { FLOORPLAN_INSTALL_COMMANDS, FLOORPLAN_REPO_URL, type FloorplanStatus } from '../../src/lib/floorplan.js';
import type { RunResult } from '../../src/lib/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS = readFileSync(join(here, '..', '..', 'src', 'templates', 'sbl-tokens.css'), 'utf8');

const TASKS: DashboardTask[] = [
  { id: 'T-1', title: 'Ship auth flow', status: 'Done', labels: ['phase/verify'], phase: 'verify', acs: [] },
  { id: 'T-2', title: 'Add OAuth refresh', status: 'In Progress', labels: ['phase/spec'], phase: 'spec', acs: [] },
  { id: 'T-3', title: 'Write <README>', status: 'To Do', labels: [], phase: null, acs: [] },
  { id: 'TASK-85', title: 'Parser', status: 'In Progress', labels: ['phase/impl'], phase: 'impl', acs: [] },
];

const DATA: DashboardData = {
  project: { name: 'demo-project', description: 'A demo <b>project</b>' },
  generatedAt: '2026-08-26T12:00:00.000Z',
  kitVersion: '0.1.0',
  latestVersion: null,
  statuses: [],
  milestones: [],
  tasks: TASKS,
  deps: [],
  activity: [],
  glossary: [],
  drafts: [],
  kpis: { throughput: [], leadTimeDays: null, wip: 0, blocked: 0 } as unknown as DashboardData['kpis'],
  source: 'backlog-json',
};

const FACTS: SummaryFacts = {
  ...emptyFacts(),
  name: 'super-backlog',
  version: '1.6.0',
  license: 'MIT',
  manifest: 'package.json',
  manifests: ['package.json'],
  dependencies: 3,
  devDependencies: 9,
  packages: [{ name: 'cross-spawn', group: 'Runtime', version: '7.0.6' } as SummaryFacts['packages'][number]],
  versions: { typescript: '7.0.2', vitest: '5.0.3', 'cross-spawn': '7.0.6' },
  extensions: ['.ts', '.mjs'],
  fileSource: 'git',
  sourceFiles: 212,
  loc: 31_480,
  testFiles: 96,
  releases: 14,
  workflows: 3,
  commands: [{ group: 'package.json scripts', entries: [{ run: 'npm test', note: 'vitest run' }] }],
};

const MAP: FloorplanStatus = { state: 'map', builtAt: '2026-11-28T10:00:00.000Z', files: 165, nodes: 11, commitsSince: 0 };
const model: SummaryModel = { facts: FACTS, map: { state: 'missing' }, renderError: null };
const withMap: SummaryModel = { ...model, map: MAP };

function island(html: string): unknown {
  const m = /<script type="application\/json" id="sbl-summary">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('no summary island');
  return JSON.parse(m[1]);
}

describe('buildSummaryView', () => {
  it('matches the snapshot', () => {
    expect(buildSummaryView(DATA, model)).toMatchSnapshot();
  });

  it('has exactly the facts-page keys (no architecture, no layout, no curated source)', () => {
    const v = buildSummaryView(DATA, withMap);
    expect(Object.keys(v)).toEqual(['project', 'pitchHtml', 'packageName', 'manifest', 'facts', 'tasks', 'commands', 'stack', 'source']);
    expect(Object.keys(v.source)).toEqual(['auto', 'warnings']);
  });

  it('lists open tasks only (D5)', () => {
    const v = buildSummaryView(DATA, model);
    expect(v.tasks.map((t) => t.id)).toEqual(['T-2', 'T-3', 'TASK-85']);
    expect(v.tasks[0]).toEqual({ id: 'T-2', title: 'Add OAuth refresh', status: 'In Progress', phase: 'spec' });
    expect(v.facts.at(-1)).toEqual({ value: '3', label: 'Open tasks' });
  });

  it('computes the six header facts on the server', () => {
    const v = buildSummaryView(DATA, model);
    expect(v.facts).toEqual([
      { value: '1.6.0', label: 'Version · MIT' },
      { value: '31k', label: 'Lines of code' },
      { value: '96', label: 'Test files' },
      { value: '3', label: 'Runtime dependencies' },
      { value: '14', label: 'Releases' },
      { value: '3', label: 'Open tasks' },
    ]);
    const approx = buildSummaryView(DATA, { ...model, facts: { ...FACTS, locApprox: true, releasesNote: 'git unavailable' } });
    expect(approx.facts[1].value).toBe('≈31k');
    expect(approx.facts[4].label).toBe('Releases (git unavailable)');
  });

  it('takes commands, packages and the pitch from the automatic facts', () => {
    const v = buildSummaryView(DATA, model);
    expect(v.commands).toEqual(FACTS.commands);
    expect(v.stack).toEqual([{ name: 'cross-spawn', group: 'Runtime', version: '7.0.6' }]);
    expect(v.pitchHtml).toBe('A demo &lt;b&gt;project&lt;/b&gt;');
  });

  it('uses singular nouns for counts of one on the data-source lines', () => {
    const one: SummaryFacts = { ...FACTS, sourceFiles: 1, releases: 1, releasesNote: null, dependencies: 1, devDependencies: 0 };
    const v = buildSummaryView(DATA, { ...model, facts: one });
    expect(v.source.auto.join('\n')).toMatch(/^1 source file \(/m);
    expect(v.source.auto).toContain('1 release from git version tags');
    expect(v.source.auto).toContain('1 runtime and 0 development dependency; versions from lockfiles where present');
  });

  it('names the Floorplan map as a data source only when a map exists', () => {
    const line = 'Code map from floorplan/graph.json (Floorplan)';
    expect(buildSummaryView(DATA, withMap).source.auto).toContain(line);
    expect(buildSummaryView(DATA, model).source.auto).not.toContain(line);
    expect(buildSummaryView(DATA, { ...model, map: { state: 'invalid', reason: 'not valid JSON' } }).source.auto).not.toContain(line);
    expect(buildSummaryView(DATA, { ...model, map: null }).source.auto).not.toContain(line);
  });

  it('passes facts warnings into the data source (E4)', () => {
    const v = buildSummaryView(DATA, { ...model, facts: { ...FACTS, warnings: ['package.json: bad'] } });
    expect(v.source.warnings).toEqual(['package.json: bad']);
  });
});

describe('escaping', () => {
  it('escapes the project name in title and app bar', () => {
    const html = renderSummary({ ...DATA, project: { ...DATA.project, name: 'x<y>"z' } }, model);
    expect(html).toContain('<title>x&lt;y&gt;&quot;z &middot; Project Summary</title>');
    expect(html).not.toContain('x<y>');
  });

  it('escapes < in the JSON island', () => {
    const html = renderSummary({ ...DATA, tasks: [{ ...TASKS[1], title: '</script><i>x' }] }, model);
    expect(html).not.toContain('</script><i>');
    expect((island(html) as { tasks: { title: string }[] }).tasks[0].title).toBe('</script><i>x');
  });
});

describe('noticeHtml', () => {
  it('is empty without a render error, whatever the map state', () => {
    expect(noticeHtml(model)).toBe('');
    expect(noticeHtml(withMap)).toBe('');
    expect(noticeHtml({ ...model, map: { state: 'invalid', reason: 'not valid JSON' } })).toBe('');
  });

  it('shows the render error (E3)', () => {
    const n = noticeHtml({ ...model, renderError: 'boom <x>' });
    expect(n).toContain('class="notice notice-error" role="alert"');
    expect(n).toContain('Summary could not be rendered (<code>boom &lt;x&gt;</code>)');
  });
});

describe('codeMapHtml', () => {
  const map = (over: Partial<Extract<FloorplanStatus, { state: 'map' }>> = {}): FloorplanStatus => ({ ...MAP, ...over } as FloorplanStatus);

  it('is empty when the status could not be read', () => {
    expect(codeMapHtml(null)).toBe('');
  });

  it('shows build date, counts and the Open map link for a current map', () => {
    expect(codeMapHtml(MAP)).toBe(
      '<section class="codemap" aria-label="Code map"><h2>Code map</h2>' +
        '<p>Floorplan map, built 2026-11-28, 165 files, 11 parts. <a class="maplink" href="../map/">Open map</a></p></section>',
    );
  });

  it('adds the commits since the build only when HEAD moved', () => {
    expect(codeMapHtml(map({ commitsSince: 3 }))).toContain('165 files, 11 parts, 3 commits since. <a');
    expect(codeMapHtml(map({ commitsSince: 1 }))).toContain('11 parts, 1 commit since. <a');
    expect(codeMapHtml(map({ commitsSince: null }))).toContain('11 parts. <a');
    expect(codeMapHtml(map({ commitsSince: null }))).not.toContain('since');
  });

  it('uses singular nouns for one file and one part', () => {
    expect(codeMapHtml(map({ files: 1, nodes: 1 }))).toContain('built 2026-11-28, 1 file, 1 part. <a');
  });

  it('shows the date in UTC', () => {
    expect(codeMapHtml(map({ builtAt: '2026-11-28T23:30:00-05:00' }))).toContain('built 2026-11-29,');
  });

  it('explains Floorplan and lists the install commands when there is no map', () => {
    const html = codeMapHtml({ state: 'missing' });
    expect(html).toContain('<section class="codemap" aria-label="Code map"><h2>Code map</h2>');
    expect(html).toContain(`<p>No code map yet. <a href="${FLOORPLAN_REPO_URL}">Floorplan</a> draws an interactive map of the codebase.`);
    expect(html).toContain('ask your agent to "make a floorplan".</p>');
    for (const run of FLOORPLAN_INSTALL_COMMANDS) {
      expect(html).toContain(`<code>${run}</code>`);
      expect(html).toContain(`data-copy="${run}" aria-label="Copy command: ${run}"`);
    }
    expect(html).not.toContain('../map/');
    expect(html).not.toContain('notice');
  });

  it('shows one neutral line with the escaped reason for an unreadable map', () => {
    const html = codeMapHtml({ state: 'invalid', reason: '<x> & "y"' });
    expect(html).toContain('<p>Floorplan map unreadable (&lt;x&gt; &amp; &quot;y&quot;). Ask your agent to update the floorplan.</p>');
    expect(html).not.toContain('../map/');
    expect(html).not.toContain('notice');
  });
});

describe('renderSummary template', () => {
  const html = renderSummary(DATA, withMap);

  it('replaces every placeholder', () => {
    expect(html).not.toMatch(/__[A-Z_]+__/);
  });

  it('fills placeholders in one pass: a project named like a placeholder stays literal', () => {
    const tricky = renderSummary({ ...DATA, project: { ...DATA.project, name: '__SBL_SUMMARY_JSON__' } }, model);
    expect(tricky).toContain('<title>__SBL_SUMMARY_JSON__ &middot; Project Summary</title>');
    expect((island(tricky) as { project: string }).project).toBe('__SBL_SUMMARY_JSON__');
  });

  it('defines colors only through tokens (no raw colors outside token blocks)', () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const tokens = tokensCss();
    expect(style.split(tokens).length - 1).toBe(1);
    const outsideTokens = style.replace(tokens, '');
    expect(outsideTokens).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(outsideTokens).not.toMatch(/\brgba?\(/);
  });

  it('carries the page marker the hub tests look for', () => {
    expect(html).toContain('<meta name="sbl-page" content="summary">');
  });

  it('subscribes to ../api/events and resolves the shared sbl-theme key before paint', () => {
    expect(html).toContain("new EventSource('../api/events')");
    expect(html).toContain("localStorage.getItem('sbl-theme')");
    expect(html.indexOf("localStorage.getItem('sbl-theme')")).toBeLessThan(html.indexOf('<body>'));
  });

  it('links the page tabs (R4): Dashboard ../, Summary current, Backlog ../bb/', () => {
    expect(html).toContain('<a href="../">Dashboard</a>');
    expect(html).toContain('<a href="./" aria-current="page">Summary</a>');
    expect(html).toContain('<a href="../bb/">Backlog</a>');
  });

  it('inlines the shared tokens, including the new hues', () => {
    expect(html).toContain('--violet:');
    expect(html).toContain('--rose:');
    expect(html).toContain('--on-color:');
  });

  it('carries the status toast and no diagram hooks', () => {
    expect(html).toContain('role="status"');
    for (const gone of ['id="canvas"', 'id="panel"', 'id="stage"', "role: 'group'", 'renderSVG', 'architecture.yml', 'S.architecture', 'S.layout', 'data-flow']) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it('places the Code map card between the head and the profile row', () => {
    const head = html.indexOf('id="head"');
    const card = html.indexOf('<section class="codemap"');
    const around = html.indexOf('id="around"');
    expect(head).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(head);
    expect(around).toBeGreaterThan(card);
    expect(html).toContain('<a class="maplink" href="../map/">Open map</a>');
  });

  it('renders no card when the map status is unknown', () => {
    expect(renderSummary(DATA, { ...model, map: null })).not.toContain('<section class="codemap"');
  });

  describe('profile row column layout (TASK-99)', () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';

    it('uses two tracks on wide screens', () => {
      expect(style).toMatch(/\.around\s*\{\s*display:grid;\s*grid-template-columns:\s*minmax\(0,\s*1\.6fr\)\s+minmax\(0,\s*1fr\);/);
    });

    it('keeps two equal columns at 980px', () => {
      expect(style).toMatch(/@media \(max-width:980px\)\s*\{\s*\.around\s*\{\s*grid-template-columns:\s*1fr 1fr;/);
    });

    it('collapses to one column at 640px', () => {
      expect(style).toMatch(/@media \(max-width:640px\)\s*\{\s*\.around\s*\{\s*grid-template-columns:\s*1fr;/);
    });

    it('has no layout variants left', () => {
      expect(style).not.toContain('.around.two');
      expect(style).not.toContain('.around.reduced');
      expect(html).not.toContain("classList.toggle('two'");
    });
  });
});

describe('sbl-tokens.css', () => {
  it('defines the new hues in both the dark and the light block', () => {
    const [dark, light] = TOKENS.split(':root[data-theme="light"]');
    for (const block of [dark, light]) {
      for (const token of ['--surface-3', '--violet', '--violet-bg', '--violet-line', '--rose', '--rose-bg', '--rose-line', '--on-accent', '--on-color']) {
        expect(block).toContain(`${token}:`);
      }
    }
  });

  it('is inlined into the dashboard as well', () => {
    expect(renderDashboard({ ...DATA, statuses: [], kpis: DATA.kpis })).not.toContain('__SBL_TOKENS_CSS__');
  });
});

describe('helpers', () => {
  it('summaryFileFor replaces the .html suffix', () => {
    expect(summaryFileFor('/tmp/sbl-dashboard-1-demo.html')).toBe('/tmp/sbl-dashboard-1-demo.summary.html');
    expect(summaryFileFor('C:\\x\\dashboard.HTML')).toBe('C:\\x\\dashboard.summary.html');
  });

  it.each([
    [0, '0'],
    [980, '980'],
    [5000, '5k'],
    [5234, '5.2k'],
    [48_213, '48k'],
  ])('formatCount(%i) = %s', (n, s) => {
    expect(formatCount(n)).toBe(s);
  });
});

describe('writeSummaryPage', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'sbl-summary-'));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });
  const noGit = (): RunResult => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });

  it('writes the page next to the dashboard file, with the install hint while there is no map', () => {
    const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), { runCapture: noGit });
    expect(file).toBe(join(cwd, 'dash.summary.html'));
    const html = readFileSync(file, 'utf8');
    expect(html).toContain('No code map yet');
    expect(html).not.toContain('Summary could not be rendered');
  });

  it('shows the map of the project directory', () => {
    mkdirSync(join(cwd, 'floorplan'));
    writeFileSync(join(cwd, 'floorplan', 'index.html'), '<!doctype html><title>map</title>');
    writeFileSync(
      join(cwd, 'floorplan', 'graph.json'),
      JSON.stringify({ meta: { generatedAt: '2026-11-28T10:00:00.000Z', counts: { files: 2 } }, nodes: [{}] }),
    );
    const html = readFileSync(writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), { runCapture: noGit }), 'utf8');
    expect(html).toContain('Floorplan map, built 2026-11-28, 2 files, 1 part. <a class="maplink" href="../map/">Open map</a>');
  });

  it('degrades to the facts with the error notice when the map status throws (E3)', () => {
    let lsFiles = 0;
    const counting = (cmd: string, args: string[]): RunResult => {
      if (cmd === 'git' && args[0] === 'ls-files') lsFiles++;
      return noGit();
    };
    const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), {
      runCapture: counting,
      readFloorplanStatus: () => {
        throw new Error('status exploded');
      },
    });
    const html = readFileSync(file, 'utf8');
    expect(html).toContain('Summary could not be rendered (<code>status exploded</code>)');
    expect(html).not.toContain('<section class="codemap"'); // unknown status: no card, no "No code map yet" claim
    expect(lsFiles).toBe(1); // the facts are collected once and reused by the fallback
  });

  it('never throws, even when the target cannot be written', () => {
    writeFileSync(join(cwd, 'blocker'), 'a file where a directory is expected');
    const target = join(cwd, 'blocker', 'dash.html');
    expect(() => writeSummaryPage(cwd, DATA, target, { runCapture: noGit })).not.toThrow();
    expect(existsSync(summaryFileFor(target))).toBe(false);
  });

  it('logs a failed summary write to stderr and still returns', () => {
    writeFileSync(join(cwd, 'blocker'), 'a file where a directory is expected');
    const target = join(cwd, 'blocker', 'dash.html');
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      expect(() => writeSummaryPage(cwd, DATA, target, { runCapture: noGit })).not.toThrow();
      const out = err.mock.calls.map((c) => String(c[0])).join('');
      expect(out).toContain(`sbl: could not write the summary page ${summaryFileFor(target)}: `);
    } finally {
      err.mockRestore();
    }
  });
});

describe('buildSummaryModel', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'sbl-summary-model-'));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });
  const noGit = (): RunResult => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });

  it('reads the map status through the injected seam and records progress', () => {
    const seen: string[] = [];
    const progress: { facts?: SummaryFacts; map?: FloorplanStatus } = {};
    const m = buildSummaryModel(
      cwd,
      {
        runCapture: noGit,
        readFloorplanStatus: (c) => {
          seen.push(c);
          return MAP;
        },
      },
      progress,
    );
    expect(seen).toEqual([cwd]);
    expect(m.map).toBe(MAP);
    expect(m.renderError).toBeNull();
    expect(progress.facts).toBe(m.facts);
    expect(progress.map).toBe(MAP);
  });

  it('passes runCapture on to the default status reader', () => {
    mkdirSync(join(cwd, 'floorplan'));
    writeFileSync(join(cwd, 'floorplan', 'index.html'), '<!doctype html>');
    writeFileSync(
      join(cwd, 'floorplan', 'graph.json'),
      JSON.stringify({
        meta: { generatedAt: '2026-11-28T10:00:00.000Z', counts: { files: 2 }, repos: [{ path: '.', head: 'a'.repeat(40) }] },
        nodes: [{}],
      }),
    );
    const runCapture = (cmd: string, args: string[]): RunResult =>
      cmd === 'git' && args[0] === 'rev-list' ? { status: 0, stdout: '4\n', stderr: '' } : noGit();
    expect(buildSummaryModel(cwd, { runCapture }).map).toEqual({
      state: 'map',
      builtAt: '2026-11-28T10:00:00.000Z',
      files: 2,
      nodes: 1,
      commitsSince: 4,
    });
  });

  it('reports a missing map for a project without floorplan/', () => {
    expect(buildSummaryModel(cwd, { runCapture: noGit }).map).toEqual({ state: 'missing' });
  });
});
