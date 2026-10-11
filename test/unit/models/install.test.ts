// test/unit/models/install.test.ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { saveDiscovery, setRouterEnabled, setRouterTier } from '../../../src/models/install.js';

const dirs: string[] = [];

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-inst-'));
  dirs.push(dir);
  return dir;
}

function readJson(cwd: string): unknown {
  return JSON.parse(readFileSync(join(cwd, '.super-backlog', 'models.json'), 'utf8'));
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('config mutators', () => {
  it('setRouterEnabled creates the file and flips enabled', () => {
    const cwd = freshDir();
    expect(setRouterEnabled(cwd, true)).toEqual({ version: 2, enabled: true, tiers: {} });
    expect(readJson(cwd)).toEqual({ version: 2, enabled: true, tiers: {} });
    setRouterEnabled(cwd, false);
    expect(readJson(cwd)).toEqual({ version: 2, enabled: false, tiers: {} });
  });

  it('setRouterEnabled persists a migrated v1 file', () => {
    const cwd = freshDir();
    mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
    writeFileSync(
      join(cwd, '.super-backlog', 'models.json'),
      JSON.stringify({ version: 1, enabled: true, mode: 'family', resolved: { workhorse: 'r/w' } }),
    );
    setRouterEnabled(cwd, false);
    expect(readJson(cwd)).toEqual({ version: 2, enabled: false, tiers: { opencode: { standard: 'r/w' } } });
  });

  it('setRouterTier sets and removes one entry without touching enabled', () => {
    const cwd = freshDir();
    setRouterTier(cwd, 'claude', 'top', 'mythos');
    setRouterTier(cwd, 'opencode', 'light', 'o/light');
    expect(readJson(cwd)).toEqual({
      version: 2,
      enabled: false,
      tiers: { claude: { top: 'mythos' }, opencode: { light: 'o/light' } },
    });
    expect(setRouterTier(cwd, 'claude', 'top', null)).toEqual({
      version: 2,
      enabled: false,
      tiers: { opencode: { light: 'o/light' } },
    });
  });

  it('saveDiscovery replaces the OpenCode tiers and keeps Claude tiers and enabled', () => {
    const cwd = freshDir();
    setRouterEnabled(cwd, true);
    setRouterTier(cwd, 'claude', 'light', 'haiku');
    setRouterTier(cwd, 'opencode', 'top', 'o/old-top');
    saveDiscovery(cwd, '2026-10-11T08:00:00.000Z', { light: 'o/l', standard: 'o/s' });
    expect(readJson(cwd)).toEqual({
      version: 2,
      enabled: true,
      tiers: { claude: { light: 'haiku' }, opencode: { light: 'o/l', standard: 'o/s' } },
      discoveredAt: '2026-10-11T08:00:00.000Z',
    });
  });
});
