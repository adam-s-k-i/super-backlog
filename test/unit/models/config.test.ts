import { describe, it, expect } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, getFamilyTable } from '../../../src/models/config.js';
import { DEFAULT_FAMILIES } from '../../../src/models/defaults.js';
import type { RouterConfig } from '../../../src/models/types.js';

describe('loadConfig', () => {
  it('returns default config when file is missing', () => {
    const cwd = join(tmpdir(), `sbl-test-${Date.now()}`);
    mkdirSync(cwd, { recursive: true });
    const cfg = loadConfig(cwd);
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe('family');
    rmSync(cwd, { recursive: true, force: true });
  });

  it('loads and normalizes a valid config file', () => {
    const cwd = join(tmpdir(), `sbl-test-${Date.now()}`);
    mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
    writeFileSync(join(cwd, '.super-backlog/models.json'), JSON.stringify({ enabled: true, mode: 'individual' }));
    const cfg = loadConfig(cwd);
    expect(cfg.enabled).toBe(true);
    expect(cfg.mode).toBe('individual');
    rmSync(cwd, { recursive: true, force: true });
  });

  it('falls back to defaults on invalid JSON', () => {
    const cwd = join(tmpdir(), `sbl-test-${Date.now()}`);
    mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
    writeFileSync(join(cwd, '.super-backlog/models.json'), '{ not json');
    const cfg = loadConfig(cwd);
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe('family');
    rmSync(cwd, { recursive: true, force: true });
  });

  it('falls back to defaults when file is not an object', () => {
    const cwd = join(tmpdir(), `sbl-test-${Date.now()}`);
    mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
    writeFileSync(join(cwd, '.super-backlog/models.json'), JSON.stringify(['array']));
    const cfg = loadConfig(cwd);
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe('family');
    rmSync(cwd, { recursive: true, force: true });
  });
});

describe('getFamilyTable', () => {
  it('starts with default families', () => {
    const config: RouterConfig = {
      version: 1,
      enabled: false,
      mode: 'family',
      tiers: {},
      individual: {},
      families: {},
      resolved: {},
    };
    expect(getFamilyTable(config)).toEqual(DEFAULT_FAMILIES);
  });

  it('merges family overrides from config', () => {
    const config: RouterConfig = {
      version: 1,
      enabled: false,
      mode: 'family',
      tiers: {},
      individual: {},
      families: { kimi: { budget: 'opencode/kimi-k2.0' } },
      resolved: {},
    };
    const table = getFamilyTable(config);
    expect(table.kimi.budget).toBe('opencode/kimi-k2.0');
    expect(table.kimi.workhorse).toBe(DEFAULT_FAMILIES.kimi.workhorse);
  });

  it('adds custom families from config', () => {
    const config: RouterConfig = {
      version: 1,
      enabled: false,
      mode: 'family',
      tiers: {},
      individual: {},
      families: { custom: { workhorse: 'wh/custom-v1', budget: 'wh/custom-v2' } },
      resolved: {},
    };
    const table = getFamilyTable(config);
    expect(table.custom).toEqual({ workhorse: 'wh/custom-v1', budget: 'wh/custom-v2' });
  });
});
