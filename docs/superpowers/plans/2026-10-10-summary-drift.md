# Summary Drift Detection and Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect when `backlog/docs/architecture.yml` drifts from the code and the backlog. Report the drift in a new `sbl summary [--check]` command, in doctor check 5 and on the summary page. Each report hands the user one agent prompt that runs the `architecture-summary` skill.

**Architecture:** A pure module `src/dashboard/summary-drift.ts` (`detectDrift`, `summaryAgentPrompt`, `STALE_COMMIT_THRESHOLD`) does every check. It reaches the filesystem and git only through injectable deps. Three consumers call it: the new command `src/commands/summary.ts`, doctor check 5, and `buildSummaryModel` (the page banner). `readTaskList` moves from doctor into `src/lib/task-list.ts` so that doctor and summary share it. Onboarding adds binding rule 7, an init hint and a skill update.

**Tech Stack:**

- TypeScript (ESM, Node >= 20), built with `tsc -p tsconfig.json`.
- Vitest 5 (`test/**/*.test.ts`, 30 s timeout).
- Lint: markdownlint-cli2 and cspell on `**/*.md`; `docs/superpowers/**` is excluded.
- Windows-first: CRLF repo files, PowerShell 5.1 has no `&&`, and the Bash tool uses POSIX syntax.

**Spec:** `docs/superpowers/specs/2026-10-10-summary-drift-design.md`

## Global Constraints

- **Language:** repo artifacts (code, tests, docs, commit messages) are English.
- **Branch:** work on `feat/summary-drift`; the controller creates it before Task 1. Never commit to `master` and never push, because a push to master triggers a release.
- **Commits:** use conventional commits with the trailer as a second `-m`:
  `git commit -m "<type>(<scope>): <subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
  Stage only the files a task lists; never use `git add -A` or `git add .`.
- **Spec values, used verbatim:**
  - `STALE_COMMIT_THRESHOLD = 20` (a finding at `>= 20`).
  - The three prompt strings.
  - The init hint text and the rule 7 text.
  - The command output line formats and the exit-code table.
  - The cap of 20 problems on an invalid file.
- **Test isolation:**
  - Tests never touch the real `~/.super-backlog` hub or registry. Spawned CLIs get an isolated `HOME` and `USERPROFILE` and `SBL_SKIP_UPDATE_CHECK=1`.
  - A dashboard server in a test uses a non-default port and `--no-open`; no task in this plan starts one.
  - Tests never write to the real clipboard: page tests assert HTML only.
- **Backlog files:** never hand-edit backlog task markdown; every task change goes through the `backlog` CLI or `sbl phase`. Phase transitions and status bookkeeping for the implementation tasks belong to the controller.
- **Verification commands (run all three before every commit):**
  - `npm test` (its `pretest` runs `npm run build`, so `dist/` is fresh for the E2E tests)
  - `npm run lint`
  - `npx tsc -p tsconfig.json --noEmit`
- **Snapshots:** `npm test` on Windows can rewrite `test/unit/__snapshots__/*.snap` with only end-of-line changes. Never commit these. Check with `git diff --ignore-cr-at-eol --stat -- test/unit/__snapshots__`; if a snapshot shows no content change, revert it with `git checkout -- <snap>`. This plan changes no snapshot content.
- **cspell:** in linted docs (`README.md`, `docs/guide/**`), avoid the token `rev-list`; describe the stale check in words.

## File Structure

| File | Task | Responsibility |
| --- | --- | --- |
| `src/dashboard/summary-drift.ts` | 1 | Types, `detectDrift`, `sortFindings`, `driftCount`, `SUMMARY_PROMPTS`, `summaryAgentPrompt`, `STALE_COMMIT_THRESHOLD` |
| `test/unit/summary-drift.test.ts` | 1 | Unit tests for the drift module |
| `src/lib/task-list.ts` | 2 | `readTaskList` (moved from doctor) |
| `test/unit/task-list.test.ts` | 2 | Unit tests for `readTaskList` |
| `src/commands/summary.ts` | 2 | `runSummary`, `formatFinding` |
| `test/unit/summary-command.test.ts` | 2 | Unit tests for the command |
| `test/integration/summary-cli.test.ts` | 2 | E2E against `dist/bin.js` in a temp git repo |
| `src/cli.ts` | 2 | Dispatch and HELP |
| `src/commands/doctor.ts` | 2, 3 | Uses `readTaskList` (Task 2); runs drift in check 5 (Task 3) |
| `README.md` | 2 | Cheat-sheet row |
| `test/unit/cli-contract.test.ts`, `test/unit/command-smoke.test.ts`, `test/docs.test.ts` | 2 | Contract, smoke and doc-rot checks |
| `src/dashboard/summary-render.ts` | 3 | `SummaryModel.drift`, drift in `buildSummaryModel`, banner and copy buttons in `noticeHtml` |
| `src/templates/summary.html` | 3 | `.notice-drift` and the notice copy-button CSS |
| `test/unit/doctor.test.ts`, `test/unit/summary-render.test.ts` | 3 | Doctor and page tests |
| `backlog/docs/architecture.yml` | 3, 5 | Prune `tasks:` (Task 3); purpose and files (Task 5) |
| `src/templates/workflow-block.md` | 4 | Binding rule 7 |
| `src/templates/skill-architecture-summary.md` | 4 | Drift trigger, fix procedure, `sbl summary` exit criterion |
| `src/commands/init.ts` | 4 | `INIT_SUMMARY_HINT` |
| `test/unit/templates.test.ts`, `test/unit/glue-skills.test.ts`, `test/integration/init-preflight.test.ts` | 4 | Onboarding tests |
| `docs/guide/project-summary.md`, `docs/guide/quickstart.md` | 4 | User docs |
| `AGENTS.md`, `CLAUDE.md`, `.claude/skills/**`, `.opencode/skill/**` | 5 | Managed glue refreshed via `sbl update --no-self` |

---

### Task 1: Drift module

**Files:**

- Create: `src/dashboard/summary-drift.ts`
- Test: `test/unit/summary-drift.test.ts`

**Interfaces:**

- Consumes:
  - `Architecture` and `ARCHITECTURE_PATH` from `src/dashboard/summary-schema.ts`
  - `isDone(status)` from `src/dashboard/metrics.ts`
  - `runCapture` and `RunResult` from `src/lib/run.ts`
- Produces:
  - Types: `DriftCode`, `DriftFinding`, `DriftResult`, `DriftDeps`, `DriftOptions`, `SummaryPromptState`
  - `DRIFT_CODES`, `STALE_COMMIT_THRESHOLD`, `SUMMARY_PROMPTS`
  - `detectDrift(cwd, architecture, opts): DriftResult`
  - `sortFindings(findings)`, `driftCount(n)`, `summaryAgentPrompt(state)`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/summary-drift.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run test/unit/summary-drift.test.ts`
Expected: FAIL, because the module `../../src/dashboard/summary-drift.js` cannot be resolved.

- [ ] **Step 3: Implement the module**

Create `src/dashboard/summary-drift.ts`:

```ts
// src/dashboard/summary-drift.ts
// Drift detection for backlog/docs/architecture.yml (spec 2026-10-10): four
// signals, all filesystem and git access through injectable deps, never throws.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { runCapture as defaultRunCapture, type RunResult } from '../lib/run.js';
import { isDone } from './metrics.js';
import { ARCHITECTURE_PATH, type Architecture } from './summary-schema.js';

/** A stale-file finding needs at least this many commits since the file's last commit. */
export const STALE_COMMIT_THRESHOLD = 20;

export type DriftCode = 'missing-path' | 'done-task' | 'unknown-task' | 'stale-file';

/** Signal order; findings are sorted by it first. */
export const DRIFT_CODES: readonly DriftCode[] = ['missing-path', 'done-task', 'unknown-task', 'stale-file'];

export interface DriftFinding {
  code: DriftCode;
  /** `nodes.<id>.files`, `tasks.<TASK-ID>` or `backlog/docs/architecture.yml` */
  path: string;
  message: string;
}

export interface DriftResult {
  findings: DriftFinding[];
  /** one line per skipped or failed signal */
  notes: string[];
}

export interface DriftDeps {
  exists?: (absPath: string) => boolean;
  isDirectory?: (absPath: string) => boolean;
  runCapture?: (cmd: string, args: string[], cwd: string) => RunResult;
}

export interface DriftOptions {
  /** rows of `backlog task list --json`; null when the backlog CLI is unavailable */
  tasks: readonly { id: string; status: string }[] | null;
  deps?: DriftDeps;
}

/** One prompt per state, shared by the CLI and the page so they never diverge. */
export const SUMMARY_PROMPTS = {
  missing: 'Run the architecture-summary skill to create backlog/docs/architecture.yml for the project summary page.',
  invalid: 'Run the architecture-summary skill to repair backlog/docs/architecture.yml; sbl summary lists the problems.',
  drift: 'Run the architecture-summary skill to refresh backlog/docs/architecture.yml; sbl summary lists the drift findings.',
} as const;

export type SummaryPromptState = keyof typeof SUMMARY_PROMPTS;

export function summaryAgentPrompt(state: SummaryPromptState): string {
  return SUMMARY_PROMPTS[state];
}

/** `1 drift finding`, `3 drift findings` */
export function driftCount(n: number): string {
  return `${n} drift ${n === 1 ? 'finding' : 'findings'}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function defaultIsDirectory(absPath: string): boolean {
  try {
    return statSync(absPath).isDirectory();
  } catch {
    return false;
  }
}

function absPath(cwd: string, entry: string): string {
  return join(cwd, ...entry.split('/').filter((part) => part.length > 0));
}

/** Signal order first, then path; Array.prototype.sort is stable, so ties keep file order. */
export function sortFindings(findings: readonly DriftFinding[]): DriftFinding[] {
  const rank = (code: DriftCode): number => DRIFT_CODES.indexOf(code);
  return [...findings].sort((a, b) => {
    const byCode = rank(a.code) - rank(b.code);
    if (byCode !== 0) return byCode;
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
  });
}

function missingPaths(
  cwd: string,
  architecture: Architecture,
  exists: (absPath: string) => boolean,
  isDirectory: (absPath: string) => boolean,
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  for (const node of architecture.nodes) {
    const path = `nodes.${node.id}.files`;
    for (const entry of node.files) {
      const abs = absPath(cwd, entry);
      if (!exists(abs)) {
        findings.push({ code: 'missing-path', path, message: `${entry} does not exist` });
      } else if (entry.endsWith('/') && !isDirectory(abs)) {
        findings.push({ code: 'missing-path', path, message: `${entry} is not a directory` });
      }
    }
  }
  return findings;
}

function taskFindings(architecture: Architecture, tasks: readonly { id: string; status: string }[]): DriftFinding[] {
  const byId = new Map(tasks.map((t) => [t.id.toUpperCase(), t] as const));
  const findings: DriftFinding[] = [];
  for (const key of Object.keys(architecture.tasks)) {
    const path = `tasks.${key}`;
    const task = byId.get(key.toUpperCase());
    if (task === undefined) {
      findings.push({ code: 'unknown-task', path, message: `${key} is not in the task list (archived, deleted or never existed)` });
    } else if (isDone(task.status)) {
      findings.push({ code: 'done-task', path, message: `${task.id} is ${task.status}` });
    }
  }
  return findings;
}

function staleFile(
  cwd: string,
  architecture: Architecture,
  exists: (absPath: string) => boolean,
  run: (cmd: string, args: string[], cwd: string) => RunResult,
  notes: string[],
): DriftFinding[] {
  const log = run('git', ['log', '-1', '--format=%H', '--', ARCHITECTURE_PATH], cwd);
  if (log.status === 127) {
    notes.push('stale-file skipped: git unavailable');
    return [];
  }
  if (log.status !== 0) {
    notes.push('stale-file skipped: not a git repository');
    return [];
  }
  const sha = log.stdout.trim();
  if (sha === '') {
    notes.push('stale-file skipped: architecture.yml has no commit history');
    return [];
  }
  const paths = [...new Set(architecture.nodes.flatMap((n) => n.files))].filter((entry) => exists(absPath(cwd, entry)));
  if (paths.length === 0) {
    notes.push('stale-file skipped: no documented files exist');
    return [];
  }
  const count = run('git', ['rev-list', '--count', `${sha}..HEAD`, '--', ...paths], cwd);
  if (count.status !== 0) {
    notes.push(`stale-file skipped: git rev-list failed (exit ${count.status})`);
    return [];
  }
  const n = Number.parseInt(count.stdout.trim(), 10);
  if (!Number.isFinite(n)) {
    notes.push('stale-file skipped: git rev-list printed no count');
    return [];
  }
  if (n < STALE_COMMIT_THRESHOLD) return [];
  return [{ code: 'stale-file', path: ARCHITECTURE_PATH, message: `${n} commits touched documented files since the last update` }];
}

/**
 * Compares a valid architecture file with the code and the backlog. Never
 * throws: an error inside one signal becomes a note and the others still run.
 */
export function detectDrift(cwd: string, architecture: Architecture, opts: DriftOptions): DriftResult {
  const deps = opts.deps ?? {};
  const exists = deps.exists ?? ((p: string) => existsSync(p));
  const isDirectory = deps.isDirectory ?? defaultIsDirectory;
  const run = deps.runCapture ?? defaultRunCapture;
  const findings: DriftFinding[] = [];
  const notes: string[] = [];
  const guard = (signal: string, check: () => DriftFinding[]): void => {
    try {
      findings.push(...check());
    } catch (err) {
      notes.push(`${signal} check failed: ${errorMessage(err)}`);
    }
  };

  guard('missing-path', () => missingPaths(cwd, architecture, exists, isDirectory));
  const tasks = opts.tasks;
  if (tasks === null) notes.push('task signals skipped: backlog CLI unavailable');
  else guard('task', () => taskFindings(architecture, tasks));
  guard('stale-file', () => staleFile(cwd, architecture, exists, run, notes));

  return { findings: sortFindings(findings), notes };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run test/unit/summary-drift.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Full verification**

Run, in order: `npx tsc -p tsconfig.json --noEmit`, then `npm test`, then `npm run lint`.
Expected: all three exit 0. Revert any EOL-only snapshot diffs as described in Global Constraints.

- [ ] **Step 6: Commit**

```bash
git add src/dashboard/summary-drift.ts test/unit/summary-drift.test.ts
git commit -m "feat(summary): detect drift in architecture.yml" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `sbl summary` command, dispatch, HELP, README, tests, E2E

**Files:**

- Create:
  - `src/lib/task-list.ts`
  - `src/commands/summary.ts`
  - `test/unit/task-list.test.ts`
  - `test/unit/summary-command.test.ts`
  - `test/integration/summary-cli.test.ts`
- Modify:
  - `src/commands/doctor.ts` (only replaces the private reader with `readTaskList`)
  - `src/cli.ts`
  - `README.md`
- Test (modify):
  - `test/unit/cli-contract.test.ts`
  - `test/unit/command-smoke.test.ts`
  - `test/docs.test.ts`

**Interfaces:**

- Consumes from Task 1:
  - `detectDrift`, `driftCount`, `summaryAgentPrompt`
  - `DriftFinding`, `DriftResult`, `SummaryPromptState`
- Consumes from existing code:
  - `loadArchitecture`, `ARCHITECTURE_PATH`, `ArchitectureLoadResult` (summary-schema)
  - `layoutArchitecture` (summary-layout)
  - `MAX_NOTICE_PROBLEMS` (summary-render)
  - `resolveBacklogBin`, `runCapture` (run)
- Produces:
  - `TaskListRow`, `TaskListDeps`, `readTaskList(cwd, deps?)`
  - `SummaryArgs`, `SummaryCommandDeps`, `runSummary(cwd, args, deps?): number`, `formatFinding(f): string`
  - CLI `case 'summary'`
  - Doctor keeps `export type TaskLabelRow = TaskListRow` for compatibility.

- [ ] **Step 1: Write the failing `readTaskList` tests**

Create `test/unit/task-list.test.ts`:

```ts
// test/unit/task-list.test.ts
import { describe, expect, it } from 'vitest';

import { readTaskList } from '../../src/lib/task-list.js';
import type { RunResult } from '../../src/lib/run.js';

const ok = (stdout: string): RunResult => ({ status: 0, stdout, stderr: '' });

describe('readTaskList', () => {
  it('returns null when the backlog CLI is not resolvable', () => {
    expect(readTaskList('/proj', { resolveBacklog: () => null, run: () => ok('{}') })).toBeNull();
  });

  it('runs "task list --json" with the resolved binary in cwd', () => {
    const calls: [string, string[], string][] = [];
    readTaskList('/proj', {
      resolveBacklog: () => 'backlog.cmd',
      run: (cmd, args, cwd) => {
        calls.push([cmd, args, cwd]);
        return ok('{"tasks":[]}');
      },
    });
    expect(calls).toEqual([['backlog.cmd', ['task', 'list', '--json'], '/proj']]);
  });

  it('returns null on a failing command or unparsable output', () => {
    const resolveBacklog = () => 'backlog';
    expect(readTaskList('/proj', { resolveBacklog, run: () => ({ status: 1, stdout: '', stderr: 'boom' }) })).toBeNull();
    expect(readTaskList('/proj', { resolveBacklog, run: () => ok('not json') })).toBeNull();
    expect(readTaskList('/proj', { resolveBacklog, run: () => ok('{"tasks":{}}') })).toBeNull();
  });

  it('keeps rows with string id and status and filters labels to strings', () => {
    const rows = readTaskList('/proj', {
      resolveBacklog: () => 'backlog',
      run: () =>
        ok(
          JSON.stringify({
            tasks: [
              { id: 'TASK-1', status: 'Done', labels: ['phase/impl', 7] },
              { id: 'TASK-2', status: 'To Do' },
              { id: 3, status: 'To Do' },
              null,
            ],
          }),
        ),
    });
    expect(rows).toEqual([
      { id: 'TASK-1', status: 'Done', labels: ['phase/impl'] },
      { id: 'TASK-2', status: 'To Do', labels: [] },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run test/unit/task-list.test.ts`
Expected: FAIL, because `../../src/lib/task-list.js` cannot be resolved.

- [ ] **Step 3: Extract `readTaskList`**

Create `src/lib/task-list.ts`:

```ts
// src/lib/task-list.ts
// Reads `backlog task list --json` into plain rows; shared by sbl doctor and sbl summary.
import { resolveBacklogBin, runCapture, type RunResult } from './run.js';

export interface TaskListRow {
  id: string;
  status: string;
  labels: string[];
}

export interface TaskListDeps {
  resolveBacklog?: (cwd: string) => string | null;
  run?: (cmd: string, args: string[], cwd: string) => RunResult;
}

/** null when the backlog CLI is missing, fails, or prints something unparsable. */
export function readTaskList(cwd: string, deps: TaskListDeps = {}): TaskListRow[] | null {
  const bin = (deps.resolveBacklog ?? resolveBacklogBin)(cwd);
  if (!bin) return null;
  const res = (deps.run ?? runCapture)(bin, ['task', 'list', '--json'], cwd);
  if (res.status !== 0) return null;
  try {
    const parsed = JSON.parse(res.stdout) as { tasks?: unknown };
    if (!Array.isArray(parsed.tasks)) return null;
    const rows: TaskListRow[] = [];
    for (const t of parsed.tasks) {
      if (typeof t !== 'object' || t === null) continue;
      const id = (t as { id?: unknown }).id;
      const status = (t as { status?: unknown }).status;
      const labels = (t as { labels?: unknown }).labels;
      if (typeof id !== 'string' || typeof status !== 'string') continue;
      rows.push({
        id,
        status,
        labels: Array.isArray(labels) ? labels.filter((l): l is string => typeof l === 'string') : [],
      });
    }
    return rows;
  } catch {
    return null;
  }
}
```

In `src/commands/doctor.ts`, make these changes:

1. Replace the import `import { resolveBacklogBin, runCapture } from '../lib/run.js';` with:

   ```ts
   import { resolveBacklogBin } from '../lib/run.js';
   import { readTaskList, type TaskListRow } from '../lib/task-list.js';
   ```

2. Replace the `TaskLabelRow` interface with:

   ```ts
   /** Kept for existing imports; the reader lives in src/lib/task-list.ts. */
   export type TaskLabelRow = TaskListRow;
   ```

3. Delete the whole `defaultReadTaskLabels` function.
4. In `runDoctor`, replace the `readTaskLabels` line with:

   ```ts
   const readTaskLabels = deps.readTaskLabels ?? ((c: string) => readTaskList(c, { resolveBacklog }));
   ```

Run: `npx vitest run test/unit/task-list.test.ts test/unit/doctor.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing command tests**

Create `test/unit/summary-command.test.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests and confirm they fail**

Run: `npx vitest run test/unit/summary-command.test.ts`
Expected: FAIL, because `../../src/commands/summary.js` cannot be resolved.

- [ ] **Step 6: Implement the command**

Create `src/commands/summary.ts`:

```ts
// src/commands/summary.ts
// `sbl summary [--check]` (spec 2026-10-10): validates backlog/docs/architecture.yml,
// lists schema/layout warnings and drift findings, and names the agent prompt.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  detectDrift,
  driftCount,
  summaryAgentPrompt,
  type DriftFinding,
  type DriftResult,
  type SummaryPromptState,
} from '../dashboard/summary-drift.js';
import { layoutArchitecture } from '../dashboard/summary-layout.js';
import { MAX_NOTICE_PROBLEMS } from '../dashboard/summary-render.js';
import { loadArchitecture, type ArchitectureLoadResult } from '../dashboard/summary-schema.js';
import { readTaskList } from '../lib/task-list.js';

export interface SummaryArgs {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
}

export interface SummaryCommandDeps {
  isProject?: (cwd: string) => boolean;
  loadArchitecture?: (cwd: string) => ArchitectureLoadResult;
  layoutArchitecture?: typeof layoutArchitecture;
  readTasks?: (cwd: string) => readonly { id: string; status: string }[] | null;
  detectDrift?: typeof detectDrift;
  log?: (line: string) => void;
  error?: (line: string) => void;
}

const FILE = 'architecture.yml';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `  <code padded to 14><path, at least two spaces><message>`, as in the spec sample. */
export function formatFinding(f: DriftFinding): string {
  return `  ${f.code.padEnd(14)}${f.path}${' '.repeat(Math.max(2, 17 - f.path.length))}${f.message}`;
}

export function runSummary(cwd: string, args: SummaryArgs, deps: SummaryCommandDeps = {}): number {
  const log = deps.log ?? ((line: string) => console.log(line));
  const error = deps.error ?? ((line: string) => console.error(line));
  if (args.positionals.length > 0) {
    error('usage: sbl summary [--check]');
    return 1;
  }
  const check = args.values.check === true;
  const isProject = deps.isProject ?? ((c: string) => existsSync(join(c, 'backlog', 'config.yml')));
  if (!isProject(cwd)) {
    error('error: not inside a super-backlog project (backlog/config.yml not found) - run sbl init first');
    return 1;
  }
  const nextStep = (state: SummaryPromptState): void => {
    if (!check) log(`next step: ask your agent: "${summaryAgentPrompt(state)}"`);
  };

  // Loaded without task ids: with them the schema drops unknown ids before drift sees them.
  const load = (deps.loadArchitecture ?? ((c: string) => loadArchitecture(c)))(cwd);
  if (load.status === 'missing') {
    log(`[warn] ${FILE} not present`);
    nextStep('missing');
    return 4;
  }
  if (load.status === 'invalid') {
    const errors = load.problems.filter((p) => p.level === 'error');
    const shown = errors.slice(0, MAX_NOTICE_PROBLEMS);
    log(`[fail] ${FILE} invalid`);
    for (const p of shown) log(`  ${p.path}  ${p.message}`);
    if (errors.length > shown.length) log(`  … and ${errors.length - shown.length} more`);
    nextStep('invalid');
    return 1;
  }

  let layoutWarnings: string[];
  try {
    const layout = (deps.layoutArchitecture ?? layoutArchitecture)(load.architecture);
    layoutWarnings = layout.warnings.map((w) => `  layout ${w.code} ${w.edge}: ${w.message}`);
  } catch (err) {
    log(`[fail] ${FILE} layout failed (${errorMessage(err)})`);
    return 1;
  }
  const warnings = [...load.problems.map((p) => `  warning: ${p.path}: ${p.message}`), ...layoutWarnings];

  let drift: DriftResult;
  try {
    const tasks = (deps.readTasks ?? ((c: string) => readTaskList(c)))(cwd);
    drift = (deps.detectDrift ?? detectDrift)(cwd, load.architecture, { tasks });
  } catch (err) {
    log(`[warn] ${FILE} drift check failed (${errorMessage(err)})`);
    for (const line of warnings) log(line);
    return 4;
  }

  const findings = drift.findings.length;
  const driftText = findings === 0 ? 'no drift' : driftCount(findings);
  if (warnings.length === 0 && findings === 0) log(`[ok]   ${FILE} valid, no drift`);
  else if (warnings.length === 0) log(`[warn] ${FILE} valid, ${driftText}`);
  else log(`[warn] ${FILE} valid with ${warnings.length} warning(s), ${driftText}`);
  for (const line of warnings) log(line);
  for (const f of drift.findings) log(formatFinding(f));
  for (const note of drift.notes) log(`  note: ${note}`);
  if (findings > 0) nextStep('drift');
  return warnings.length === 0 && findings === 0 ? 0 : 4;
}
```

Run: `npx vitest run test/unit/summary-command.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing CLI, smoke and README tests**

In `test/unit/cli-contract.test.ts`, inside `describe('HELP', ...)`, add after the first `it(...)`:

```ts
  it('lists sbl summary and its --check flag', () => {
    expect(HELP).toMatch(/^\s+summary\s+Check backlog\/docs\/architecture\.yml for drift/m);
    expect(HELP).toContain('summary options:');
    expect(HELP).toMatch(/^\s+--check\s+Report only/m);
  });
```

In `test/unit/command-smoke.test.ts`, add the import `import { runSummary } from '../../src/commands/summary.js';` after the `runModels` import. Add this test at the end of `describe('command smoke', ...)`:

```ts
  it('summary exits 1 outside a project', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-smoke-'));
    dirs.push(cwd);
    const code = runSummary(cwd, { values: {}, positionals: [] }, { error: () => {} });
    expect(code).toBe(1);
  });
```

In `test/docs.test.ts`, extend the command list in `it('cheat sheet keeps the core sbl commands', ...)` to:

```ts
    for (const cmd of ['sbl init', 'sbl dashboard', 'sbl phase TASK-1 plan', 'sbl doctor', 'sbl summary', 'sbl update', 'sbl uninstall']) {
```

Run: `npx vitest run test/unit/cli-contract.test.ts test/unit/command-smoke.test.ts test/docs.test.ts`
Expected: FAIL in two places: the HELP test, and the cheat-sheet test (`sbl summary` is missing). The smoke test already passes.

- [ ] **Step 8: Wire the CLI and the README**

In `src/cli.ts`:

1. Add the import after the `runPhase` import:

   ```ts
   import { runSummary } from './commands/summary.js';
   ```

2. In `HELP`, add this line directly after the `doctor` line in the Commands list:

   ```text
     summary     Check backlog/docs/architecture.yml for drift (missing paths, Done tasks, stale file)
   ```

3. In `HELP`, add this block directly after the `doctor options:` block. Keep the empty line before `phase options:`. `--check` is padded to column 34, like the other flags:

   ```text
   summary options:
     --check                         Report only (no next-step prompt); same exit codes, for CI
   ```

4. In the `switch`, add this directly after `case 'doctor': return runDoctor(process.cwd());`:

   ```ts
       case 'summary': {
         const parsed = parseArgs({
           args: rest,
           allowPositionals: true,
           options: { check: { type: 'boolean' } },
         });
         return runSummary(process.cwd(), {
           values: parsed.values as Record<string, string | boolean | undefined>,
           positionals: parsed.positionals,
         });
       }
   ```

In `README.md`, add this row to the cheat-sheet table directly after the `sbl doctor` row:

```markdown
| `sbl summary` | Check the summary page's `architecture.yml` for drift and print the prompt that refreshes it (`--check` for CI). |
```

Run: `npx vitest run test/unit/cli-contract.test.ts test/unit/command-smoke.test.ts test/docs.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the E2E test**

Create `test/integration/summary-cli.test.ts`:

```ts
// test/integration/summary-cli.test.ts
// E2E: dist/bin.js summary in a temp git repo (isolated HOME/USERPROFILE, no hub).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'bin.js'); // built by the pretest step

function arch(files: string): string {
  return [
    'schema: 1',
    'pitch: A **small** demo.',
    'grid: { cols: 3, rows: 2 }',
    'nodes:',
    '  - id: a',
    '    label: Alpha',
    '    kind: core',
    '    cell: [0, 0]',
    `    files: [${files}]`,
    '  - id: b',
    '    label: Beta',
    '    kind: output',
    '    cell: [2, 0]',
    '  - id: c',
    '    label: Gamma',
    '    kind: external',
    '    cell: [2, 1]',
    'edges:',
    '  - { from: a, to: b, label: calls }',
    '  - { from: b, to: c, label: writes }',
    '',
  ].join('\n');
}

let root: string;
let repo: string;
let env: NodeJS.ProcessEnv;

function git(args: string[]): void {
  execFileSync('git', args, { cwd: repo, env, stdio: 'ignore' });
}

function summary(args: string[] = [], cwd = repo): { out: string; status: number } {
  try {
    const out = execFileSync(process.execPath, [CLI, 'summary', ...args], { cwd, env, encoding: 'utf8' });
    return { out, status: 0 };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string | Buffer };
    const stdout = e.stdout ?? '';
    return { out: typeof stdout === 'string' ? stdout : stdout.toString('utf8'), status: e.status ?? -1 };
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sbl-summary-cli-'));
  const home = join(root, 'home');
  repo = join(root, 'repo');
  mkdirSync(home, { recursive: true });
  mkdirSync(join(repo, 'backlog', 'docs'), { recursive: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  env = { ...process.env, HOME: home, USERPROFILE: home, SBL_SKIP_UPDATE_CHECK: '1', SBL_SKIP_INSTALL: '1' };
  writeFileSync(join(repo, 'backlog', 'config.yml'), 'project_name: "demo"\n');
  writeFileSync(join(repo, 'src', 'main.ts'), 'export const main = 1;\n');
  writeFileSync(join(repo, 'src', 'old.ts'), 'export const old = 1;\n');
  writeFileSync(join(repo, 'backlog', 'docs', 'architecture.yml'), arch('src/main.ts, src/old.ts'));
  git(['init', '-q']);
  git(['add', '-A']);
  git(['-c', 'user.name=sbl-test', '-c', 'user.email=sbl-test@example.com', 'commit', '-q', '-m', 'init']);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('sbl summary (E2E)', () => {
  it('reports a deleted documented path as drift (exit 4), then exits 0 once the file is fixed', () => {
    unlinkSync(join(repo, 'src', 'old.ts'));

    const drift = summary();
    expect(drift.status).toBe(4);
    expect(drift.out).toContain('[warn] architecture.yml valid, 1 drift finding');
    expect(drift.out).toContain('missing-path  nodes.a.files  src/old.ts does not exist');
    expect(drift.out).toContain('next step: ask your agent: "Run the architecture-summary skill to refresh');

    const checked = summary(['--check']);
    expect(checked.status).toBe(4);
    expect(checked.out).toContain('missing-path');
    expect(checked.out).not.toContain('next step');

    writeFileSync(join(repo, 'backlog', 'docs', 'architecture.yml'), arch('src/main.ts'));
    const clean = summary();
    expect(clean.status).toBe(0);
    expect(clean.out).toContain('[ok]   architecture.yml valid, no drift');
  });

  it('exits 1 outside a project', () => {
    const outside = join(root, 'outside');
    mkdirSync(outside);
    expect(summary([], outside).status).toBe(1);
  });
});
```

Run: `npm run build`, then `npx vitest run test/integration/summary-cli.test.ts`
Expected: PASS. The E2E needs the Step 8 dispatch in `dist/`. If it fails before Step 8 is built, the cause is `Unknown command "summary"` (exit 1).

- [ ] **Step 10: Full verification**

Run: `npx tsc -p tsconfig.json --noEmit`, then `npm test`, then `npm run lint`.
Expected: all exit 0. Revert any EOL-only snapshot diffs.

- [ ] **Step 11: Commit**

```bash
git add src/lib/task-list.ts src/commands/summary.ts src/commands/doctor.ts src/cli.ts README.md test/unit/task-list.test.ts test/unit/summary-command.test.ts test/unit/cli-contract.test.ts test/unit/command-smoke.test.ts test/docs.test.ts test/integration/summary-cli.test.ts
git commit -m "feat(cli): add sbl summary with drift report" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Doctor check 5 and summary page banner

**Files:**

- Modify:
  - `src/commands/doctor.ts`
  - `src/dashboard/summary-render.ts`
  - `src/templates/summary.html`
  - `backlog/docs/architecture.yml` (prunes the `tasks:` block)
- Test (modify):
  - `test/unit/doctor.test.ts`
  - `test/unit/summary-render.test.ts`
  - `test/e2e/doctor.e2e.test.ts` (tolerates live repo drift)

**Interfaces:**

- Consumes from Task 1:
  - `detectDrift`, `driftCount`, `summaryAgentPrompt`
  - `DRIFT_CODES`, `DriftCode`, `DriftResult`
- Consumes from Task 2: the doctor `taskRows` now come from `readTaskList`.
- Produces:
  - `DoctorDeps.detectDrift?`
  - `SummaryDrift { count: number; codes: DriftCode[]; prompt: string }`
  - `SummaryModel.drift: SummaryDrift | null`
  - `SummaryDeps.detectDrift?`
  - The `notice-drift` banner, and copy buttons in the missing and drift notices

**The doctor E2E and live drift:** `test/e2e/doctor.e2e.test.ts` runs the built doctor at the repo root. Once check 5 runs drift, the repo's own state decides whether doctor warns: a mapped task becomes Done, a file is renamed, or 20 commits land without a refresh. Step 5 makes the two "exits 0" tests accept exactly one check-5 drift line with exit 4. Every other warning still fails them, so the tests never depend on live repo drift.

**The dogfood prune** (Step 6) is cleanup: TASK-85..92 are Done, so the dogfood file should no longer map them. It does not keep any test green.

- [ ] **Step 1: Write the failing doctor tests**

In `test/unit/doctor.test.ts`:

1. Add `detectDrift: () => ({ findings: [], notes: [] }),` to the defaults in `makeDeps`, after the `loadArchitecture` line. Unit tests never run the real fs or git checks.
2. Add these tests at the end of `describe('check 5: architecture.yml', ...)`:

```ts
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
```

Run: `npx vitest run test/unit/doctor.test.ts`
Expected: FAIL on the new tests. The drift line is missing, `detectDrift` is never called, and the layout throw escapes `runDoctor`.

- [ ] **Step 2: Implement doctor check 5 drift**

In `src/commands/doctor.ts`:

1. Extend the imports:

   ```ts
   import { detectDrift, driftCount } from '../dashboard/summary-drift.js';
   import { layoutArchitecture, type LayoutResult } from '../dashboard/summary-layout.js';
   ```

   The second line replaces the existing `import { layoutArchitecture } from '../dashboard/summary-layout.js';`.

2. Add to `DoctorDeps`, after `layoutArchitecture?`:

   ```ts
     /** Seam for check 5; defaults to the shared drift module. */
     detectDrift?: typeof detectDrift;
   ```

3. Replace the whole check-5 block, from the `// check 5:` comment to the closing `}` of the `else` branch, with:

```ts
  // check 5: curated architecture file of the summary page. Task ids are not
  // passed: the schema would drop unknown ids before drift reports them.
  const arch = (deps.loadArchitecture ?? ((c: string) => loadArchitecture(c)))(cwd);
  if (arch.status === 'missing') {
    emit('skip', `${ARCHITECTURE_PATH} not present (summary page shows the reduced view)`);
  } else if (arch.status === 'invalid') {
    const errors = arch.problems.filter((p) => p.level === 'error').length;
    emit('fail', `${ARCHITECTURE_PATH}: ${errors} error(s)`, [
      ...arch.problems.map((p) => `${p.level}: ${p.path}: ${p.message}`),
      'fix: edit the file or run the architecture-summary skill, then sbl doctor again',
    ]);
  } else {
    let layout: LayoutResult | null = null;
    try {
      layout = (deps.layoutArchitecture ?? layoutArchitecture)(arch.architecture);
    } catch (err) {
      emit('fail', `${ARCHITECTURE_PATH} layout failed (${err instanceof Error ? err.message : String(err)})`);
    }
    if (layout !== null) {
      const warnings = [
        ...arch.problems.map((p) => `warning: ${p.path}: ${p.message}`),
        ...layout.warnings.map((w) => `layout ${w.code} ${w.edge}: ${w.message}`),
      ];
      const size = `${arch.architecture.nodes.length} nodes, ${arch.architecture.edges.length} edges`;
      let findings = 0;
      let driftError: string | null = null;
      try {
        findings = (deps.detectDrift ?? detectDrift)(cwd, arch.architecture, { tasks: taskRows }).findings.length;
      } catch (err) {
        driftError = err instanceof Error ? err.message : String(err);
      }
      if (warnings.length > 0) {
        emit('warn', `${ARCHITECTURE_PATH} valid with ${warnings.length} warning(s) (${size})`, warnings);
      }
      if (driftError !== null) {
        emit('warn', `architecture.yml drift check failed (${driftError})`);
      } else if (findings > 0) {
        emit('warn', `architecture.yml valid, ${driftCount(findings)} – run sbl summary for details`);
      }
      if (warnings.length === 0 && driftError === null && findings === 0) {
        emit('ok', `${ARCHITECTURE_PATH} valid (${size}, layout clean)`);
      }
    }
  }
```

The `–` in the drift line is an en dash (U+2013), as in the spec.

Run: `npx vitest run test/unit/doctor.test.ts`
Expected: PASS, including the unchanged existing tests.

- [ ] **Step 3: Write the failing page tests**

In `test/unit/summary-render.test.ts`:

1. Add `buildSummaryModel,` to the import list from `../../src/dashboard/summary-render.js`, in alphabetical position before `buildSummaryView`.
2. Add a new import: `import { SUMMARY_PROMPTS } from '../../src/dashboard/summary-drift.js';`
3. Add `drift: null` to every `SummaryModel` literal:
   - in `validModel()`: `return { facts: FACTS, load, layout: layoutArchitecture(load.architecture), renderError: null, drift: null };`
   - `const reducedModel: SummaryModel = { facts: FACTS, load: missing, layout: null, renderError: null, drift: null };`
   - in the test "renders the notice into the page for an invalid file": `renderSummary(DATA, { facts: FACTS, load, layout: null, renderError: null, drift: null })`
4. Add these tests at the end of `describe('noticeHtml', ...)`:

```ts
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
```

The existing test "is empty for a valid file" keeps covering "no banner when `drift` is null".

5. Add a new `describe` block after `describe('writeSummaryPage', ...)`:

```ts
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
```

Run: `npx vitest run test/unit/summary-render.test.ts`
Expected: FAIL on the new tests. There is no copy button, no banner, no CSS, `model.drift` is undefined, and `loadArchitecture` is called only once.

- [ ] **Step 4: Implement the page drift**

In `src/dashboard/summary-render.ts`:

1. Add the import after the `summary-facts` import:

   ```ts
   import {
     detectDrift,
     driftCount,
     DRIFT_CODES,
     summaryAgentPrompt,
     type DriftCode,
     type DriftDeps,
   } from './summary-drift.js';
   ```

2. Add the drift field to `SummaryModel`, after `renderError`:

   ```ts
     /** spec 2026-10-10: drift of a valid file for the banner; null when clean, not valid or not checkable */
     drift: SummaryDrift | null;
   ```

3. Add the new interface directly after `SummaryModel`:

   ```ts
   export interface SummaryDrift {
     count: number;
     /** distinct finding codes in signal order */
     codes: DriftCode[];
     prompt: string;
   }
   ```

4. Add to `SummaryDeps`:

   ```ts
     detectDrift?: typeof detectDrift;
   ```

5. Replace `buildSummaryModel` with:

```ts
/** Collects facts, loads and lays out the architecture file. Throws only on unexpected errors. */
export function buildSummaryModel(cwd: string, data: DashboardData, deps: SummaryDeps = {}): SummaryModel {
  const facts = collectSummaryFacts(cwd, deps);
  const load = (deps.loadArchitecture ?? loadArchitecture)(cwd, { taskIds: data.tasks.map((t) => t.id) });
  const layout = load.status === 'valid' ? (deps.layoutArchitecture ?? layoutArchitecture)(load.architecture) : null;
  const drift = load.status === 'valid' ? summaryDrift(cwd, data, deps) : null;
  return { facts, load, layout, renderError: null, drift };
}

/**
 * Drift for the banner (spec 2026-10-10). Loads the file a second time without
 * task ids, because the page load drops unknown ids and would hide unknown-task
 * findings. Never throws: the banner is optional.
 */
function summaryDrift(cwd: string, data: DashboardData, deps: SummaryDeps): SummaryDrift | null {
  try {
    const raw = (deps.loadArchitecture ?? loadArchitecture)(cwd);
    if (raw.status !== 'valid') return null;
    const tasks = data.source === 'backlog-json' ? data.tasks.map((t) => ({ id: t.id, status: t.status })) : null;
    const driftDeps: DriftDeps = deps.runCapture ? { runCapture: deps.runCapture } : {};
    const { findings } = (deps.detectDrift ?? detectDrift)(cwd, raw.architecture, { tasks, deps: driftDeps });
    if (findings.length === 0) return null;
    const codes = DRIFT_CODES.filter((code) => findings.some((f) => f.code === code));
    return { count: findings.length, codes, prompt: summaryAgentPrompt('drift') };
  } catch {
    return null;
  }
}
```

6. Add these helpers directly above `noticeHtml`. `COPY_ICON` matches the client-side constant in `summary.html`:

```ts
const DRIFT_LABELS: Record<DriftCode, string> = {
  'missing-path': 'missing paths',
  'done-task': 'Done tasks',
  'unknown-task': 'unknown tasks',
  'stale-file': 'stale file',
};

/** Same icon as the client-side COPY_ICON in summary.html; the delegated click handler copies data-copy. */
const COPY_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
  '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>' +
  '<path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>';

function copyPromptButton(prompt: string): string {
  return (
    `<button class="copy" type="button" data-copy="${esc(prompt)}" ` +
    `aria-label="Copy the prompt for your agent" title="Copy the prompt for your agent">${COPY_ICON}</button>`
  );
}
```

7. In `noticeHtml`, replace the `missing` branch return with:

```ts
    return (
      '<div class="notice"><p>No architecture file yet. Run the <code>architecture-summary</code> skill in your agent ' +
      `or create <code>${ARCHITECTURE_PATH}</code> (schema: <a href="${SUMMARY_DOCS_URL}">docs</a>).` +
      `${copyPromptButton(summaryAgentPrompt('missing'))}</p></div>`
    );
```

8. In `noticeHtml`, replace the final `return '';` with:

```ts
  if (model.drift !== null) {
    const { count, codes, prompt } = model.drift;
    const text = `${driftCount(count)} (${codes.map((c) => DRIFT_LABELS[c]).join(', ')}) – the diagram may be out of date`;
    return `<div class="notice notice-drift" role="status"><p>${esc(text)}${copyPromptButton(prompt)}</p></div>`;
  }
  return '';
```

9. Update the doc comment on `noticeHtml` to `/** Server-rendered notice between header and canvas (D6, E2, E3, drift banner); empty for a clean valid file. */`.
10. In `writeSummaryPage`, change the fallback model literal to:

```ts
      html = renderSummary(data, {
        facts,
        load: { status: 'missing', path: ARCHITECTURE_PATH },
        layout: null,
        renderError: message,
        drift: null,
      });
```

In `src/templates/summary.html`, add two rules directly after `.notice p + p { margin-top:6px; }`. They use no new colours, only existing tokens:

```css
  .notice-drift { border-color:var(--line); background:var(--surface-2); color:var(--muted); }
  .notice p .copy { vertical-align:middle; margin-left:4px; }
```

No JavaScript change is needed. The delegated `document` click handler resolves `.copy` before its `if (!svg) return;` guard, so the buttons also work in the reduced view.

Run: `npx vitest run test/unit/summary-render.test.ts`
Expected: PASS. The `buildSummaryView` snapshots stay unchanged, because the view model has no drift field.

- [ ] **Step 5: Make the doctor E2E independent of live repo drift**

In `test/e2e/doctor.e2e.test.ts`, add this helper directly after the `runDoctor` function:

```ts
/** Check 5 drift line; its `–` is an en dash (U+2013). */
const DRIFT_LINE = /^\[warn\] architecture\.yml valid, \d+ drift findings? – run sbl summary for details$/;

/**
 * Doctor runs at the repo root, so check 5 sees the repo's live drift (Done
 * tasks, renamed files, commit count). Accept exactly that one warning with
 * exit 4; any other warning, or any other exit code, still fails.
 */
function expectCleanExceptDrift({ out, status }: DoctorResult): void {
  const lines = out.split(/\r?\n/);
  const driftLines = lines.filter((l) => DRIFT_LINE.test(l));
  const rest = lines.filter((l) => !DRIFT_LINE.test(l)).join('\n');
  expect(rest).toContain('[ok]');
  expect(rest).not.toContain('[warn]');
  if (driftLines.length === 0) {
    expect(status).toBe(0);
  } else {
    expect(driftLines).toHaveLength(1);
    expect(status).toBe(4);
  }
}
```

Replace the two "exits 0" tests with the following. The Restricted-policy test stays unchanged:

```ts
  it('exits 0 when policy is permissive (4 only for live check-5 drift)', () => {
    expectCleanExceptDrift(runDoctor({ SBL_FAKE_POLICY: 'RemoteSigned' }));
  });

  it('exits 0 for an Undefined policy on Windows (4 only for live check-5 drift)', () => {
    expectCleanExceptDrift(runDoctor({ SBL_FAKE_POLICY: 'Undefined' }));
  });
```

The `doctor summary: N ok, N warn, ...` line contains `warn` but not `[warn]`, so it never trips the assertion.

Run: `npm run build`, then `npx vitest run test/e2e/doctor.e2e.test.ts`
Expected: PASS. Do this before Step 6: at this point the dogfood file still maps the Done tasks TASK-85..92, so doctor prints the drift line and exits 4. That run exercises the drift branch of the helper.

- [ ] **Step 6: Prune the dogfood `tasks:` block**

This is dogfood cleanup. TASK-85..92 are all Done, so each entry is a `done-task` finding and no longer belongs in the curated file. Delete these nine lines at the end of `backlog/docs/architecture.yml`. Use the Edit tool, which keeps the file's CRLF endings. The `commands:` block above becomes the last block:

```yaml
tasks:
  TASK-85: summary
  TASK-86: summary
  TASK-87: summary
  TASK-88: summary
  TASK-89: summary
  TASK-90: hub
  TASK-91: cli
  TASK-92: summary
```

Run: `npm run build`, then `node dist/bin.js summary`
Expected: exit 0 and `[ok]   architecture.yml valid, no drift`, possibly followed by `note:` lines. If git reports 20 or more commits, run `git log --oneline -1 -- backlog/docs/architecture.yml` and report the result to the controller; do not change the threshold.

- [ ] **Step 7: Full verification**

Run: `npx tsc -p tsconfig.json --noEmit`, then `npm test`, then `npm run lint`.
Expected: all exit 0, including `test/e2e/doctor.e2e.test.ts` and `test/integration/serve.test.ts`. Revert any EOL-only snapshot diffs.

- [ ] **Step 8: Commit**

```bash
git add src/commands/doctor.ts src/dashboard/summary-render.ts src/templates/summary.html backlog/docs/architecture.yml test/unit/doctor.test.ts test/unit/summary-render.test.ts test/e2e/doctor.e2e.test.ts
git commit -m "feat(summary): surface drift in doctor and on the summary page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Onboarding (rule 7, init hint, skill template) and docs

**Files:**

- Modify:
  - `src/templates/workflow-block.md`
  - `src/templates/skill-architecture-summary.md`
  - `src/commands/init.ts`
  - `docs/guide/project-summary.md`
  - `docs/guide/quickstart.md`
- Test (modify):
  - `test/unit/templates.test.ts`
  - `test/unit/glue-skills.test.ts`
  - `test/integration/init-preflight.test.ts`

**Interfaces:**

- Consumes: `ARCHITECTURE_PATH` (summary-schema), and the `sbl summary` command from Task 2.
- Produces: `INIT_SUMMARY_HINT` (exported from `src/commands/init.ts`), binding rule 7, and the updated skill procedure.

- [ ] **Step 1: Write the failing template and skill tests**

In `test/unit/templates.test.ts`, inside `describe('workflow-block.md', ...)`, add:

```ts
  it('binds rule 7: keep the project summary current, only with consent', () => {
    expect(t).toContain(
      '7. Keep the project summary current — at session start, if `backlog/docs/architecture.yml` is missing, offer once to run the architecture-summary skill. At the end of the pipeline, after a merge, run `sbl summary --check`; if it reports drift, offer a refresh. Never run the skill without the user\'s consent.',
    );
    expect(t.indexOf('7. Keep the project summary current')).toBeGreaterThan(t.indexOf('6. Delegate by tier'));
    expect(t.indexOf('7. Keep the project summary current')).toBeLessThan(t.indexOf('### Model routing for subagents'));
  });
```

In `test/unit/glue-skills.test.ts`, inside `describe('skill-architecture-summary.md', ...)`, add:

```ts
  it('runs on drift and fixes the sbl summary findings', () => {
    expect(t).toMatch(/^- `sbl summary` reports drift\.$/m);
    expect(t).toContain('run `sbl summary` first');
    // the template wraps at about 80 columns, so match across line breaks
    expect(t).toMatch(/prune `tasks` entries for Done or unknown\s+tasks/i);
    expect(t).toMatch(/finish when it exits 0, or 4 only for warnings the user\s+accepts/i);
  });
```

The existing test /run `sbl doctor` again until check 5/i must still pass, because step 6 stays.

Run: `npx vitest run test/unit/templates.test.ts test/unit/glue-skills.test.ts`
Expected: FAIL on the two new tests.

- [ ] **Step 2: Update the templates**

In `src/templates/workflow-block.md`, insert this line directly after the rule 6 line (`6. Delegate by tier — ...`), before the empty line that precedes `### Model routing for subagents`:

```markdown
7. Keep the project summary current — at session start, if `backlog/docs/architecture.yml` is missing, offer once to run the architecture-summary skill. At the end of the pipeline, after a merge, run `sbl summary --check`; if it reports drift, offer a refresh. Never run the skill without the user's consent.
```

In `src/templates/skill-architecture-summary.md`:

1. In `## When this skill runs`, add a fourth bullet after "After structural changes: ...":

   ```markdown
   - `sbl summary` reports drift.
   ```

2. Replace procedure step 2 (the two lines starting `2. If \`backlog/docs/architecture.yml\` exists, read it.` through `change only what is outdated or missing.`) with:

   ```markdown
   2. If `backlog/docs/architecture.yml` exists, run `sbl summary` first and
      read the file. Fix every finding it lists: remove or correct paths that no
      longer exist (`missing-path`), prune `tasks` entries for Done or unknown
      tasks (`done-task`, `unknown-task`), and refresh the nodes whose code
      changed (`stale-file`). Keep curated prose (`pitch`, `purpose`, `why`,
      highlight texts) unless the code contradicts it; change only what is
      outdated or missing.
   ```

3. Replace step 7 (`7. Present the diff ...` through `` `sbl dashboard`, then the **Summary** tab.``) with:

   ```markdown
   7. Run `sbl summary`. Finish when it exits 0, or 4 only for warnings the user
      accepts; fix every drift finding it lists and run it again.
   8. Present the diff of `backlog/docs/architecture.yml` for review and STOP
      until the user approves the prose. Point to the live page:
      `sbl dashboard`, then the **Summary** tab.
   ```

Step 6 (`sbl doctor` until check 5 reports `[ok]`) stays unchanged.

Run: `npx vitest run test/unit/templates.test.ts test/unit/glue-skills.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing init-hint tests**

In `test/integration/init-preflight.test.ts`:

1. Extend the fs import to `import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';`.
2. Change the init import to `import { INIT_SUMMARY_HINT, runInit, type ParsedArgs } from '../../src/commands/init.js';`.
3. Add these tests at the end of the `describe`:

```ts
  it('ends with the architecture-summary hint while architecture.yml is missing', async () => {
    const cwd = tempCwd('hint');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit(cwd, args(), { preflight: () => okResult(), doctor: () => 0 });
      expect(INIT_SUMMARY_HINT).toBe(
        'next step: ask your agent to run the architecture-summary skill (writes backlog/docs/architecture.yml for the summary page)',
      );
      const lines = spy.mock.calls.map((c) => String(c[0]));
      expect(lines[lines.length - 1]).toBe(INIT_SUMMARY_HINT);
      expect(lines.findIndex((l) => l.startsWith('super-backlog init complete'))).toBeLessThan(lines.indexOf(INIT_SUMMARY_HINT));
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('prints no hint when architecture.yml exists', async () => {
    const cwd = tempCwd('hint-present');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit(cwd, args(), {
        preflight: () => okResult(),
        // the doctor seam runs after the init actions and before the hint check
        doctor: (c) => {
          mkdirSync(join(c, 'backlog', 'docs'), { recursive: true });
          writeFileSync(join(c, 'backlog', 'docs', 'architecture.yml'), 'schema: 1\n');
          return 0;
        },
      });
      expect(spy.mock.calls.map((c) => String(c[0]))).not.toContain(INIT_SUMMARY_HINT);
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('prints no hint on --dry-run', async () => {
    const cwd = tempCwd('hint-dryrun');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit(cwd, args({ 'dry-run': true }), { preflight: () => okResult(), doctor: () => 0 });
      expect(spy.mock.calls.map((c) => String(c[0]))).not.toContain(INIT_SUMMARY_HINT);
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });
```

Run: `npx vitest run test/integration/init-preflight.test.ts`
Expected: FAIL. `INIT_SUMMARY_HINT` is undefined and the hint is never printed.

- [ ] **Step 4: Implement the init hint**

In `src/commands/init.ts`:

1. Add the import after the `runDoctor` import:

   ```ts
   import { ARCHITECTURE_PATH } from '../dashboard/summary-schema.js';
   ```

2. Add the constant after `INIT_PREFLIGHT_UNITS`:

   ```ts
   /** spec 2026-10-10: printed after a real init while the summary page has no curated file. */
   export const INIT_SUMMARY_HINT =
     'next step: ask your agent to run the architecture-summary skill (writes backlog/docs/architecture.yml for the summary page)';
   ```

3. In the success path, replace `return warnings.length > 0 || unverified ? 4 : 0;` with:

   ```ts
       if (!existsSync(join(cwd, ...ARCHITECTURE_PATH.split('/')))) console.log(INIT_SUMMARY_HINT);
       return warnings.length > 0 || unverified ? 4 : 0;
   ```

The dry-run branch returns earlier, so dry runs never print the hint. `existsSync` and `join` are already imported.

Run: `npx vitest run test/integration/init-preflight.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the user docs**

In `docs/guide/project-summary.md`:

1. At the end of the `## Create the architecture file` intro paragraph, after "...and stops for your review.", add the sentence:

   ```markdown
   While the file is missing, `sbl init` ends with a hint to ask your agent for it.
   ```

2. After the check 5 paragraph ("Check 5 validates ... crossing)."), add:

   ```markdown
   On a valid file, check 5 also counts the drift findings described in
   [Keeping it current](#keeping-it-current) and points to `sbl summary`.
   ```

3. Insert this new section directly before `## When something is wrong`:

````markdown
## Keeping it current

`sbl summary` compares the curated file with the code and the backlog:

```bash
sbl summary
```

It validates the file like doctor check 5, lists schema and layout warnings,
and then lists four kinds of drift, each with its path in the file:

| Finding | Meaning |
| --- | --- |
| `missing-path` | A path in a node's `files` no longer exists. An entry that ends in `/` must be a directory. |
| `done-task` | A `tasks` entry maps a task that is Done. |
| `unknown-task` | A `tasks` entry names a task the backlog no longer lists (archived, deleted or never created). |
| `stale-file` | 20 or more commits changed the documented files since the file was last committed. |

The last line names the prompt to hand to your agent, for example
"Run the architecture-summary skill to refresh backlog/docs/architecture.yml;
sbl summary lists the drift findings." When the backlog CLI or git is
unavailable, the affected checks are skipped and a `note:` line says why.

| Situation | Exit code |
| --- | --- |
| Valid file, no warnings, no drift | `0` |
| Missing file, warnings, or drift | `4` |
| Invalid file, or not inside a project | `1` |

`sbl summary --check` prints the same report without the prompt and uses the
same exit codes, for CI and for the agent's end-of-pipeline check. The
workflow block asks the agent to run it after a merge and to offer a refresh
when it reports drift; the agent never runs the skill without your consent.

The summary page shows the same information as a banner with the number of
findings and a copy button for the prompt.
````

4. In `## When something is wrong`, replace the bullet `- **No file:** the reduced view, without a warning.` with:

   ```markdown
   - **No file:** the reduced view plus a notice with a copy button for the
     agent prompt that creates the file.
   - **Drift:** the full page plus a banner with the number of drift findings
     and a copy button for the refresh prompt; `sbl summary` lists them.
   ```

In `docs/guide/quickstart.md`:

1. Add this row directly after the `sbl doctor` row of the command table:

   ```markdown
   | `sbl summary` | Check the summary page's `architecture.yml` for drift and print the prompt that refreshes it; `--check` for CI. |
   ```

2. At the end of the paragraph "Each project also gets a [project summary page](./project-summary) ... at a glance.", add the sentence:

   ```markdown
   While its `backlog/docs/architecture.yml` is missing, `sbl init` ends with a hint to ask your agent for the `architecture-summary` skill.
   ```

Run: `npm run lint`
Expected: exit 0. If cspell flags a word, rephrase it; do not add dictionary entries for ordinary English.

- [ ] **Step 6: Full verification**

Run: `npx tsc -p tsconfig.json --noEmit`, then `npm test`, then `npm run lint`.
Expected: all exit 0. `test/e2e/update.e2e.test.ts` still finds rule 6 after the refresh. Revert any EOL-only snapshot diffs.

- [ ] **Step 7: Commit**

```bash
git add src/templates/workflow-block.md src/templates/skill-architecture-summary.md src/commands/init.ts docs/guide/project-summary.md docs/guide/quickstart.md test/unit/templates.test.ts test/unit/glue-skills.test.ts test/integration/init-preflight.test.ts
git commit -m "feat(onboarding): prompt for the architecture summary and keep it current" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dogfood and cleanup

**Files:**

- Modify:
  - `backlog/docs/architecture.yml`
  - `AGENTS.md`, `CLAUDE.md`, `.claude/skills/**`, `.opencode/skill/**` (the managed glue, refreshed via the CLI only)
- Backlog (controller-gated, CLI only): TASK-98

**Interfaces:**

- Consumes:
  - the built `dist/bin.js` with `summary`, `update` and `phase`
  - the templates from Task 4
- Produces:
  - a dogfood file for which `sbl summary` exits 0
  - refreshed installed glue (rule 7 and the new skill text)
  - TASK-98 closed as superseded

- [ ] **Step 1: Update the dogfood architecture file**

Edit `backlog/docs/architecture.yml` with the Edit tool, which keeps CRLF:

1. Change the `cli` node `purpose` to:

   ```yaml
       purpose: Parses arguments and dispatches eight commands (init, uninstall, update, dashboard, models, phase, doctor, summary). Maps every outcome to an exit code and checks for a newer release.
   ```

2. Change the `cli` node `files` to:

   ```yaml
       files: [src/bin.ts, src/cli.ts, src/commands/, src/commands/doctor.ts, src/commands/summary.ts, src/lib/preflight.ts]
   ```

3. Add this line to the `cli` node `commands`, after the `sbl doctor` entry:

   ```yaml
         - { run: sbl summary, note: check the summary for drift }
   ```

4. Change the `summary` node `files` to:

   ```yaml
       files: [src/dashboard/summary-facts.ts, src/dashboard/summary-schema.ts, src/dashboard/summary-layout.ts, src/dashboard/summary-render.ts, src/dashboard/summary-drift.ts, src/lib/yamlmini.ts, src/templates/summary.html, backlog/docs/architecture.yml]
   ```

5. Add this line to the top-level `commands:` group `Workflow:`, after the `sbl doctor` entry:

   ```yaml
       - { run: sbl summary, note: check the summary for drift }
   ```

These edits stay within the schema limits: at most 12 files and 6 commands per node, and 8 commands per group.

Run: `npm run build`, then `node dist/bin.js summary`
Expected: exit 0 and `[ok]   architecture.yml valid, no drift`.

Run: `node dist/bin.js doctor`
Expected: check 5 prints `[ok]   backlog/docs/architecture.yml valid (..., layout clean)`. The overall exit code is 0, or 4 only because of a local PowerShell policy warning.

- [ ] **Step 2: Refresh the managed glue**

Run: `node dist/bin.js update --no-self`
Expected: exit 0 or 4, and the injected files are refreshed.

Run: `git status --short` and `git diff --stat`.

- Expected diffs:
  - `AGENTS.md` (and `CLAUDE.md` if it carries the block) now contain rule 7.
  - `.claude/skills/architecture-summary/SKILL.md` and `.opencode/skill/architecture-summary/SKILL.md` now contain the drift steps.
- Any other changed file is not part of this task. Leave it unstaged and report it to the controller.

- [ ] **Step 3: Full verification**

Run: `npx tsc -p tsconfig.json --noEmit`, then `npm test`, then `npm run lint`.
Expected: all exit 0. Revert any EOL-only snapshot diffs.

- [ ] **Step 4: Commit**

```bash
git add backlog/docs/architecture.yml AGENTS.md CLAUDE.md .claude/skills .opencode/skill
git commit -m "chore(summary): refresh dogfood architecture and managed glue for sbl summary" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5 (controller, human-gated): Close TASK-98 as superseded**

The implementing subagent does not run this step. The controller presents the evidence to the user and runs the commands only after explicit approval. The evidence is:

- the Task 1-5 commits;
- `node dist/bin.js summary` exiting 0;
- `npm test` passing.

TASK-98 ACs map to the evidence like this:

- #1, behaviour decided and documented: covered by the spec and by `docs/guide/project-summary.md`.
- #2, skill prunes Done ids: covered by the skill template, step 2.
- #3, dogfood clean and doctor clean: covered by Task 3 Step 6 and Task 5 Step 1.
- #4, npm test passes.

```bash
npx --no-install backlog task edit TASK-98 --check-ac 1 --check-ac 2 --check-ac 3 --check-ac 4 --final-summary "Superseded by summary drift detection (spec 2026-10-10): sbl summary, doctor check 5 and the summary page report Done and unknown tasks entries as drift, the architecture-summary skill prunes them, and the dogfood file is clean."
node dist/bin.js phase TASK-98 done
npx --no-install backlog task edit TASK-98 -s Done
git add backlog/tasks
git commit -m "chore(backlog): close TASK-98 as superseded by summary drift" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

`git add backlog/tasks` stages only the files the CLI changed. Check `git status --short backlog/` first.

---

## Self-Review Notes

**Spec coverage:**

| Spec item | Where it is covered |
| --- | --- |
| Drift module | Task 1 |
| Shared prompts | Task 1, used in Tasks 2 and 3 |
| Command with output formats and exit table | Task 2 |
| `readTaskList` extraction | Task 2 |
| HELP, README and dispatch | Task 2 |
| E2E | Task 2 Step 9 |
| Doctor check 5 | Task 3 |
| Page banner and copy buttons | Task 3 |
| Rule 7, init hint and skill | Task 4 |
| Guide and quickstart docs | Task 4 |
| Dogfood, purpose text and TASK-98 | Tasks 3 and 5 |

**Spec ambiguities resolved in this plan:**

1. **Task ids when loading.** The spec says the command loads with `loadArchitecture(cwd, { taskIds })`, but that filter removes unknown ids and would make `unknown-task` dead. The command and doctor therefore load without task ids. The page keeps its task-id load for rendering and loads a second time without task ids for drift.
2. **"Inside a project".** Doctor has no project detection to reuse, so the command checks for `backlog/config.yml` (as `init` and `update` do) and exits 1 with an `error:` line on stderr.
3. **Line formats.** The spec states:
   - **Findings:** `  ${code.padEnd(14)}${path}` plus at least two spaces up to column 17, then the message. This reproduces the spec sample exactly.
   - **Warning lines:** `  warning: <path>: <message>` and `  layout <code> <edge>: <message>`.
   - **Status with warnings:** `[warn] architecture.yml valid with N warning(s), <no drift | N drift finding(s)>`.
   - **Next-step prompt:** printed only for missing, invalid or drift, not for warnings alone.
   - **Invalid file:** lists error-level problems only.
4. **Doctor line wording.** The drift line uses the literal `architecture.yml` from the spec, while the other check-5 lines keep `backlog/docs/architecture.yml`. A layout throw is a `[fail]` line and a drift throw is a `[warn]` line.
5. **Dogfood timing.** The Done-task prune happens in Task 3 (Step 6), next to the doctor change, as dogfood cleanup. No test depends on it.
6. **Doctor E2E vs live drift.** Doctor runs at the repo root, so check 5 sees live drift: Done tasks, renamed paths, or 20 or more commits. Task 3 Step 5 lets the "exits 0" tests accept exit 4 only when the single `[warn]` line is the check-5 drift line. Any other warning still fails them. This removes the risk that the tests turn red over time.
