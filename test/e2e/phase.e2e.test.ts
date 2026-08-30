// test/e2e/phase.e2e.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import process from 'node:process';

import spawn from 'cross-spawn';
import { afterAll, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'bin.js');
const REPO = join(__dirname, '..', '..');
const BIN_DIR = join(REPO, 'node_modules', '.bin');

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function envWithBin(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    SBL_SKIP_UPDATE_CHECK: '1',
    PATH: BIN_DIR + delimiter + (process.env.PATH ?? ''),
  };
}

interface RunOut {
  status: number;
  stdout: string;
}

function runBacklog(cwd: string, args: string[]): RunOut {
  const r = spawn.sync('backlog', args, { cwd, env: envWithBin(), encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: (r.stdout ?? '').toString() };
}

function runSbl(cwd: string, args: string[]): RunOut {
  const r = spawn.sync(process.execPath, [CLI, ...args], { cwd, env: envWithBin(), encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: (r.stdout ?? '').toString() };
}

function scaffold(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'sbl-phase-e2e-'));
  dirs.push(cwd);
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'phase-e2e', private: true }));
  spawn.sync('git', ['init', '-q'], { cwd });
  /* sbl init scaffolds backlog/config.yml directly (backlog init is interactive) */
  mkdirSync(join(cwd, 'backlog'), { recursive: true });
  writeFileSync(join(cwd, 'backlog', 'config.yml'), 'project_name: phase-e2e\n');
  return cwd;
}

function labelsOf(cwd: string, id: string): string[] {
  const out = runBacklog(cwd, ['task', 'view', id, '--json']);
  const parsed = JSON.parse(out.stdout) as { task: { labels: string[] } };
  return parsed.task.labels;
}

describe('sbl phase e2e (real backlog CLI)', () => {
  it('walks spec -> plan -> impl -> verify -> done', () => {
    const cwd = scaffold();
    expect(runBacklog(cwd, ['task', 'create', 'Phase walker', '-l', 'phase/spec', '--plain']).status).toBe(0);
    expect(labelsOf(cwd, 'TASK-1')).toContain('phase/spec');

    expect(runSbl(cwd, ['phase', 'TASK-1']).stdout).toContain('phase/spec');
    expect(runSbl(cwd, ['phase', 'TASK-1', 'plan']).status).toBe(0);
    expect(labelsOf(cwd, 'TASK-1')).toContain('phase/plan');
    expect(labelsOf(cwd, 'TASK-1')).not.toContain('phase/spec');

    expect(runSbl(cwd, ['phase', 'TASK-1', 'impl']).status).toBe(0);
    expect(runSbl(cwd, ['phase', 'TASK-1', 'verify']).status).toBe(0);
    expect(runSbl(cwd, ['phase', 'TASK-1', 'done']).status).toBe(0);
    expect(labelsOf(cwd, 'TASK-1')).toEqual([]);
  });

  it('rejects transitions on tasks without a phase label', () => {
    const cwd = scaffold();
    expect(runBacklog(cwd, ['task', 'create', 'Bare', '--plain']).status).toBe(0);
    const res = runSbl(cwd, ['phase', 'TASK-1', 'impl']);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('no phase label');
  });
});
