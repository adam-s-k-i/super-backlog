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
