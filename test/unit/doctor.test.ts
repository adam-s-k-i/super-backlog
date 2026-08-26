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
