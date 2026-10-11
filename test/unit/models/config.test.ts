// test/unit/models/config.test.ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  claudeModel,
  effectiveTiers,
  InvalidConfigError,
  isHarness,
  isTier,
  isValidModelId,
  loadConfig,
  normalizeConfig,
  readConfigStrict,
  serializeConfig,
  UnsupportedConfigVersionError,
  writeConfig,
} from '../../../src/models/config.js';
import { CLAUDE_DEFAULTS, defaultConfig } from '../../../src/models/defaults.js';

const dirs: string[] = [];

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-cfg-'));
  dirs.push(dir);
  return dir;
}

function writeRaw(cwd: string, text: string): void {
  mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
  writeFileSync(join(cwd, '.super-backlog', 'models.json'), text);
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('isValidModelId', () => {
  it('accepts aliases and provider/model ids', () => {
    for (const id of ['haiku', 'opencode/claude-sonnet-4-6', 'openrouter/meta-llama/llama-4:free', 'vertex@eu+x', 'a.b_c', 'a'.repeat(100)]) {
      expect(isValidModelId(id), id).toBe(true);
    }
  });

  it('rejects anything that could break YAML or Markdown', () => {
    for (const id of ['', ' haiku', 'has space', 'back`tick', 'quo"te', "it's", 'new\nline', '-dash-first', '/slash-first', 'ends-with:', 'a'.repeat(101), 42, null, undefined]) {
      expect(isValidModelId(id), String(id)).toBe(false);
    }
  });
});

describe('isTier / isHarness', () => {
  it('knows the four tiers and two harnesses', () => {
    for (const t of ['light', 'standard', 'strong', 'top']) expect(isTier(t)).toBe(true);
    for (const t of ['workhorse', 'budget', 'Light', '']) expect(isTier(t)).toBe(false);
    expect(isHarness('claude')).toBe(true);
    expect(isHarness('opencode')).toBe(true);
    expect(isHarness('gemini')).toBe(false);
  });
});

describe('normalizeConfig', () => {
  it('returns the default for non-objects', () => {
    for (const raw of [null, 'x', 3, ['array']]) {
      expect(normalizeConfig(raw)).toEqual({ version: 2, enabled: false, tiers: {} });
    }
  });

  it('keeps valid v2 entries in harness and tier order and drops the rest', () => {
    const cfg = normalizeConfig({
      version: 2,
      enabled: true,
      tiers: {
        opencode: { top: 'o/top', light: 'o/light', bogus: 'x/y' },
        claude: { strong: 'bad id', standard: 'sonnet' },
        gemini: { light: 'g/x' },
      },
      discoveredAt: '2026-10-11T08:00:00.000Z',
      mode: 'family',
    });
    expect(cfg).toEqual({
      version: 2,
      enabled: true,
      tiers: { claude: { standard: 'sonnet' }, opencode: { light: 'o/light', top: 'o/top' } },
      discoveredAt: '2026-10-11T08:00:00.000Z',
    });
    expect(Object.keys(cfg.tiers)).toEqual(['claude', 'opencode']);
    expect(Object.keys(cfg.tiers.opencode ?? {})).toEqual(['light', 'top']);
  });

  it('drops harnesses without a valid tier and treats non-boolean enabled as false', () => {
    expect(normalizeConfig({ version: 2, enabled: 'yes', tiers: { claude: { light: '' } } })).toEqual({
      version: 2,
      enabled: false,
      tiers: {},
    });
  });
});

describe('v1 migration', () => {
  it('maps workhorse/budget to OpenCode standard/light, preferring individual, then tiers, then resolved', () => {
    const cfg = normalizeConfig({
      version: 1,
      enabled: true,
      mode: 'individual',
      tiers: { workhorse: 't/w', budget: 't/b' },
      individual: { workhorse: 'i/w' },
      families: { kimi: { budget: 'k/b' } },
      resolved: { discoveredAt: '2026-09-01T00:00:00.000Z', workhorse: 'r/w', budget: 'r/b' },
    });
    expect(cfg).toEqual({
      version: 2,
      enabled: true,
      tiers: { opencode: { light: 't/b', standard: 'i/w' } },
      discoveredAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('skips empty and invalid values when picking the first entry', () => {
    const cfg = normalizeConfig({
      version: 1,
      enabled: false,
      individual: { workhorse: '', budget: 'bad id' },
      tiers: {},
      resolved: { budget: 'r/b' },
    });
    expect(cfg).toEqual({ version: 2, enabled: false, tiers: { opencode: { light: 'r/b' } } });
  });

  it('treats a file without version as v1 and never migrates Claude tiers', () => {
    expect(normalizeConfig({ enabled: true, mode: 'family', tiers: { claude: { light: 'haiku' } } })).toEqual({
      version: 2,
      enabled: true,
      tiers: {},
    });
  });
});

describe('loadConfig', () => {
  it('returns the default when the file is missing', () => {
    expect(loadConfig(freshDir())).toEqual(defaultConfig());
  });

  it('returns the default for unparsable JSON', () => {
    const cwd = freshDir();
    writeRaw(cwd, '{ not json');
    expect(loadConfig(cwd)).toEqual({ version: 2, enabled: false, tiers: {} });
  });

  it('returns the default for non-object JSON', () => {
    const cwd = freshDir();
    writeRaw(cwd, JSON.stringify(['array']));
    expect(loadConfig(cwd)).toEqual({ version: 2, enabled: false, tiers: {} });
  });

  it('migrates a v1 file in memory', () => {
    const cwd = freshDir();
    writeRaw(cwd, JSON.stringify({ version: 1, enabled: true, individual: { budget: 'x/cheap' } }));
    expect(loadConfig(cwd)).toEqual({ version: 2, enabled: true, tiers: { opencode: { light: 'x/cheap' } } });
  });
});

describe('UTF-8 BOM', () => {
  const v2 = JSON.stringify({ version: 2, enabled: true, tiers: { claude: { top: 'opus' } } });

  it('loadConfig reads a file with a leading BOM', () => {
    const cwd = freshDir();
    writeRaw(cwd, `\uFEFF${v2}`);
    expect(loadConfig(cwd)).toEqual({ version: 2, enabled: true, tiers: { claude: { top: 'opus' } } });
  });

  it('readConfigStrict reads a file with a leading BOM', () => {
    const cwd = freshDir();
    writeRaw(cwd, `\uFEFF${v2}`);
    expect(readConfigStrict(cwd)).toEqual({ version: 2, enabled: true, tiers: { claude: { top: 'opus' } } });
  });
});

describe('unsupported version', () => {
  const MESSAGE =
    '.super-backlog/models.json has version 3, which this super-backlog does not support - left unchanged; upgrade super-backlog or delete it';

  it('loadConfig falls back to the default instead of migrating a newer file', () => {
    const cwd = freshDir();
    writeRaw(cwd, JSON.stringify({ version: 3, enabled: true, individual: { budget: 'x/cheap' } }));
    expect(loadConfig(cwd)).toEqual(defaultConfig());
  });

  it('readConfigStrict throws an InvalidConfigError subclass naming the version', () => {
    const cwd = freshDir();
    writeRaw(cwd, JSON.stringify({ version: 3, enabled: true }));
    let caught: unknown;
    try {
      readConfigStrict(cwd);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnsupportedConfigVersionError);
    expect(caught).toBeInstanceOf(InvalidConfigError);
    expect((caught as Error).message).toBe(MESSAGE);
  });

  it('keeps treating version 1, a missing version and a non-numeric version as v1', () => {
    for (const version of [1, undefined, '3', 0]) {
      const cwd = freshDir();
      writeRaw(cwd, JSON.stringify({ version, enabled: true, individual: { budget: 'x/cheap' } }));
      expect(readConfigStrict(cwd), String(version)).toEqual({ version: 2, enabled: true, tiers: { opencode: { light: 'x/cheap' } } });
    }
  });
});

describe('serializeConfig / writeConfig', () => {
  it('writes normalized version 2 JSON with a trailing newline', () => {
    const cwd = freshDir();
    writeConfig(cwd, { version: 2, enabled: true, tiers: { opencode: { light: 'o/l' } } });
    const text = readFileSync(join(cwd, '.super-backlog', 'models.json'), 'utf8');
    expect(text).toBe('{\n  "version": 2,\n  "enabled": true,\n  "tiers": {\n    "opencode": {\n      "light": "o/l"\n    }\n  }\n}\n');
    expect(serializeConfig(loadConfig(cwd))).toBe(text);
  });
});

describe('claudeModel / effectiveTiers', () => {
  it('falls back to the built-in Claude defaults', () => {
    const cfg = normalizeConfig({ version: 2, enabled: true, tiers: { claude: { top: 'mythos' }, opencode: { light: 'o/l' } } });
    expect(claudeModel(cfg, 'light')).toBe('haiku');
    expect(claudeModel(cfg, 'top')).toBe('mythos');
    expect(effectiveTiers(cfg)).toEqual({
      claude: { light: 'haiku', standard: 'sonnet', strong: 'opus', top: 'mythos' },
      opencode: { light: 'o/l' },
    });
  });

  it('exposes the spec defaults', () => {
    expect(CLAUDE_DEFAULTS).toEqual({ light: 'haiku', standard: 'sonnet', strong: 'opus', top: 'fable' });
    expect(defaultConfig()).toEqual({ version: 2, enabled: false, tiers: {} });
  });
});
