import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import process from 'node:process';
import { clearHubState, hubStatePath, isPidAlive, readHubState, writeHubState } from '../../src/lib/hub-state.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

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
});
