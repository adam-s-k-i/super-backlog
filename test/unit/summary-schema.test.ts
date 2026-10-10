// test/unit/summary-schema.test.ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ARCHITECTURE_PATH,
  checkArchitectureText,
  DEFAULT_KINDS,
  loadArchitecture,
  type ArchitectureLoadResult,
  type SchemaProblem,
} from '../../src/dashboard/summary-schema.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'summary');
const fixture = (name: string): string => readFileSync(join(FIXTURES, `architecture.${name}.yml`), 'utf8');

const BASE = [
  'schema: 1',
  'pitch: A **small** demo.',
  'grid: { cols: 3, rows: 2 }',
  'nodes:',
  '  - { id: a, label: Alpha, kind: core, cell: [0, 0] }',
  '  - { id: b, label: Beta, kind: output, cell: [2, 0] }',
  '  - { id: c, label: Gamma, kind: external, cell: [2, 1] }',
  'edges:',
  '  - { from: a, to: b, label: calls }',
  '  - { from: b, to: c, label: writes }',
];

function check(lines: string[], taskIds?: string[]): ArchitectureLoadResult {
  return checkArchitectureText(`${lines.join('\n')}\n`, 'architecture.yml', taskIds);
}

function problems(r: ArchitectureLoadResult): SchemaProblem[] {
  return r.status === 'missing' ? [] : r.problems;
}

function expectError(r: ArchitectureLoadResult, path: string, message: RegExp): void {
  expect(r.status).toBe('invalid');
  expect(problems(r)).toContainEqual({ path, message: expect.stringMatching(message), level: 'error' });
}

/** BASE with the line starting with `prefix` replaced (or appended when absent). */
function withLine(prefix: string, line: string): string[] {
  const i = BASE.findIndex((l) => l.startsWith(prefix));
  return i === -1 ? [...BASE, line] : [...BASE.slice(0, i), line, ...BASE.slice(i + 1)];
}

describe('validateArchitecture: valid input', () => {
  it('accepts the minimal file and applies the default kinds', () => {
    const r = check(BASE);
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.problems).toEqual([]);
    expect(r.architecture.kinds).toEqual(DEFAULT_KINDS);
    expect(r.architecture.edges.map((e) => e.id)).toEqual(['a>b', 'b>c']);
    expect(r.architecture.pitch).toBe('A **small** demo.');
  });

  it('validates the spec example (super-backlog fixture) without problems', () => {
    const r = checkArchitectureText(fixture('super-backlog'), 'x');
    expect(r.status).toBe('valid');
    expect(problems(r)).toEqual([]);
    if (r.status !== 'valid') return;
    expect(r.architecture.nodes).toHaveLength(13);
    expect(r.architecture.flows.map((f) => [f.id, f.color])).toEqual([
      ['init', 'accent'],
      ['update', 'warn'],
      ['dashboard', 'ok'],
      ['uninstall', 'rose'],
    ]);
    expect(r.architecture.highlights.map((h) => [h.badge, h.node])).toEqual([
      [1, 'planner'],
      [2, 'project'],
      [3, 'ownership'],
      [4, 'hub'],
    ]);
    expect(r.architecture.tasks).toEqual({ 'TASK-85': 'hub' });
  });

  it('validates the kursbuchung fixture (custom kinds) without problems', () => {
    const r = checkArchitectureText(fixture('kursbuchung'), 'x');
    expect(r.status).toBe('valid');
    expect(problems(r)).toEqual([]);
    if (r.status !== 'valid') return;
    expect(Object.keys(r.architecture.kinds)).toEqual(['actor', 'theme', 'plugin', 'ops', 'ext']);
    expect(r.architecture.kinds.ext).toEqual({ label: 'externer Dienst', color: 'dim', dashed: true });
  });
});

describe('validateArchitecture: one test per rule', () => {
  it('requires schema', () => {
    expectError(check(BASE.slice(1)), 'schema', /required/);
  });

  it('rejects an unsupported schema version', () => {
    expectError(check(withLine('schema:', 'schema: 2')), 'schema', /unsupported/);
  });

  it('requires pitch', () => {
    expectError(check(BASE.filter((l) => !l.startsWith('pitch:'))), 'pitch', /required/);
  });

  it('rejects an unknown kind', () => {
    const lines = withLine('  - { id: c', '  - { id: c, label: Gamma, kind: service, cell: [2, 1] }');
    expectError(check(lines), 'nodes[2].kind', /unknown kind "service"/);
  });

  it('rejects a duplicate cell', () => {
    const lines = withLine('  - { id: c', '  - { id: c, label: Gamma, kind: external, cell: [2, 0] }');
    expectError(check(lines), 'nodes[2].cell', /already used by "b"/);
  });

  it('rejects a cell outside the grid with the grid size in the message', () => {
    const lines = withLine('  - { id: c', '  - { id: c, label: Gamma, kind: external, cell: [3, 1] }');
    expectError(check(lines), 'nodes[2].cell', /^outside grid 3x2$/);
  });

  it('rejects a duplicate node id', () => {
    const lines = withLine('  - { id: c', '  - { id: b, label: Gamma, kind: external, cell: [2, 1] }');
    expectError(check(lines), 'nodes[2].id', /duplicate id "b"/);
  });

  it('rejects a dangling edge', () => {
    const lines = withLine('  - { from: b', '  - { from: b, to: zz, label: writes }');
    expectError(check(lines), 'edges[1].to', /unknown node "zz"/);
  });

  it('rejects a self edge and a duplicate edge', () => {
    expectError(check(withLine('  - { from: b', '  - { from: b, to: b, label: loops }')), 'edges[1]', /must differ/);
    expectError(check(withLine('  - { from: b', '  - { from: a, to: b, label: again }')), 'edges[1]', /duplicate edge a -> b/);
  });

  it('rejects overlapping zones', () => {
    const lines = [
      ...BASE,
      'zones:',
      '  - { label: Left, cols: [0, 1], rows: [0, 1] }',
      '  - { label: Middle, cols: [1, 2], rows: [1, 1] }',
    ];
    expectError(check(lines), 'zones[1]', /overlaps zones\[0\] \(Left\)/);
  });

  it('rejects a zone outside the grid', () => {
    expectError(check([...BASE, 'zones:', '  - { label: Wide, cols: [0, 3], rows: [0, 0] }']), 'zones[0]', /outside grid 3x2/);
  });

  it('drops a flow whose step names no edge, with a warning', () => {
    const lines = [...BASE, 'flows:', '  - { id: ok, label: Fine, steps: [a>b, b>c] }', '  - { id: bad, label: Broken, steps: [a>b, a>c] }'];
    const r = check(lines);
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.architecture.flows.map((f) => f.id)).toEqual(['ok']);
    expect(r.problems).toEqual([{ path: 'flows[1].steps', message: 'no edge a>c; flow "bad" dropped', level: 'warning' }]);
  });

  it('assigns default flow colors in sequence and honours an explicit color', () => {
    const lines = [
      ...BASE,
      'flows:',
      '  - { id: f1, label: One, steps: [a>b] }',
      '  - { id: f2, label: Two, color: violet, steps: [a>b] }',
      '  - { id: f3, label: Three, steps: [b>c] }',
    ];
    const r = check(lines);
    expect(r.status === 'valid' && r.architecture.flows.map((f) => f.color)).toEqual(['accent', 'violet', 'warn']);
  });

  it('rejects a second highlight on the same node', () => {
    const lines = [...BASE, 'highlights:', '  - { node: a, title: One, text: first }', '  - { node: a, title: Two, text: second }'];
    expectError(check(lines), 'highlights[1].node', /already carries highlight 1/);
  });

  it('enforces size limits on lists and strings', () => {
    const many = Array.from({ length: 41 }, (_, i) => `  - { id: n${i}, label: N, kind: core, cell: [0, 0] }`);
    expectError(check(['schema: 1', 'pitch: x', 'grid: { cols: 3, rows: 2 }', 'nodes:', ...many, 'edges:', '  - { from: n0, to: n1, label: x }']), 'nodes', /at most 40 entries \(found 41\)/);
    expectError(check(withLine('pitch:', `pitch: ${'p'.repeat(401)}`)), 'pitch', /at most 400 characters/);
    expectError(check(withLine('  - { id: a', `  - { id: a, label: ${'L'.repeat(29)}, kind: core, cell: [0, 0] }`)), 'nodes[0].label', /at most 28/);
    expectError(check(withLine('  - { from: a', `  - { from: a, to: b, label: ${'l'.repeat(25)} }`)), 'edges[0].label', /at most 24/);
    expectError(check(withLine('grid:', 'grid: { cols: 9, rows: 2 }')), 'grid.cols', /from 2 to 8/);
  });

  it('requires at least two nodes and one edge', () => {
    const r = check(['schema: 1', 'pitch: x', 'grid: { cols: 2, rows: 2 }', 'nodes:', '  - { id: a, label: A, kind: core, cell: [0, 0] }', 'edges: []']);
    expect(problems(r)).toEqual(
      expect.arrayContaining([
        { path: 'nodes', message: 'at least 2 entries (found 1)', level: 'error' },
        { path: 'edges', message: 'at least 1 entries (found 0)', level: 'error' },
      ]),
    );
  });

  it('rejects multi-line commands', () => {
    const lines = withLine('  - { id: a', '  - id: a\n    label: Alpha\n    kind: core\n    cell: [0, 0]\n    commands:\n      - run: |\n          one\n          two');
    expectError(check(lines), 'nodes[0].commands[0].run', /single line/);
  });

  it('warns about an unknown task id and ignores it; matching is case-insensitive', () => {
    const lines = [...BASE, 'tasks:', '  task-7: a', '  TASK-99: b'];
    const r = check(lines, ['TASK-7']);
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.architecture.tasks).toEqual({ 'TASK-7': 'a' });
    expect(r.problems).toEqual([{ path: 'tasks.TASK-99', message: 'unknown task id "TASK-99", ignored', level: 'warning' }]);
  });

  it('warns about a dangling stack node and keeps the entry', () => {
    const r = check([...BASE, 'stack:', '  - { name: Node.js, group: Runtime, nodes: [a, ghost] }']);
    expect(r.status === 'valid' && r.architecture.stack).toEqual([{ name: 'Node.js', group: 'Runtime', nodes: ['a'] }]);
    expect(problems(r)).toEqual([{ path: 'stack[0].nodes[1]', message: 'unknown node "ghost", ignored', level: 'warning' }]);
  });

  it('rejects kinds with an unknown color token', () => {
    const lines = [...BASE.slice(0, 3), 'kinds:', '  core: { label: Core, color: red }', '  output: { label: Out, color: ok }', '  external: { label: Ext, color: dim, dashed: true }', ...BASE.slice(3)];
    expectError(check(lines), 'kinds.core.color', /must be one of accent, ok, warn, violet, rose, muted, dim/);
  });

  it('reports a parse error as one problem with line and column', () => {
    const r = checkArchitectureText('schema: 1\npitch: &a x\n', 'architecture.yml');
    expect(r).toEqual({
      status: 'invalid',
      path: 'architecture.yml',
      problems: [{ path: 'line 2, column 8', message: expect.stringMatching(/anchor/), level: 'error' }],
    });
  });
});

describe('loadArchitecture', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sbl-arch-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports a missing file without throwing', () => {
    expect(loadArchitecture(dir)).toEqual({ status: 'missing', path: join(dir, 'backlog', 'docs', 'architecture.yml') });
  });

  it('reads backlog/docs/architecture.yml and returns typed data', () => {
    mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
    writeFileSync(join(dir, ...ARCHITECTURE_PATH.split('/')), fixture('super-backlog'));
    const r = loadArchitecture(dir, { taskIds: ['TASK-85'] });
    expect(r.status).toBe('valid');
    expect(r.status === 'valid' && r.architecture.nodes[0].id).toBe('dev');
  });

  it('returns invalid with a problem for 8000 levels of "- -" instead of throwing', () => {
    mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
    writeFileSync(join(dir, 'backlog', 'docs', 'architecture.yml'), `${'- '.repeat(8000)}x`);
    const r = loadArchitecture(dir);
    expect(r.status).toBe('invalid');
    expect(problems(r)).toEqual([{ path: 'line 1, column 65', message: expect.stringMatching(/nesting too deep/), level: 'error' }]);
  });

  it('returns errors with path and message for an invalid file', () => {
    mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
    writeFileSync(join(dir, 'backlog', 'docs', 'architecture.yml'), 'schema: 1\n');
    const r = loadArchitecture(dir);
    expect(r.status).toBe('invalid');
    expect(problems(r).map((p) => p.path)).toEqual(['pitch', 'grid', 'nodes', 'edges']);
  });
});

describe('checkArchitectureText: hostile input never throws', () => {
  it('returns invalid with a line/column problem for 8000 levels of "- -"', () => {
    const r = checkArchitectureText(`${'- '.repeat(8000)}x`, 'architecture.yml');
    expect(r).toEqual({
      status: 'invalid',
      path: 'architecture.yml',
      problems: [{ path: 'line 1, column 65', message: expect.stringMatching(/nesting too deep/), level: 'error' }],
    });
  });

  it('turns any other parser error into an error-level problem instead of rethrowing', async () => {
    vi.resetModules();
    vi.doMock('../../src/lib/yamlmini.js', async (importOriginal) => ({
      ...(await importOriginal<typeof import('../../src/lib/yamlmini.js')>()),
      parseYamlSubset: () => {
        throw new RangeError('Maximum call stack size exceeded');
      },
    }));
    try {
      const mod = await import('../../src/dashboard/summary-schema.js');
      expect(mod.checkArchitectureText('schema: 1\n', 'architecture.yml')).toEqual({
        status: 'invalid',
        path: 'architecture.yml',
        problems: [{ path: ARCHITECTURE_PATH, message: 'cannot parse file (RangeError: Maximum call stack size exceeded)', level: 'error' }],
      });
    } finally {
      vi.doUnmock('../../src/lib/yamlmini.js');
      vi.resetModules();
    }
  });
});
