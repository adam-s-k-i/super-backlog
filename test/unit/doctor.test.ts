import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runDoctor, type DoctorDeps } from '../../src/commands/doctor.js';

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
    readFloorplanStatus: () => ({ state: 'missing' }),
    legacyArchitectureExists: () => false,
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
      // a current map, so the policy line is the only skip
      readFloorplanStatus: () => ({ state: 'map', builtAt: '2026-11-28T13:46:30.507Z', files: 1, nodes: 1, commitsSince: 0 }),
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

describe('check 5: floorplan map', () => {
  const map = { state: 'map', builtAt: '2026-11-28T13:46:30.507Z', files: 165, nodes: 11 } as const;

  it('skips without a map', () => {
    const d = makeDeps();
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines).toContain(
      '[skip] no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)',
    );
  });

  it('warns with the fix line for an unreadable graph.json (exit 4)', () => {
    const d = makeDeps({ readFloorplanStatus: () => ({ state: 'invalid', reason: 'not valid JSON' }) });
    expect(runDoctor('/proj', d)).toBe(4);
    const at = d.lines.indexOf('[warn] floorplan/graph.json unreadable (not valid JSON)');
    expect(at).toBeGreaterThan(-1);
    expect(d.lines[at + 1]).toBe('        fix: ask your agent to update the floorplan');
  });

  it('is ok for a current map', () => {
    const d = makeDeps({ readFloorplanStatus: () => ({ ...map, commitsSince: 0 }) });
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines).toContain('[ok]   floorplan map current (built 2026-11-28, 165 files, 11 parts)');
  });

  it('is ok, not a warning, for a map behind HEAD (exit 0)', () => {
    const d = makeDeps({ readFloorplanStatus: () => ({ ...map, commitsSince: 4 }) });
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines).toContain('[ok]   floorplan map built 2026-11-28, 4 commits behind HEAD (165 files, 11 parts)');
  });

  it('is ok when the distance to HEAD is unknown', () => {
    const d = makeDeps({ readFloorplanStatus: () => ({ ...map, commitsSince: null }) });
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines).toContain('[ok]   floorplan map built 2026-11-28 (165 files, 11 parts)');
  });

  it('reports a leftover architecture.yml as a skip line and keeps the exit code', () => {
    const d = makeDeps({ legacyArchitectureExists: () => true });
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines).toContain(
      '[skip] backlog/docs/architecture.yml is no longer used (Floorplan replaces it; safe to delete)',
    );
    expect(d.lines.slice(-1)[0]).toMatch(/^doctor summary: \d+ ok, 0 warn, 2 skip, 0 fail$/);
  });

  it('does not delete the leftover file (default seams, real directory)', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-doctor-legacy-'));
    try {
      mkdirSync(join(cwd, 'backlog', 'docs'), { recursive: true });
      const file = join(cwd, 'backlog', 'docs', 'architecture.yml');
      writeFileSync(file, 'schema: 1\n');
      const d = makeDeps({ readFloorplanStatus: undefined, legacyArchitectureExists: undefined });
      runDoctor(cwd, d);
      expect(existsSync(file)).toBe(true);
      expect(d.lines.some((l) => l.startsWith('[skip] backlog/docs/architecture.yml is no longer used'))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
