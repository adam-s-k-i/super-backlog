import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import process from 'node:process';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, chmodSync: vi.fn(actual.chmodSync) };
});

import { chmodSync } from 'node:fs';
import { clearHubState, hubStatePath, isPidAlive, readHubState, writeHubState } from '../../src/lib/hub-state.js';

const dirs: string[] = [];
afterEach(() => {
  vi.mocked(chmodSync).mockClear();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

// Fakes process.platform so the chmod behavior is verified regardless of
// which OS runs the suite.
function withPlatform<T>(platform: NodeJS.Platform, fn: () => T): T {
  const original = process.platform;
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, 'platform', { value: original, configurable: true });
  }
}

describe('hub-state', () => {
  it('round-trips hub.json under the injected home', () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-hub-home-'));
    dirs.push(home);
    writeHubState(home, { pid: 42, port: 6428, token: 'abc' });
    expect(readHubState(home)).toEqual({ pid: 42, port: 6428, token: 'abc' });
    expect(hubStatePath(home)).toContain('.super-backlog');
  });

  it('clearHubState ignores a file owned by another pid', () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-hub-home-'));
    dirs.push(home);
    writeHubState(home, { pid: 1, port: 6428, token: 'x' });
    clearHubState(home, 99);
    expect(readHubState(home)?.pid).toBe(1);
  });

  it('isPidAlive is true for this process', () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  it.skipIf(process.platform === 'win32')(
    'writes hub.json as user-only readable (0o600) on non-win32',
    () => {
      const home = mkdtempSync(join(tmpdir(), 'sbl-hub-home-'));
      dirs.push(home);
      writeHubState(home, { pid: 42, port: 6428, token: 'abc' });
      const mode = statSync(hubStatePath(home)).mode & 0o777;
      expect(mode).toBe(0o600);
    },
  );

  it('calls chmodSync(path, 0o600) on non-win32 platforms', () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-hub-home-'));
    dirs.push(home);
    withPlatform('linux', () => {
      writeHubState(home, { pid: 42, port: 6428, token: 'abc' });
    });
    expect(chmodSync).toHaveBeenCalledWith(hubStatePath(home), 0o600);
  });

  it('does not call chmodSync on win32', () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-hub-home-'));
    dirs.push(home);
    withPlatform('win32', () => {
      writeHubState(home, { pid: 42, port: 6428, token: 'abc' });
    });
    expect(chmodSync).not.toHaveBeenCalled();
  });
});
