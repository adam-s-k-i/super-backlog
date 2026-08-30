import { describe, expect, it } from 'vitest';
import { runPhase } from '../../src/commands/phase.js';
import type { RunResult } from '../../src/lib/run.js';

interface Call { cmd: string; args: string[]; }

function viewJson(labels: string[]): string {
  return JSON.stringify({ schemaVersion: 1, kind: 'task-view', task: { id: 'TASK-9', labels } });
}

function makeDeps(labels: string[], editStatus = 0) {
  const calls: Call[] = [];
  const out: string[] = [];
  const run = (cmd: string, args: string[]): RunResult => {
    calls.push({ cmd, args });
    if (args.includes('view')) return { status: 0, stdout: viewJson(labels), stderr: '' };
    return { status: editStatus, stdout: '', stderr: editStatus === 0 ? '' : 'edit failed' };
  };
  return {
    deps: { resolveBacklog: () => 'backlog.cmd', run, log: (l: string) => out.push(l) },
    calls,
    out,
  };
}

const args = (positionals: string[], json = false) => ({
  values: json ? { json: true } : {},
  positionals,
});

describe('sbl phase (query mode)', () => {
  it('prints the current phase', () => {
    const d = makeDeps(['feature', 'phase/plan']);
    expect(runPhase('/proj', args(['TASK-9']), d.deps)).toBe(0);
    expect(d.out.some((l) => l.includes('phase/plan'))).toBe(true);
  });
  it('prints none for tasks without a phase label', () => {
    const d = makeDeps(['feature']);
    expect(runPhase('/proj', args(['TASK-9']), d.deps)).toBe(0);
    expect(d.out.some((l) => l.includes('none'))).toBe(true);
  });
  it('supports --json output', () => {
    const d = makeDeps(['phase/spec']);
    expect(runPhase('/proj', args(['TASK-9'], true), d.deps)).toBe(0);
    const jsonLine = d.out.find((l) => l.startsWith('{'));
    expect(jsonLine && JSON.parse(jsonLine)).toEqual({
      id: 'TASK-9',
      phase: 'spec',
      labels: ['phase/spec'],
    });
  });
});

describe('sbl phase (transition mode)', () => {
  it('advances spec -> plan with one edit call swapping labels', () => {
    const d = makeDeps(['feature', 'phase/spec']);
    expect(runPhase('/proj', args(['TASK-9', 'plan']), d.deps)).toBe(0);
    expect(d.calls).toEqual([
      { cmd: 'backlog.cmd', args: ['task', 'view', 'TASK-9', '--json'] },
      { cmd: 'backlog.cmd', args: ['task', 'edit', 'TASK-9', '--remove-label', 'phase/spec', '--add-label', 'phase/plan'] },
    ]);
    expect(d.out.some((l) => l.includes('phase/plan'))).toBe(true);
  });
  it('done removes the label only', () => {
    const d = makeDeps(['phase/verify']);
    expect(runPhase('/proj', args(['TASK-9', 'done']), d.deps)).toBe(0);
    expect(d.calls[1].args).toEqual([
      'task', 'edit', 'TASK-9', '--remove-label', 'phase/verify',
    ]);
  });
  it('rejects unknown targets with exit 1 before any CLI call', () => {
    const d = makeDeps(['phase/spec']);
    expect(runPhase('/proj', args(['TASK-9', 'deploy']), d.deps)).toBe(1);
    expect(d.calls).toHaveLength(0);
  });
  it('rejects transition when the task has no phase label (except spec)', () => {
    const d = makeDeps(['feature']);
    expect(runPhase('/proj', args(['TASK-9', 'impl']), d.deps)).toBe(1);
    expect(d.out.some((l) => /phase/.test(l))).toBe(true);
  });
  it('points at sbl doctor on multiple phase labels', () => {
    const d = makeDeps(['phase/spec', 'phase/impl']);
    expect(runPhase('/proj', args(['TASK-9', 'plan']), d.deps)).toBe(1);
    expect(d.out.some((l) => l.includes('sbl doctor'))).toBe(true);
  });
  it('exits 3 when the upstream edit fails', () => {
    const d = makeDeps(['phase/spec'], 1);
    expect(runPhase('/proj', args(['TASK-9', 'plan']), d.deps)).toBe(3);
  });
});

describe('sbl phase (environment failures)', () => {
  it('exits 1 when the backlog CLI cannot be resolved', () => {
    const d = makeDeps([]);
    expect(runPhase('/proj', args(['TASK-9']), { ...d.deps, resolveBacklog: () => null })).toBe(1);
  });
  it('exits 1 on invalid view JSON', () => {
    const d = makeDeps([]);
    const bad = {
      ...d.deps,
      run: (): RunResult => ({ status: 0, stdout: 'not json', stderr: '' }),
    };
    expect(runPhase('/proj', args(['TASK-9']), bad)).toBe(1);
  });
  it('exits 1 when the task id is missing', () => {
    const d = makeDeps([]);
    expect(runPhase('/proj', args([]), d.deps)).toBe(1);
  });
});
