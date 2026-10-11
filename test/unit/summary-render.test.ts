// test/unit/summary-render.test.ts
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DashboardData, DashboardTask } from '../../src/dashboard/data.js';
import { renderDashboard, tokensCss } from '../../src/dashboard/render.js';
import type { SummaryFacts } from '../../src/dashboard/summary-facts.js';
import { SUMMARY_PROMPTS } from '../../src/dashboard/summary-drift.js';
import { layoutArchitecture } from '../../src/dashboard/summary-layout.js';
import {
  buildSummaryModel,
  buildSummaryView,
  emptyFacts,
  formatCount,
  formatPitch,
  MAX_NOTICE_PROBLEMS,
  noticeHtml,
  renderSummary,
  summaryFileFor,
  writeSummaryPage,
  type SummaryModel,
} from '../../src/dashboard/summary-render.js';
import { ARCHITECTURE_PATH, checkArchitectureText, type ArchitectureLoadResult } from '../../src/dashboard/summary-schema.js';
import type { RunResult } from '../../src/lib/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(here, '..', 'fixtures', 'summary', 'architecture.super-backlog.yml'), 'utf8');
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

function validModel(text = FIXTURE): SummaryModel {
  const load = checkArchitectureText(text, ARCHITECTURE_PATH);
  if (load.status !== 'valid') throw new Error(`fixture invalid: ${JSON.stringify(load)}`);
  return { facts: FACTS, load, layout: layoutArchitecture(load.architecture), renderError: null, drift: null };
}
const missing: ArchitectureLoadResult = { status: 'missing', path: ARCHITECTURE_PATH };
const reducedModel: SummaryModel = { facts: FACTS, load: missing, layout: null, renderError: null, drift: null };

function island(html: string): unknown {
  const m = /<script type="application\/json" id="sbl-summary">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('no summary island');
  return JSON.parse(m[1]);
}

describe('buildSummaryView', () => {
  it('full view (valid architecture) keeps a stable structure', () => {
    const v = buildSummaryView(DATA, validModel());
    expect({
      keys: Object.keys(v),
      facts: v.facts.map((f) => f.label),
      nodes: v.architecture?.nodes.map((n) => n.id),
      edges: v.architecture?.edges.map((e) => e.id),
      flows: v.architecture?.flows.map((f) => f.id),
      layoutNodes: v.layout?.nodes.map((n) => n.id),
      layoutEdges: v.layout?.edges.map((e) => `${e.id}:${e.kind}`),
      zones: v.layout?.zones.map((z) => z.label),
      warnings: v.source.warnings.length,
      tasks: v.tasks.map((t) => `${t.id}:${t.node ?? '-'}`),
      commands: v.commands.map((c) => `${c.group}:${c.entries.length}`),
      stack: v.stack.map((s) => s.name),
      source: v.source,
    }).toMatchSnapshot();
  });

  it('reduced view (no architecture file) matches the snapshot', () => {
    expect(buildSummaryView(DATA, reducedModel)).toMatchSnapshot();
  });

  it('lists open tasks only (D5) and maps them to nodes from tasks:', () => {
    const v = buildSummaryView(DATA, validModel());
    expect(v.tasks.map((t) => t.id)).toEqual(['T-2', 'T-3', 'TASK-85']);
    expect(v.tasks.find((t) => t.id === 'TASK-85')?.node).toBe('hub');
    expect(v.tasks.find((t) => t.id === 'T-2')?.node).toBeNull();
    expect(v.facts.at(-1)).toEqual({ value: '3', label: 'Open tasks' });
  });

  it('computes the six header facts on the server', () => {
    const v = buildSummaryView(DATA, reducedModel);
    expect(v.facts).toEqual([
      { value: '1.6.0', label: 'Version · MIT' },
      { value: '31k', label: 'Lines of code' },
      { value: '96', label: 'Test files' },
      { value: '3', label: 'Runtime dependencies' },
      { value: '14', label: 'Releases' },
      { value: '3', label: 'Open tasks' },
    ]);
    const approx = buildSummaryView(DATA, { ...reducedModel, facts: { ...FACTS, locApprox: true, releasesNote: 'git unavailable' } });
    expect(approx.facts[1].value).toBe('≈31k');
    expect(approx.facts[4].label).toBe('Releases (git unavailable)');
  });

  it('falls back to automatic commands and packages without a curated file', () => {
    const v = buildSummaryView(DATA, reducedModel);
    expect(v.architecture).toBeNull();
    expect(v.layout).toBeNull();
    expect(v.commands).toEqual(FACTS.commands);
    expect(v.stack).toEqual([{ name: 'cross-spawn', group: 'Runtime', version: '7.0.6', role: '', nodes: [] }]);
    expect(v.pitchHtml).toBe('A demo &lt;b&gt;project&lt;/b&gt;');
  });

  it('looks up stack versions as own properties only (no prototype hits for constructor/toString)', () => {
    const stack = [
      '  - { name: constructor, group: Runtime, role: odd package name, nodes: [hub] }',
      '  - { name: Strings, package: toString, group: Runtime, role: another, nodes: [hub] }',
      '  - { name: Own, package: hasOwnProperty, group: Runtime, role: own key, nodes: [hub] }',
    ].join('\n');
    const text = FIXTURE.replace(/^stack:\r?\n(?: {2}- .*\r?\n)+/m, `stack:\n${stack}\n`);
    expect(text).not.toBe(FIXTURE);
    const model = validModel(text);
    const v = buildSummaryView(DATA, { ...model, facts: { ...FACTS, versions: { ...FACTS.versions, hasOwnProperty: '1.0.0' } } });
    expect(v.stack.map((s) => [s.name, s.version])).toEqual([
      ['constructor', ''],
      ['Strings', ''],
      ['Own', '1.0.0'],
    ]);
  });

  it('uses singular nouns for counts of one on the data-source lines', () => {
    const one: SummaryFacts = { ...FACTS, sourceFiles: 1, releases: 1, releasesNote: null, dependencies: 1, devDependencies: 0 };
    const load = checkArchitectureText(
      [
        'schema: 1',
        'pitch: p',
        'grid: { cols: 2, rows: 2 }',
        'nodes:',
        '  - { id: a, label: A, kind: core, cell: [0, 0] }',
        '  - { id: b, label: B, kind: core, cell: [1, 0] }',
        'edges:',
        '  - { from: a, to: b, label: x }',
        'flows:',
        '  - { id: f, label: F, steps: [a>b] }',
        'highlights:',
        '  - { node: a, title: T, text: t }',
        'stack:',
        '  - { name: S, group: G, nodes: [a] }',
        'commands:',
        '  Dev:',
        '    - { run: x }',
        'tasks:',
        '  T-2: a',
        '',
      ].join('\n'),
      ARCHITECTURE_PATH,
    );
    if (load.status !== 'valid') throw new Error('invalid');
    const v = buildSummaryView(DATA, { facts: one, load, layout: layoutArchitecture(load.architecture), renderError: null, drift: null });
    expect(v.source.auto.join('\n')).toMatch(/^1 source file \(/m);
    expect(v.source.auto).toContain('1 release from git version tags');
    expect(v.source.auto).toContain('1 runtime and 0 development dependency; versions from lockfiles where present');
    expect(v.source.curated).toEqual([
      'Pitch, 2 components, 1 connection, 1 flow',
      '1 highlight, 1 stack entry, 1 command group',
      '1 task-to-component mapping (status comes from the backlog CLI)',
    ]);
  });

  it('collects schema, layout and facts warnings into the data source (E4)', () => {
    const model = validModel();
    model.layout = { ...model.layout!, warnings: [{ code: 'route-fallback', edge: 'a-b', message: 'no clean route' } as never] };
    const v = buildSummaryView(DATA, { ...model, facts: { ...FACTS, warnings: ['package.json: bad'] } });
    expect(v.source.warnings).toEqual(['layout route-fallback a-b: no clean route', 'package.json: bad']);
  });
});

describe('formatPitch and escaping', () => {
  it('escapes first, then allows only **bold**', () => {
    expect(formatPitch('A **fast** <script>x</script> "q" & y')).toBe(
      'A <b>fast</b> &lt;script&gt;x&lt;/script&gt; &quot;q&quot; &amp; y',
    );
    expect(formatPitch('**<i>x</i>**')).toBe('<b>&lt;i&gt;x&lt;/i&gt;</b>');
  });

  it('keeps every other curated string raw in the view and escapes < in the JSON island', () => {
    const evil = FIXTURE.replace(/^ {4}label: .*$/m, '    label: "</script><i>**b**"');
    const html = renderSummary(DATA, validModel(evil));
    expect(html).not.toContain('</script><i>');
    expect(html).toContain('\\u003c/script>\\u003ci>**b**');
    const v = island(html) as { architecture: { nodes: { label: string }[] } };
    expect(v.architecture.nodes.some((n) => n.label === '</script><i>**b**')).toBe(true);
  });

  it('escapes the project name in title and app bar', () => {
    const html = renderSummary({ ...DATA, project: { ...DATA.project, name: 'x<y>"z' } }, reducedModel);
    expect(html).toContain('<title>x&lt;y&gt;&quot;z &middot; Project Summary</title>');
    expect(html).not.toContain('x<y>');
  });
});

describe('noticeHtml', () => {
  it('is empty for a valid file', () => {
    expect(noticeHtml(validModel())).toBe('');
  });

  it('explains the missing file and links the docs (D6, E1)', () => {
    const n = noticeHtml(reducedModel);
    expect(n).toContain('No architecture file yet');
    expect(n).toContain('<code>architecture-summary</code>');
    expect(n).toContain('<code>backlog/docs/architecture.yml</code>');
  });

  it('lists at most 20 problems as path: message, then "and K more" (E2)', () => {
    const problems = Array.from({ length: 23 }, (_, i) => ({ path: `nodes[${i}].id`, message: `bad <id> ${i}`, level: 'error' as const }));
    const n = noticeHtml({ ...reducedModel, load: { status: 'invalid', path: ARCHITECTURE_PATH, problems } });
    expect(n.match(/<li>/g)).toHaveLength(MAX_NOTICE_PROBLEMS);
    expect(n).toContain('<li><code>nodes[0].id</code>: bad &lt;id&gt; 0</li>');
    expect(n).not.toContain('nodes[20].id');
    expect(n).toContain('… and 3 more');
    expect(n).toContain('has 23 problems');
  });

  it('renders the notice into the page for an invalid file and keeps the reduced view', () => {
    const load = checkArchitectureText('schema: 2\n', ARCHITECTURE_PATH);
    expect(load.status).toBe('invalid');
    const html = renderSummary(DATA, { facts: FACTS, load, layout: null, renderError: null, drift: null });
    expect(html).toContain('class="notice notice-error" role="alert"');
    expect((island(html) as { architecture: unknown }).architecture).toBeNull();
  });

  it('shows the render error (E3)', () => {
    const n = noticeHtml({ ...reducedModel, renderError: 'boom <x>' });
    expect(n).toContain('Summary could not be rendered (<code>boom &lt;x&gt;</code>)');
  });

  it('adds a copy button with the missing prompt to the missing-file notice', () => {
    const n = noticeHtml(reducedModel);
    expect(n).toContain(`<button class="copy" type="button" data-copy="${SUMMARY_PROMPTS.missing}"`);
    expect(n).toContain('aria-label="Copy the prompt for your agent"');
  });

  it('shows the drift banner with count, labels and a copy button for a valid file', () => {
    const n = noticeHtml({
      ...validModel(),
      drift: { count: 3, codes: ['missing-path', 'done-task'], prompt: SUMMARY_PROMPTS.drift },
    });
    expect(n).toContain('<div class="notice notice-drift" role="status">');
    expect(n).toContain('3 drift findings (missing paths, Done tasks) – the diagram may be out of date');
    expect(n).toContain(`data-copy="${SUMMARY_PROMPTS.drift}"`);
  });

  it('labels every drift code and uses the singular for one finding', () => {
    const n = noticeHtml({
      ...validModel(),
      drift: { count: 1, codes: ['unknown-task', 'stale-file'], prompt: SUMMARY_PROMPTS.drift },
    });
    expect(n).toContain('1 drift finding (unknown tasks, stale file)');
  });

  it('escapes the prompt in the copy attribute', () => {
    const n = noticeHtml({ ...validModel(), drift: { count: 1, codes: ['done-task'], prompt: 'say "hi" <now> & \'go\'' } });
    expect(n).toContain('data-copy="say &quot;hi&quot; &lt;now&gt; &amp; &#39;go&#39;"');
  });

  it('renders the banner into the page with the subtle notice style', () => {
    const html = renderSummary(DATA, {
      ...validModel(),
      drift: { count: 2, codes: ['done-task'], prompt: SUMMARY_PROMPTS.drift },
    });
    expect(html).toContain('class="notice notice-drift" role="status"');
    expect(html).toMatch(/\.notice-drift \{[^}]*var\(--surface-2\)/);
    expect(html).toContain('.notice p .copy {');
  });
});

describe('renderSummary template', () => {
  const html = renderSummary(DATA, validModel());

  it('replaces every placeholder', () => {
    expect(html).not.toMatch(/__[A-Z_]+__/);
  });

  it('fills placeholders in one pass: a project named like a placeholder stays literal', () => {
    const tricky = renderSummary({ ...DATA, project: { ...DATA.project, name: '__SBL_SUMMARY_JSON__' } }, validModel());
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

  it('carries the accessibility hooks (role=group, aria-live panel, status toast)', () => {
    expect(html).toContain('id="panel" aria-live="polite"');
    expect(html).toContain('role="status"');
    expect(html).toContain("role: 'group'");
    expect(html).toContain("role: 'button'");
  });

  describe('profile row column layout (TASK-99)', () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';

    it('uses two tracks for .around.two on wide screens', () => {
      expect(style).toMatch(/\.around\.two\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1\.6fr\)\s+minmax\(0,\s*1fr\);/);
    });

    it('keeps two equal columns at 980px for both variants', () => {
      expect(style).toMatch(/@media \(max-width:980px\)\s*\{[^}]*\.around,\s*\.around\.two\s*\{\s*grid-template-columns:\s*1fr 1fr;/);
    });

    it('collapses both variants to one column at 640px', () => {
      expect(style).toMatch(/@media \(max-width:640px\)\s*\{[^}]*\.around,\s*\.around\.two\s*\{\s*grid-template-columns:\s*1fr;/);
    });

    it('renderAround toggles the two class on missing highlights', () => {
      expect(html).toContain("around.classList.toggle('two', !(A && A.highlights.length));");
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

  it('writes the reduced page next to the dashboard file when no architecture file exists', () => {
    const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), { runCapture: noGit });
    expect(file).toBe(join(cwd, 'dash.summary.html'));
    const html = readFileSync(file, 'utf8');
    expect(html).toContain('No architecture file yet');
  });

  it('degrades to the reduced view with the error notice when layout throws (E3)', () => {
    const load = checkArchitectureText(FIXTURE, ARCHITECTURE_PATH);
    const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), {
      runCapture: noGit,
      loadArchitecture: () => load,
      layoutArchitecture: () => {
        throw new Error('layout exploded');
      },
    });
    const html = readFileSync(file, 'utf8');
    expect(html).toContain('Summary could not be rendered (<code>layout exploded</code>)');
    expect((island(html) as { architecture: unknown }).architecture).toBeNull();
  });

  it('never throws, even when the target cannot be written', () => {
    writeFileSync(join(cwd, 'blocker'), 'a file where a directory is expected');
    const target = join(cwd, 'blocker', 'dash.html');
    expect(() => writeSummaryPage(cwd, DATA, target, { runCapture: noGit })).not.toThrow();
    expect(existsSync(summaryFileFor(target))).toBe(false);
  });

  it('collects facts only once when the layout throws, and does not claim the file is missing (E3)', () => {
    const load = checkArchitectureText(FIXTURE, ARCHITECTURE_PATH);
    let lsFiles = 0;
    const counting = (cmd: string, args: string[]): RunResult => {
      if (cmd === 'git' && args[0] === 'ls-files') lsFiles++;
      return noGit();
    };
    const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), {
      runCapture: counting,
      loadArchitecture: () => load,
      layoutArchitecture: () => {
        throw new Error('layout exploded');
      },
    });
    expect(lsFiles).toBe(1);
    const curated = (island(readFileSync(file, 'utf8')) as { source: { curated: string[] } }).source.curated;
    expect(curated).toEqual([`${ARCHITECTURE_PATH} was not shown because the summary could not be rendered; see the notice above.`]);
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

describe('buildSummaryModel drift (spec 2026-10-10)', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'sbl-summary-drift-'));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });
  const noGit = (): RunResult => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });
  const valid = checkArchitectureText(FIXTURE, ARCHITECTURE_PATH);

  it('loads with task ids for the page and without for drift, and summarizes the findings', () => {
    const calls: unknown[] = [];
    let seenTasks: unknown;
    const model = buildSummaryModel(cwd, DATA, {
      runCapture: noGit,
      loadArchitecture: (_c, opts) => {
        calls.push(opts?.taskIds);
        return valid;
      },
      detectDrift: (_c, _a, opts) => {
        seenTasks = opts.tasks;
        return {
          findings: [
            { code: 'missing-path', path: 'nodes.cli.files', message: 'x does not exist' },
            { code: 'done-task', path: 'tasks.T-1', message: 'T-1 is Done' },
          ],
          notes: [],
        };
      },
    });
    expect(calls).toEqual([TASKS.map((t) => t.id), undefined]);
    expect(seenTasks).toEqual(TASKS.map((t) => ({ id: t.id, status: t.status })));
    expect(model.drift).toEqual({ count: 2, codes: ['missing-path', 'done-task'], prompt: SUMMARY_PROMPTS.drift });
  });

  it('is null without findings', () => {
    const model = buildSummaryModel(cwd, DATA, {
      runCapture: noGit,
      loadArchitecture: () => valid,
      detectDrift: () => ({ findings: [], notes: ['task signals skipped: backlog CLI unavailable'] }),
    });
    expect(model.drift).toBeNull();
  });

  it('passes null tasks when the dashboard data fell back', () => {
    let seenTasks: unknown = 'unset';
    buildSummaryModel(cwd, { ...DATA, source: 'fallback-empty' }, {
      runCapture: noGit,
      loadArchitecture: () => valid,
      detectDrift: (_c, _a, opts) => {
        seenTasks = opts.tasks;
        return { findings: [], notes: [] };
      },
    });
    expect(seenTasks).toBeNull();
  });

  it('skips drift for a missing file', () => {
    let ran = false;
    const model = buildSummaryModel(cwd, DATA, {
      runCapture: noGit,
      detectDrift: () => {
        ran = true;
        return { findings: [], notes: [] };
      },
    });
    expect(ran).toBe(false);
    expect(model.drift).toBeNull();
  });

  it('never throws when the drift check throws', () => {
    const model = buildSummaryModel(cwd, DATA, {
      runCapture: noGit,
      loadArchitecture: () => valid,
      detectDrift: () => {
        throw new Error('boom');
      },
    });
    expect(model.drift).toBeNull();
  });
});
