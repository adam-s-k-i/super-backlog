// test/unit/self-update.test.ts
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';

import { detectInstallKind, runSelfUpdate } from '../../src/lib/self-update.js';

describe('detectInstallKind', () => {
  it('is global when the global npm root prefixes the bin path', () => {
    const cwd = '/home/user/project';
    const globalRoot = '/usr/local/lib/node_modules';
    const bin = '/usr/local/lib/node_modules/super-backlog/dist/bin.js';
    expect(detectInstallKind(bin, cwd, globalRoot)).toBe('global');
  });

  it('is local when the bin path sits under cwd/node_modules', () => {
    const cwd = '/home/user/project';
    const globalRoot = '/usr/local/lib/node_modules';
    const bin = join(cwd, 'node_modules', 'super-backlog', 'dist', 'bin.js');
    expect(detectInstallKind(bin, cwd, globalRoot)).toBe('local');
  });

  it('is unknown when the path matches neither root', () => {
    const cwd = '/home/user/project';
    const globalRoot = '/usr/local/lib/node_modules';
    const bin = '/opt/other/super-backlog/dist/bin.js';
    expect(detectInstallKind(bin, cwd, globalRoot)).toBe('unknown');
  });

  it('is unknown when globalRoot is null and the path is not local', () => {
    const cwd = '/home/user/project';
    const bin = '/opt/other/super-backlog/dist/bin.js';
    expect(detectInstallKind(bin, cwd, null)).toBe('unknown');
  });

  it('normalizes Windows backslash separators before comparing', () => {
    const cwd = 'C:\\Users\\dev\\project';
    const globalRoot = 'C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules';
    const localBin = 'C:\\Users\\dev\\project\\node_modules\\super-backlog\\dist\\bin.js';
    const globalBin = 'C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules\\super-backlog\\dist\\bin.js';
    expect(detectInstallKind(localBin, cwd, globalRoot)).toBe('local');
    expect(detectInstallKind(globalBin, cwd, globalRoot)).toBe('global');
  });

  it('is case-insensitive (explicit flag) for a drive-letter-case-mismatched global root, as npm root -g vs realpathSync can disagree on Windows', () => {
    const cwd = 'C:\\Users\\dev\\project';
    const globalRoot = 'C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules';
    const bin = 'c:\\users\\dev\\appdata\\roaming\\npm\\node_modules\\super-backlog\\dist\\bin.js';
    expect(detectInstallKind(bin, cwd, globalRoot, true)).toBe('global');
  });

  it('is case-insensitive (explicit flag) for a case-mismatched local node_modules path', () => {
    const cwd = 'C:\\Users\\dev\\project';
    const bin = 'c:\\users\\dev\\project\\node_modules\\super-backlog\\dist\\bin.js';
    expect(detectInstallKind(bin, cwd, null, true)).toBe('local');
  });

  it('is case-sensitive when caseInsensitive is explicitly false', () => {
    const cwd = '/home/user/project';
    const globalRoot = '/usr/local/lib/node_modules';
    const bin = '/USR/LOCAL/LIB/NODE_MODULES/super-backlog/dist/bin.js';
    expect(detectInstallKind(bin, cwd, globalRoot, false)).toBe('unknown');
  });

  it('defaults caseInsensitive to (and only to) process.platform === "win32"', () => {
    const cwd = 'C:\\Users\\dev\\project';
    const globalRoot = 'C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules';
    const bin = 'c:\\users\\dev\\appdata\\roaming\\npm\\node_modules\\super-backlog\\dist\\bin.js';
    const expected = process.platform === 'win32' ? 'global' : 'unknown';
    expect(detectInstallKind(bin, cwd, globalRoot)).toBe(expected);
  });
});

function makeDeps(overrides: Partial<Parameters<typeof runSelfUpdate>[0]> = {}) {
  const logs: string[] = [];
  const warns: string[] = [];
  const npmInstallGlobal = overrides.npmInstallGlobal ?? vi.fn(() => ({ status: 0 }));
  return {
    deps: {
      installed: '1.0.0',
      fetchLatest: vi.fn(async () => '1.1.0'),
      installKind: 'global' as const,
      npmInstallGlobal,
      log: (l: string) => logs.push(l),
      warn: (l: string) => warns.push(l),
      ...overrides,
      npmInstallGlobal,
    },
    logs,
    warns,
    npmInstallGlobal,
  };
}

describe('runSelfUpdate', () => {
  it('returns unavailable and warns when the fetch fails (offline)', async () => {
    const { deps, warns, npmInstallGlobal } = makeDeps({ fetchLatest: vi.fn(async () => null) });
    const result = await runSelfUpdate(deps);
    expect(result).toEqual({ kind: 'unavailable' });
    expect(warns.some((w) => /offline/i.test(w))).toBe(true);
    expect(npmInstallGlobal).not.toHaveBeenCalled();
  });

  it('returns current when latest is not newer', async () => {
    const { deps, logs, warns, npmInstallGlobal } = makeDeps({
      fetchLatest: vi.fn(async () => '1.0.0'),
    });
    const result = await runSelfUpdate(deps);
    expect(result).toEqual({ kind: 'current' });
    expect(logs).toEqual([]);
    expect(warns).toEqual([]);
    expect(npmInstallGlobal).not.toHaveBeenCalled();
  });

  it('returns skipped-local and hints when newer but installKind is local', async () => {
    const { deps, logs, npmInstallGlobal } = makeDeps({ installKind: 'local' });
    const result = await runSelfUpdate(deps);
    expect(result).toEqual({ kind: 'skipped-local', latest: '1.1.0' });
    expect(logs.some((l) => l.includes('npm i -D super-backlog@1.1.0'))).toBe(true);
    expect(npmInstallGlobal).not.toHaveBeenCalled();
  });

  it('returns skipped-local and hints when newer but installKind is unknown', async () => {
    const { deps, logs, npmInstallGlobal } = makeDeps({ installKind: 'unknown' });
    const result = await runSelfUpdate(deps);
    expect(result).toEqual({ kind: 'skipped-local', latest: '1.1.0' });
    expect(logs.length).toBeGreaterThan(0);
    expect(npmInstallGlobal).not.toHaveBeenCalled();
  });

  it('runs npm install and returns updated when global and newer and install succeeds', async () => {
    const { deps, logs, npmInstallGlobal } = makeDeps({ installKind: 'global' });
    const result = await runSelfUpdate(deps);
    expect(result).toEqual({ kind: 'updated', latest: '1.1.0' });
    expect(npmInstallGlobal).toHaveBeenCalledTimes(1);
    expect(npmInstallGlobal).toHaveBeenCalledWith('super-backlog@1.1.0');
    expect(logs.some((l) => l.includes('1.1.0'))).toBe(true);
  });

  it('returns failed and warns when global npm install fails', async () => {
    const { deps, warns, npmInstallGlobal } = makeDeps({
      installKind: 'global',
      npmInstallGlobal: vi.fn(() => ({ status: 1 })),
    });
    const result = await runSelfUpdate(deps);
    expect(result).toEqual({ kind: 'failed', latest: '1.1.0' });
    expect(npmInstallGlobal).toHaveBeenCalledTimes(1);
    expect(warns.length).toBeGreaterThan(0);
  });

  it('never calls npmInstallGlobal except in the global+newer case', async () => {
    for (const installKind of ['local', 'unknown'] as const) {
      const { deps, npmInstallGlobal } = makeDeps({ installKind });
      await runSelfUpdate(deps);
      expect(npmInstallGlobal).not.toHaveBeenCalled();
    }
  });
});
