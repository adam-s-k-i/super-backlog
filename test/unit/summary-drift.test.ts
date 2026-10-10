// test/unit/summary-drift.test.ts
import { describe, expect, it } from 'vitest';

import {
  detectDrift,
  driftCount,
  sortFindings,
  STALE_COMMIT_THRESHOLD,
  SUMMARY_PROMPTS,
  summaryAgentPrompt,
  type DriftDeps,
  type DriftFinding,
} from '../../src/dashboard/summary-drift.js';
import { ARCHITECTURE_PATH, checkArchitectureText, type Architecture } from '../../src/dashboard/summary-schema.js';
import type { RunResult } from '../../src/lib/run.js';

const ARCH = [
  'schema: 1',
  'pitch: A **small** demo.',
  'grid: { cols: 3, rows: 2 }',
  'nodes:',
  '  - id: a',
  '    label: Alpha',
  '    kind: core',
  '    cell: [0, 0]',
  '    files: [src/a.ts, src/lib/]',
  '  - id: b',
  '    label: Beta',
  '    kind: output',
  '    cell: [2, 0]',
  '    files: [src/b.ts]',
  'edges:',
  '  - { from: a, to: b, label: calls }',
  'tasks:',
  '  TASK-1: a',
  '  TASK-2: b',
  '  TASK-3: a',
  '',
].join('\n');

function arch(text = ARCH): Architecture {
  const load = checkArchitectureText(text, ARCHITECTURE_PATH);
  if (load.status !== 'valid') throw new Error(`fixture invalid: ${JSON.stringify(load)}`);
  return load.architecture;
}

const CWD = '/proj';
/** absolute path from detectDrift -> repo-relative, on win32 and POSIX */
const rel = (p: string): string => p.replace(/\\/g, '/').replace(/^\/proj\//, '');

function fsDeps(files: string[], dirs: string[] = []): Pick<DriftDeps, 'exists' | 'isDirectory'> {
  return {
    exists: (p) => files.includes(rel(p)) || dirs.includes(rel(p)),
    isDirectory: (p) => dirs.includes(rel(p)),
  };
}

function git(opts: { log?: RunResult; count?: RunResult } = {}) {
  const calls: string[][] = [];
  const runCapture = (cmd: string, args: string[]): RunResult => {
    calls.push([cmd, ...args]);
    if (args[0] === 'log') return opts.log ?? { status: 0, stdout: 'abc123\n', stderr: '' };
    if (args[0] === 'rev-list') return opts.count ?? { status: 0, stdout: '0\n', stderr: '' };
    throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
  };
  return { runCapture, calls };
}

const ALL_FILES = ['src/a.ts', 'src/b.ts'];
const ALL_DIRS = ['src/lib'];
const OPEN_TASKS = [
  { id: 'TASK-1', status: 'To Do' },
  { id: 'TASK-2', status: 'In Progress' },
  { id: 'TASK-3', status: 'To Do' },
];

describe('detectDrift', () => {
  it('reports nothing for a current file', () => {
    const g = git();
    const res = detectDrift(CWD, arch(), { tasks: OPEN_TASKS, deps: { ...fsDeps(ALL_FILES, ALL_DIRS), runCapture: g.runCapture } });
    expect(res).toEqual({ findings: [], notes: [] });
  });

  it('flags missing paths and a trailing-slash entry that is not a directory', () => {
    const g = git();
    const res = detectDrift(CWD, arch(), {
      tasks: OPEN_TASKS,
      deps: { ...fsDeps(['src/a.ts', 'src/lib']), runCapture: g.runCapture },
    });
    expect(res.findings).toEqual([
      { code: 'missing-path', path: 'nodes.a.files', message: 'src/lib/ is not a directory' },
      { code: 'missing-path', path: 'nodes.b.files', message: 'src/b.ts does not exist' },
    ]);
  });

  it('flags Done and unknown task mappings (case-insensitive ids, isDone statuses)', () => {
    const g = git();
    const res = detectDrift(CWD, arch(), {
      tasks: [
        { id: 'task-1', status: 'To Do' },
        { id: 'TASK-2', status: 'completed' },
      ],
      deps: { ...fsDeps(ALL_FILES, ALL_DIRS), runCapture: g.runCapture },
    });
    expect(res.findings).toEqual([
      { code: 'done-task', path: 'tasks.TASK-2', message: 'TASK-2 is completed' },
      { code: 'unknown-task', path: 'tasks.TASK-3', message: 'TASK-3 is not in the task list (archived, deleted or never existed)' },
    ]);
  });

  it('skips the task signals with a note when the task list is unavailable', () => {
    const g = git();
    const res = detectDrift(CWD, arch(), { tasks: null, deps: { ...fsDeps(ALL_FILES, ALL_DIRS), runCapture: g.runCapture } });
    expect(res.findings).toEqual([]);
    expect(res.notes).toEqual(['task signals skipped: backlog CLI unavailable']);
  });

  it('exports the threshold 20', () => {
    expect(STALE_COMMIT_THRESHOLD).toBe(20);
  });

  it('stays quiet at 19 commits and flags the file at 20', () => {
    const at19 = git({ count: { status: 0, stdout: '19\n', stderr: '' } });
    expect(
      detectDrift(CWD, arch(), { tasks: OPEN_TASKS, deps: { ...fsDeps(ALL_FILES, ALL_DIRS), runCapture: at19.runCapture } }).findings,
    ).toEqual([]);
    const at20 = git({ count: { status: 0, stdout: '20\n', stderr: '' } });
    expect(
      detectDrift(CWD, arch(), { tasks: OPEN_TASKS, deps: { ...fsDeps(ALL_FILES, ALL_DIRS), runCapture: at20.runCapture } }).findings,
    ).toEqual([
      { code: 'stale-file', path: ARCHITECTURE_PATH, message: '20 commits touched documented files since the last update' },
    ]);
  });

  it('uses exactly two git calls and counts only documented paths that exist', () => {
    const g = git();
    detectDrift(CWD, arch(), { tasks: OPEN_TASKS, deps: { ...fsDeps(['src/a.ts'], ALL_DIRS), runCapture: g.runCapture } });
    expect(g.calls).toEqual([
      ['git', 'log', '-1', '--format=%H', '--', ARCHITECTURE_PATH],
      ['git', 'rev-list', '--count', 'abc123..HEAD', '--', 'src/a.ts', 'src/lib/'],
    ]);
  });

  it('explains every skipped stale check in a note', () => {
    const fs = fsDeps(ALL_FILES, ALL_DIRS);
    const cases: [ReturnType<typeof git>, string][] = [
      [git({ log: { status: 127, stdout: '', stderr: 'spawn git ENOENT' } }), 'stale-file skipped: git unavailable'],
      [git({ log: { status: 128, stdout: '', stderr: 'fatal: not a git repository' } }), 'stale-file skipped: not a git repository'],
      [git({ log: { status: 0, stdout: '\n', stderr: '' } }), 'stale-file skipped: architecture.yml has no commit history'],
      [git({ count: { status: 129, stdout: '', stderr: 'usage' } }), 'stale-file skipped: git rev-list failed (exit 129)'],
      [git({ count: { status: 0, stdout: 'n/a\n', stderr: '' } }), 'stale-file skipped: git rev-list printed no count'],
    ];
    for (const [g, note] of cases) {
      const res = detectDrift(CWD, arch(), { tasks: OPEN_TASKS, deps: { ...fs, runCapture: g.runCapture } });
      expect(res.findings).toEqual([]);
      expect(res.notes).toEqual([note]);
    }
  });

  it('skips the stale check when no documented file exists', () => {
    const g = git();
    const res = detectDrift(CWD, arch(), { tasks: OPEN_TASKS, deps: { ...fsDeps([]), runCapture: g.runCapture } });
    expect(res.notes).toEqual(['stale-file skipped: no documented files exist']);
    expect(g.calls).toHaveLength(1);
  });

  it('turns a throwing dep into a note and still runs the other signals', () => {
    const g = git({ count: { status: 0, stdout: '25\n', stderr: '' } });
    let first = true;
    const res = detectDrift(CWD, arch(), {
      tasks: [{ id: 'TASK-1', status: 'Done' }, { id: 'TASK-2', status: 'To Do' }, { id: 'TASK-3', status: 'To Do' }],
      deps: {
        exists: (p) => {
          if (first) {
            first = false;
            throw new Error('disk on fire');
          }
          return ALL_FILES.includes(rel(p)) || ALL_DIRS.includes(rel(p));
        },
        isDirectory: (p) => ALL_DIRS.includes(rel(p)),
        runCapture: g.runCapture,
      },
    });
    expect(res.notes).toEqual(['missing-path check failed: disk on fire']);
    expect(res.findings.map((f) => f.code)).toEqual(['done-task', 'stale-file']);
  });

  it('never throws when git itself throws', () => {
    const res = detectDrift(CWD, arch(), {
      tasks: OPEN_TASKS,
      deps: {
        ...fsDeps(ALL_FILES, ALL_DIRS),
        runCapture: () => {
          throw new Error('spawn exploded');
        },
      },
    });
    expect(res.notes).toEqual(['stale-file check failed: spawn exploded']);
  });

  it('orders findings by signal, then by path, deterministically', () => {
    const run = () =>
      detectDrift(CWD, arch(), {
        tasks: [{ id: 'TASK-1', status: 'Done' }, { id: 'TASK-2', status: 'Done' }],
        deps: { ...fsDeps([]), runCapture: git({ count: { status: 0, stdout: '31\n', stderr: '' } }).runCapture },
      });
    const res = run();
    expect(res.findings.map((f) => `${f.code} ${f.path} ${f.message}`)).toEqual([
      'missing-path nodes.a.files src/a.ts does not exist',
      'missing-path nodes.a.files src/lib/ does not exist',
      'missing-path nodes.b.files src/b.ts does not exist',
      'done-task tasks.TASK-1 TASK-1 is Done',
      'done-task tasks.TASK-2 TASK-2 is Done',
      'unknown-task tasks.TASK-3 TASK-3 is not in the task list (archived, deleted or never existed)',
    ]);
    // no documented file exists -> the stale check is skipped
    expect(res.notes).toEqual(['stale-file skipped: no documented files exist']);
    expect(run()).toEqual(res);
  });
});

describe('sortFindings', () => {
  it('sorts by signal order first, then by path, and keeps ties stable', () => {
    const f = (code: DriftFinding['code'], path: string, message = 'm'): DriftFinding => ({ code, path, message });
    const sorted = sortFindings([
      f('stale-file', ARCHITECTURE_PATH),
      f('unknown-task', 'tasks.TASK-9'),
      f('done-task', 'tasks.TASK-2'),
      f('missing-path', 'nodes.z.files', 'first'),
      f('missing-path', 'nodes.b.files'),
      f('missing-path', 'nodes.z.files', 'second'),
    ]);
    expect(sorted.map((x) => `${x.code} ${x.path} ${x.message}`)).toEqual([
      'missing-path nodes.b.files m',
      'missing-path nodes.z.files first',
      'missing-path nodes.z.files second',
      'done-task tasks.TASK-2 m',
      'unknown-task tasks.TASK-9 m',
      `stale-file ${ARCHITECTURE_PATH} m`,
    ]);
  });
});

describe('prompts and counts', () => {
  it('returns the three spec prompts verbatim', () => {
    expect(summaryAgentPrompt('missing')).toBe(
      'Run the architecture-summary skill to create backlog/docs/architecture.yml for the project summary page.',
    );
    expect(summaryAgentPrompt('invalid')).toBe(
      'Run the architecture-summary skill to repair backlog/docs/architecture.yml; sbl summary lists the problems.',
    );
    expect(summaryAgentPrompt('drift')).toBe(
      'Run the architecture-summary skill to refresh backlog/docs/architecture.yml; sbl summary lists the drift findings.',
    );
    expect(Object.keys(SUMMARY_PROMPTS)).toEqual(['missing', 'invalid', 'drift']);
  });

  it('counts findings in singular and plural', () => {
    expect(driftCount(1)).toBe('1 drift finding');
    expect(driftCount(3)).toBe('3 drift findings');
  });
});
