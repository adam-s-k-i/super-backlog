import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runDoctor, type DoctorDeps } from '../../src/commands/doctor.js';
import { layoutArchitecture } from '../../src/dashboard/summary-layout.js';
import { checkArchitectureText, loadArchitecture } from '../../src/dashboard/summary-schema.js';

const ARCH_OK = [
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
  '',
].join('\n');

interface DepsWithLines extends DoctorDeps {
  lines: string[];
}

function makeDeps(overrides: Partial<DepsWithLines> = {}): DepsWithLines {
  const lines: string[] = [];
  return {
    lines,
    platform: 'win32',
    nodeVersion: '22.14.0',
    executor: () => ({ status: 0, stdout: 'RemoteSigned', stderr: '' }),
    resolveBacklog: () => 'C:\\proj\\node_modules\\.bin\\backlog.cmd',
    readTaskLabels: () => [],
    loadArchitecture: () => checkArchitectureText(ARCH_OK, 'architecture.yml'),
    detectDrift: () => ({ findings: [], notes: [] }),
    log: (line: string) => lines.push(line),
    ...overrides,
  };
}

describe('runDoctor', () => {
  it('reports all checks as ok and exits 0 on a healthy win32 environment', () => {
    const deps = makeDeps();
    const code = runDoctor('C:\\proj', deps);
    expect(code).toBe(0);
    expect(deps.lines.some((l) => l.includes('[ok]') && l.includes('node v22.14.0'))).toBe(true);
    expect(deps.lines.some((l) => l.includes('[ok]') && l.includes('RemoteSigned'))).toBe(true);
    expect(deps.lines.some((l) => l.includes('[ok]') && l.includes('backlog.cmd'))).toBe(true);
  });

  it('warns with the one-time fix and exits 4 under Restricted policy', () => {
    const deps = makeDeps({
      executor: () => ({ status: 0, stdout: 'Restricted\n', stderr: '' }),
    });
    const code = runDoctor('C:\\proj', deps);
    expect(code).toBe(4);
    expect(deps.lines.some((l) => l.includes('[warn]') && l.includes('Restricted'))).toBe(true);
    expect(deps.lines.join('\n')).toContain('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  });

  it('exits 4 under AllSigned policy too', () => {
    const deps = makeDeps({
      executor: () => ({ status: 0, stdout: 'AllSigned', stderr: '' }),
    });
    expect(runDoctor('C:\\proj', deps)).toBe(4);
  });

  it('skips the policy check off win32 without spawning anything', () => {
    let spawned = false;
    const deps = makeDeps({
      platform: 'linux',
      executor: () => {
        spawned = true;
        return { status: 0, stdout: 'Restricted', stderr: '' };
      },
    });
    const code = runDoctor('/proj', deps);
    expect(code).toBe(0);
    expect(spawned).toBe(false);
    expect(deps.lines.some((l) => l.includes('[skip]'))).toBe(true);
  });

  it('treats a failed detection as skip rather than warn', () => {
    const deps = makeDeps({
      executor: () => ({ status: null, stdout: '', stderr: 'powershell missing' }),
    });
    const code = runDoctor('C:\\proj', deps);
    expect(code).toBe(0);
    expect(deps.lines.filter((l) => l.includes('[skip]')).length).toBe(1);
  });

  it('flags an old node version as warn', () => {
    const deps = makeDeps({ nodeVersion: '18.19.1' });
    const code = runDoctor('C:\\proj', deps);
    expect(code).toBe(4);
    expect(deps.lines.some((l) => l.includes('[warn]') && l.includes('node v18.19.1'))).toBe(true);
  });

  it('accepts node exactly at v20', () => {
    const deps = makeDeps({ nodeVersion: '20.0.0' });
    expect(runDoctor('C:\\proj', deps)).toBe(0);
  });

  it('warns when the backlog binary is not resolvable', () => {
    const deps = makeDeps({ resolveBacklog: () => null });
    const code = runDoctor('C:\\proj', deps);
    expect(code).toBe(4);
    expect(deps.lines.some((l) => l.includes('[warn]') && l.includes('backlog'))).toBe(true);
  });

  it('still exits 4 with multiple warnings', () => {
    const deps = makeDeps({
      nodeVersion: '16.4.0',
      resolveBacklog: () => null,
      executor: () => ({ status: 0, stdout: 'Restricted', stderr: '' }),
    });
    expect(runDoctor('C:\\proj', deps)).toBe(4);
    expect(deps.lines.filter((l) => l.includes('[warn]')).length).toBe(3);
  });
});

describe('check 4: phase label hygiene', () => {
  interface TaskRow { id: string; status: string; labels: string[]; }

  const PHASE_FIXTURES: TaskRow[] = [
    { id: 'TASK-1', status: 'To Do', labels: ['feature', 'phase/spec'] },
    { id: 'TASK-2', status: 'In Progress', labels: ['phase/impl'] },
  ];

  function phaseDeps(rows: TaskRow[] | null) {
    return makeDeps({ readTaskLabels: () => rows });
  }

  it('ok when labels are clean', () => {
    const d = phaseDeps(PHASE_FIXTURES);
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines.some((l) => l.includes('phase label hygiene clean (2 tasks)'))).toBe(true);
  });

  it('warns on In Progress without phase label (legacy)', () => {
    const d = phaseDeps([{ id: 'TASK-3', status: 'In Progress', labels: ['feature'] }]);
    expect(runDoctor('/proj', d)).toBe(4);
    expect(d.lines.some((l) => l.includes('TASK-3: In Progress without phase label'))).toBe(true);
    expect(d.lines.some((l) => l.includes('fix: sbl phase TASK-3 spec'))).toBe(true);
  });

  it('fails on multiple phase labels', () => {
    const d = phaseDeps([{ id: 'TASK-4', status: 'To Do', labels: ['phase/spec', 'phase/impl'] }]);
    expect(runDoctor('/proj', d)).toBe(1);
    expect(d.lines.some((l) => l.includes('[fail]') && l.includes('TASK-4: multiple phase labels'))).toBe(true);
  });

  it('fails on unknown phase label values', () => {
    const d = phaseDeps([{ id: 'TASK-5', status: 'To Do', labels: ['phase/deploy'] }]);
    expect(runDoctor('/proj', d)).toBe(1);
    expect(d.lines.some((l) => l.includes('TASK-5: unknown phase label phase/deploy'))).toBe(true);
    expect(d.lines.some((l) => l.includes('backlog task edit TASK-5 --remove-label phase/deploy'))).toBe(true);
  });

  it('skips when task labels are unreadable', () => {
    const d = phaseDeps(null);
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines.some((l) => l.includes('[skip]') && l.includes('phase label hygiene'))).toBe(true);
  });
});

describe('check 5: architecture.yml', () => {
  it('passes on a clean file and reports its size', () => {
    const d = makeDeps();
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines.some((l) => l.includes('[ok]') && l.includes('backlog/docs/architecture.yml valid (3 nodes, 2 edges, layout clean)'))).toBe(true);
  });

  it('is skipped when the file is absent', () => {
    const d = makeDeps({ loadArchitecture: () => ({ status: 'missing', path: '/proj/backlog/docs/architecture.yml' }) });
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines.some((l) => l.includes('[skip]') && l.includes('backlog/docs/architecture.yml not present'))).toBe(true);
  });

  it('fails and lists every problem with its path', () => {
    const broken = ARCH_OK.replace('kind: output', 'kind: robot').replace('cell: [2, 1]', 'cell: [9, 9]');
    const d = makeDeps({ loadArchitecture: () => checkArchitectureText(broken, 'architecture.yml') });
    expect(runDoctor('/proj', d)).toBe(1);
    const out = d.lines.join('\n');
    expect(d.lines.some((l) => l.includes('[fail]') && l.includes('backlog/docs/architecture.yml: 2 error(s)'))).toBe(true);
    expect(out).toContain('error: nodes[1].kind:');
    expect(out).toContain('error: nodes[2].cell:');
    expect(out).toContain('fix: edit the file or run the architecture-summary skill');
  });

  it('reports a parse error with line and column', () => {
    const d = makeDeps({ loadArchitecture: () => checkArchitectureText('schema: 1\n\tpitch: x\n', 'architecture.yml') });
    expect(runDoctor('/proj', d)).toBe(1);
    expect(d.lines.join('\n')).toMatch(/error: line 2, column 1: /);
  });

  it('fails (does not throw) on a hostile file that nests "- -" 8000 levels deep', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbl-doctor-'));
    try {
      mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
      writeFileSync(join(dir, 'backlog', 'docs', 'architecture.yml'), `${'- '.repeat(8000)}x`);
      const d = makeDeps({ loadArchitecture: (c) => loadArchitecture(c) });
      expect(runDoctor(dir, d)).toBe(1);
      expect(d.lines.some((l) => l.includes('[fail]') && l.includes('backlog/docs/architecture.yml: 1 error(s)'))).toBe(true);
      expect(d.lines.join('\n')).toMatch(/error: line 1, column 65: nesting too deep/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns on schema warnings and layout warnings', () => {
    const withUnknownKey = `${ARCH_OK}colour: red\n`;
    const d = makeDeps({
      loadArchitecture: () => checkArchitectureText(withUnknownKey, 'architecture.yml'),
      layoutArchitecture: (input) => ({
        ...layoutArchitecture(input),
        warnings: [{ code: 'route-fallback', edge: 'a>b', message: 'no straight or single-corner route from a to b; move one of the cells' }],
      }),
    });
    expect(runDoctor('/proj', d)).toBe(4);
    const out = d.lines.join('\n');
    expect(d.lines.some((l) => l.includes('[warn]') && l.includes('valid with 2 warning(s)'))).toBe(true);
    expect(out).toContain('warning: colour:');
    expect(out).toContain('layout route-fallback a>b: no straight or single-corner route from a to b');
  });

  it('replaces the ok line with one drift warning that points to sbl summary', () => {
    const d = makeDeps({
      detectDrift: () => ({
        findings: [
          { code: 'missing-path', path: 'nodes.a.files', message: 'src/a.ts does not exist' },
          { code: 'done-task', path: 'tasks.TASK-1', message: 'TASK-1 is Done' },
        ],
        notes: [],
      }),
    });
    expect(runDoctor('/proj', d)).toBe(4);
    expect(d.lines).toContain('[warn] architecture.yml valid, 2 drift findings – run sbl summary for details');
    expect(d.lines.some((l) => l.includes('layout clean'))).toBe(false);
    expect(d.lines.join('\n')).not.toContain('src/a.ts does not exist');
  });

  it('feeds the check-4 task rows into detectDrift', () => {
    const rows = [{ id: 'TASK-1', status: 'Done', labels: [] }];
    let seen: unknown;
    const d = makeDeps({
      readTaskLabels: () => rows,
      detectDrift: (_cwd, _arch, opts) => {
        seen = opts.tasks;
        return { findings: [], notes: [] };
      },
    });
    expect(runDoctor('/proj', d)).toBe(0);
    expect(seen).toBe(rows);
  });

  it('passes null tasks when the task list is unreadable', () => {
    let seen: unknown = 'unset';
    const d = makeDeps({
      readTaskLabels: () => null,
      detectDrift: (_cwd, _arch, opts) => {
        seen = opts.tasks;
        return { findings: [], notes: [] };
      },
    });
    runDoctor('/proj', d);
    expect(seen).toBeNull();
  });

  it('prints both the schema-warning line and the drift line', () => {
    const d = makeDeps({
      loadArchitecture: () => checkArchitectureText(`${ARCH_OK}colour: red\n`, 'architecture.yml'),
      detectDrift: () => ({ findings: [{ code: 'done-task', path: 'tasks.TASK-1', message: 'TASK-1 is Done' }], notes: [] }),
    });
    expect(runDoctor('/proj', d)).toBe(4);
    expect(d.lines.some((l) => l.includes('[warn]') && l.includes('valid with 1 warning(s)'))).toBe(true);
    expect(d.lines).toContain('[warn] architecture.yml valid, 1 drift finding – run sbl summary for details');
  });

  it('turns a throwing drift check into a warning', () => {
    const d = makeDeps({
      detectDrift: () => {
        throw new Error('boom');
      },
    });
    expect(runDoctor('/proj', d)).toBe(4);
    expect(d.lines).toContain('[warn] architecture.yml drift check failed (boom)');
  });

  it('turns a throwing layout into a failure instead of crashing', () => {
    const d = makeDeps({
      layoutArchitecture: () => {
        throw new Error('layout exploded');
      },
    });
    expect(runDoctor('/proj', d)).toBe(1);
    expect(d.lines).toContain('[fail] backlog/docs/architecture.yml layout failed (layout exploded)');
  });

  it('does not run the drift check for a missing file', () => {
    let ran = false;
    const d = makeDeps({
      loadArchitecture: () => ({ status: 'missing', path: '/proj/backlog/docs/architecture.yml' }),
      detectDrift: () => {
        ran = true;
        return { findings: [], notes: [] };
      },
    });
    runDoctor('/proj', d);
    expect(ran).toBe(false);
  });
});
