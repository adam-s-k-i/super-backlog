// test/unit/version-check.test.ts
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyVersionHint, refreshVersionCache } from '../../src/lib/version-check.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function emptyHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'sbl-vc-'));
  dirs.push(home);
  return home;
}

function homeWithCache(latest: string, checkedAt: string): string {
  const home = emptyHome();
  mkdirSync(join(home, '.super-backlog'));
  writeFileSync(join(home, '.super-backlog', 'version-check.json'), JSON.stringify({ latest, checkedAt }));
  return home;
}

function cacheFile(home: string): string {
  return join(home, '.super-backlog', 'version-check.json');
}

describe('applyVersionHint', () => {
  it('prints when cache latest is newer and does not refresh', async () => {
    const logs: string[] = [];
    const refresh = vi.fn();
    await applyVersionHint('1.0.3', {
      home: homeWithCache('1.0.4', new Date().toISOString()),
      now: () => new Date(),
      refresh,
      log: (l) => logs.push(l),
      env: {},
    });
    expect(logs[0]).toContain('1.0.4');
    expect(logs[0]).toContain('npm i -g super-backlog');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('skips when SBL_SKIP_UPDATE_CHECK is set', async () => {
    const logs: string[] = [];
    const refresh = vi.fn();
    await applyVersionHint('1.0.3', {
      home: homeWithCache('1.0.4', new Date().toISOString()),
      now: () => new Date(),
      refresh,
      log: (l) => logs.push(l),
      env: { SBL_SKIP_UPDATE_CHECK: '1' },
    });
    expect(logs).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('starts a refresh without logging when there is no cache', async () => {
    const logs: string[] = [];
    const refresh = vi.fn();
    await applyVersionHint('1.0.3', {
      home: emptyHome(),
      now: () => new Date(),
      refresh,
      log: (l) => logs.push(l),
      env: {},
    });
    expect(logs).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('prints the stale hint and starts a refresh when the cache is older than a day', async () => {
    const logs: string[] = [];
    const refresh = vi.fn();
    await applyVersionHint('1.0.3', {
      home: homeWithCache('1.0.4', new Date(Date.now() - 2 * DAY_MS).toISOString()),
      now: () => new Date(),
      refresh,
      log: (l) => logs.push(l),
      env: {},
    });
    expect(logs[0]).toContain('1.0.4');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('treats a checkedAt in the future (clock skew) as stale and refreshes', async () => {
    const future = new Date(Date.now() + DAY_MS).toISOString();
    const refresh = vi.fn();
    await applyVersionHint('1.0.3', {
      home: homeWithCache('1.0.3', future),
      now: () => new Date(),
      refresh,
      log: () => {},
      env: {},
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('swallows a refresh that throws', async () => {
    await expect(
      applyVersionHint('1.0.3', {
        home: emptyHome(),
        now: () => new Date(),
        refresh: () => {
          throw new Error('spawn failed');
        },
        log: () => {},
        env: {},
      }),
    ).resolves.toBeUndefined();
  });
});

describe('refreshVersionCache', () => {
  it('writes the fetched version with the current time', async () => {
    const home = emptyHome();
    const now = new Date('2026-10-09T12:00:00.000Z');
    await refreshVersionCache(home, async () => '7.7.7', () => now);
    expect(JSON.parse(readFileSync(cacheFile(home), 'utf8'))).toEqual({
      checkedAt: '2026-10-09T12:00:00.000Z',
      latest: '7.7.7',
    });
  });

  it('leaves an existing cache untouched when the fetch fails', async () => {
    const home = homeWithCache('1.3.2', '2026-08-30T12:19:45.119Z');
    await refreshVersionCache(home, async () => null, () => new Date());
    expect(JSON.parse(readFileSync(cacheFile(home), 'utf8'))).toEqual({
      checkedAt: '2026-08-30T12:19:45.119Z',
      latest: '1.3.2',
    });
  });

  it('does not create a cache for an empty answer or a rejected fetch', async () => {
    const home = emptyHome();
    await refreshVersionCache(home, async () => '', () => new Date());
    await refreshVersionCache(home, () => Promise.reject(new Error('boom')), () => new Date());
    expect(existsSync(cacheFile(home))).toBe(false);
  });
});
