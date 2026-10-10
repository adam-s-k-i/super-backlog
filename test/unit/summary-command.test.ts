// test/unit/summary-command.test.ts
import { describe, expect, it } from 'vitest';

import { formatFinding, runSummary, type SummaryCommandDeps } from '../../src/commands/summary.js';
import { SUMMARY_PROMPTS, type DriftResult } from '../../src/dashboard/summary-drift.js';
import { ARCHITECTURE_PATH, checkArchitectureText } from '../../src/dashboard/summary-schema.js';

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

const SAMPLE: DriftResult = {
  findings: [
    { code: 'missing-path', path: 'nodes.cli.files', message: 'src/commands/old.ts does not exist' },
    { code: 'done-task', path: 'tasks.TASK-85', message: 'TASK-85 is Done' },
    { code: 'stale-file', path: ARCHITECTURE_PATH, message: '24 commits touched documented files since the last update' },
  ],
  notes: ['stale-file skipped: not a git repository'],
};

function run(argv: string[] = [], overrides: Partial<SummaryCommandDeps> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const deps: SummaryCommandDeps = {
    isProject: () => true,
    loadArchitecture: () => checkArchitectureText(ARCH_OK, ARCHITECTURE_PATH),
    readTasks: () => [],
    detectDrift: () => ({ findings: [], notes: [] }),
    log: (l) => out.push(l),
    error: (l) => err.push(l),
    ...overrides,
  };
  const code = runSummary(
    '/proj',
    { values: { check: argv.includes('--check') }, positionals: argv.filter((a) => !a.startsWith('--')) },
    deps,
  );
  return { code, out, err };
}

describe('formatFinding', () => {
  it('aligns code and path like the spec sample', () => {
    expect(SAMPLE.findings.map(formatFinding)).toEqual([
      '  missing-path  nodes.cli.files  src/commands/old.ts does not exist',
      '  done-task     tasks.TASK-85    TASK-85 is Done',
      '  stale-file    backlog/docs/architecture.yml  24 commits touched documented files since the last update',
    ]);
  });
});

describe('runSummary', () => {
  it('exits 0 with one ok line for a clean file', () => {
    const r = run();
    expect(r.code).toBe(0);
    expect(r.out).toEqual(['[ok]   architecture.yml valid, no drift']);
  });

  it('prints the spec sample for drift and exits 4', () => {
    const r = run([], { detectDrift: () => SAMPLE });
    expect(r.code).toBe(4);
    expect(r.out).toEqual([
      '[warn] architecture.yml valid, 3 drift findings',
      '  missing-path  nodes.cli.files  src/commands/old.ts does not exist',
      '  done-task     tasks.TASK-85    TASK-85 is Done',
      '  stale-file    backlog/docs/architecture.yml  24 commits touched documented files since the last update',
      '  note: stale-file skipped: not a git repository',
      `next step: ask your agent: "${SUMMARY_PROMPTS.drift}"`,
    ]);
  });

  it('--check keeps status, findings and notes but drops the next step (same exit code)', () => {
    const r = run(['--check'], { detectDrift: () => SAMPLE });
    expect(r.code).toBe(4);
    expect(r.out).toHaveLength(5);
    expect(r.out.join('\n')).not.toContain('next step');
  });

  it('passes the task list to detectDrift and loads without task ids', () => {
    const tasks = [{ id: 'TASK-1', status: 'Done' }];
    const loadCalls: unknown[][] = [];
    let seen: unknown;
    run([], {
      loadArchitecture: (...args: unknown[]) => {
        loadCalls.push(args);
        return checkArchitectureText(ARCH_OK, ARCHITECTURE_PATH);
      },
      readTasks: () => tasks,
      detectDrift: (_cwd, _arch, opts) => {
        seen = opts.tasks;
        return { findings: [], notes: [] };
      },
    });
    expect(loadCalls).toEqual([['/proj']]);
    expect(seen).toBe(tasks);
  });

  it('warns with the missing prompt when the file is absent (exit 4)', () => {
    const r = run([], { loadArchitecture: () => ({ status: 'missing', path: '/proj/backlog/docs/architecture.yml' }) });
    expect(r.code).toBe(4);
    expect(r.out).toEqual([
      '[warn] architecture.yml not present',
      `next step: ask your agent: "${SUMMARY_PROMPTS.missing}"`,
    ]);
  });

  it('fails with at most 20 problems and the invalid prompt (exit 1)', () => {
    const problems = [
      ...Array.from({ length: 23 }, (_, i) => ({ path: `nodes[${i}].id`, message: `bad ${i}`, level: 'error' as const })),
      { path: 'colour', message: 'unknown key, ignored', level: 'warning' as const },
    ];
    let driftRan = false;
    const r = run([], {
      loadArchitecture: () => ({ status: 'invalid', path: ARCHITECTURE_PATH, problems }),
      detectDrift: () => {
        driftRan = true;
        return { findings: [], notes: [] };
      },
    });
    expect(r.code).toBe(1);
    expect(r.out[0]).toBe('[fail] architecture.yml invalid');
    expect(r.out[1]).toBe('  nodes[0].id  bad 0');
    expect(r.out.filter((l) => l.startsWith('  nodes['))).toHaveLength(20);
    expect(r.out).toContain('  … and 3 more');
    expect(r.out.join('\n')).not.toContain('colour');
    expect(r.out[r.out.length - 1]).toBe(`next step: ask your agent: "${SUMMARY_PROMPTS.invalid}"`);
    expect(driftRan).toBe(false);
  });

  it('lists schema and layout warnings before the findings (exit 4)', () => {
    const r = run([], {
      loadArchitecture: () => checkArchitectureText(`${ARCH_OK}colour: red\n`, ARCHITECTURE_PATH),
      detectDrift: () => ({ findings: [SAMPLE.findings[1]!], notes: [] }),
    });
    expect(r.code).toBe(4);
    expect(r.out[0]).toBe('[warn] architecture.yml valid with 1 warning(s), 1 drift finding');
    expect(r.out[1]).toMatch(/^ {2}warning: colour: /);
    expect(r.out[2]).toBe('  done-task     tasks.TASK-85    TASK-85 is Done');
  });

  it('warnings without drift exit 4 and print no next step', () => {
    const r = run([], { loadArchitecture: () => checkArchitectureText(`${ARCH_OK}colour: red\n`, ARCHITECTURE_PATH) });
    expect(r.code).toBe(4);
    expect(r.out[0]).toBe('[warn] architecture.yml valid with 1 warning(s), no drift');
    expect(r.out.join('\n')).not.toContain('next step');
  });

  it('fails when the layout throws (exit 1)', () => {
    const r = run([], {
      layoutArchitecture: () => {
        throw new Error('layout exploded');
      },
    });
    expect(r.code).toBe(1);
    expect(r.out).toEqual(['[fail] architecture.yml layout failed (layout exploded)']);
  });

  it('warns when the drift check throws (exit 4)', () => {
    const r = run([], {
      detectDrift: () => {
        throw new Error('boom');
      },
    });
    expect(r.code).toBe(4);
    expect(r.out).toEqual(['[warn] architecture.yml drift check failed (boom)']);
  });

  it('exits 1 outside a project', () => {
    const r = run([], { isProject: () => false });
    expect(r.code).toBe(1);
    expect(r.out).toEqual([]);
    expect(r.err).toEqual(['error: not inside a super-backlog project (backlog/config.yml not found) - run sbl init first']);
  });

  it('exits 1 with usage on positional arguments', () => {
    const r = run(['extra']);
    expect(r.code).toBe(1);
    expect(r.err).toEqual(['usage: sbl summary [--check]']);
  });
});
