// test/unit/version-check.test.ts
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyVersionHint } from '../../src/lib/version-check.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function homeWithCache(latest: string, checkedAt: string): string {
  const home = mkdtempSync(join(tmpdir(), 'sbl-vc-'));
  dirs.push(home);
  mkdirSync(join(home, '.super-backlog'));
  writeFileSync(join(home, '.super-backlog', 'version-check.json'), JSON.stringify({ latest, checkedAt }));
  return home;
}

describe('applyVersionHint', () => {
  it('prints when cache latest is newer and does not fetch', async () => {
    const logs: string[] = [];
    const fetchLatest = vi.fn(async () => '9.9.9');
    await applyVersionHint('1.0.3', {
      home: homeWithCache('1.0.4', new Date().toISOString()),
      now: () => new Date(),
      fetchLatest,
      log: (l) => logs.push(l),
      env: {},
    });
    expect(logs[0]).toContain('1.0.4');
    expect(logs[0]).toContain('npm i -g super-backlog');
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it('skips when SBL_SKIP_UPDATE_CHECK is set', async () => {
    const logs: string[] = [];
    const fetchLatest = vi.fn(async () => '9.9.9');
    await applyVersionHint('1.0.3', {
      home: homeWithCache('1.0.4', new Date().toISOString()),
      now: () => new Date(),
      fetchLatest,
      log: (l) => logs.push(l),
      env: { SBL_SKIP_UPDATE_CHECK: '1' },
    });
    expect(logs).toEqual([]);
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it('does not log on a failed fetch and leaves exit path clean', async () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-vc-'));
    dirs.push(home);
    const logs: string[] = [];
    await applyVersionHint('1.0.3', {
      home,
      now: () => new Date(),
      fetchLatest: async () => null,
      log: (l) => logs.push(l),
      env: {},
    });
    expect(logs).toEqual([]);
  });
});
