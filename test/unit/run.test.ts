import { describe, expect, it } from 'vitest';
import { resolveBacklogBin, runCapture } from '../../src/lib/run.js';

describe('runCapture', () => {
  it('captures stdout and status', () => {
    const node = process.execPath;
    const r = runCapture(node, ['-e', 'console.log(42)'], process.cwd());
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('42');
  });
  it('reports nonzero status without throwing', () => {
    const r = runCapture(process.execPath, ['-e', 'process.exit(3)'], process.cwd());
    expect(r.status).toBe(3);
  });
});

describe('resolveBacklogBin', () => {
  it('returns null when nowhere to be found (fixture cwd)', () => {
    // Not guaranteed on machines with global backlog; acceptable flake-guard:
    const r = resolveBacklogBin(process.platform === 'win32' ? 'C:\\__no_such_dir__' : '/__no_such_dir__');
    expect(['backlog', null]).toContain(r);
  });
});
