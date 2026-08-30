// test/unit/update.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { refreshActions, runUpdate, type SelfUpdateOverride } from '../../src/commands/update.js';
import type { Action } from '../../src/init/planner.js';
import { KIT_VERSION } from '../../src/lib/version.js';

const FULL_PLAN: Action[] = [
  { kind: 'upstream-install', pm: 'npm' },
  { kind: 'merge-json', path: 'opencode.json', transform: 'plugin-entry' },
  { kind: 'merge-json', path: 'package.json', transform: 'scripts-and-devdeps' },
  { kind: 'inject-agents-block' },
  { kind: 'write-claude-pointer' },
  { kind: 'copy-skills' },
  { kind: 'install-guard-hook' },
  { kind: 'write', path: 'backlog/config.yml', contents: 'project_name: demo\n' },
];

describe('refreshActions', () => {
  it('keeps exactly the four refresh kinds in plan order', () => {
    expect(refreshActions(FULL_PLAN).map((a) => a.kind)).toEqual([
      'inject-agents-block',
      'write-claude-pointer',
      'copy-skills',
      'install-guard-hook',
    ]);
  });

  it('drops upstream installs, json merges and raw writes', () => {
    const kinds = new Set(refreshActions(FULL_PLAN).map((a) => a.kind));
    expect(kinds.has('upstream-install')).toBe(false);
    expect(kinds.has('merge-json')).toBe(false);
    expect(kinds.has('write')).toBe(false);
  });

  it('returns an empty plan for merge-only input', () => {
    expect(
      refreshActions([{ kind: 'merge-json', path: 'package.json', transform: 'scripts-and-devdeps' }]),
    ).toEqual([]);
  });

  it('handles an empty plan', () => {
    expect(refreshActions([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const snapshot = [...FULL_PLAN];
    refreshActions(FULL_PLAN);
    expect(FULL_PLAN).toEqual(snapshot);
  });
});

describe('runUpdate self-update wiring', () => {
  const dirs: string[] = [];
  function scratchDir(): string {
    const d = mkdtempSync(join(tmpdir(), 'sbl-update-wiring-'));
    dirs.push(d);
    return d;
  }

  afterEach(() => {
    delete process.env.SBL_FORCE_OFFLINE;
    delete process.env.SBL_SELF_UPDATED;
    delete process.env.SBL_SKIP_UPDATE_CHECK;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function unreachableOverride(): SelfUpdateOverride {
    return {
      fetchLatest: vi.fn(async () => {
        throw new Error('fetchLatest should not be called when self-update is skipped');
      }),
      npmInstallGlobal: vi.fn(() => {
        throw new Error('npmInstallGlobal should not be called when self-update is skipped');
      }),
      spawnSelf: vi.fn(() => {
        throw new Error('spawnSelf should not be called when self-update is skipped');
      }),
    };
  }

  it('--no-self skips the self-update path entirely', async () => {
    process.env.SBL_FORCE_OFFLINE = '1'; // keep the published-version check deterministic too
    const override = unreachableOverride();
    const code = await runUpdate(scratchDir(), { values: { 'no-self': true }, positionals: [] }, override);
    expect(typeof code).toBe('number');
    expect(override.fetchLatest).not.toHaveBeenCalled();
  });

  it('SBL_SELF_UPDATED=1 skips the self-update path entirely', async () => {
    process.env.SBL_SELF_UPDATED = '1';
    process.env.SBL_FORCE_OFFLINE = '1'; // keep the published-version check deterministic too
    const override = unreachableOverride();
    const code = await runUpdate(scratchDir(), { values: {}, positionals: [] }, override);
    expect(typeof code).toBe('number');
    expect(override.fetchLatest).not.toHaveBeenCalled();
  });

  it('SBL_SKIP_UPDATE_CHECK skips the self-update path entirely', async () => {
    process.env.SBL_SKIP_UPDATE_CHECK = '1';
    process.env.SBL_FORCE_OFFLINE = '1'; // keep the published-version check deterministic too
    const override = unreachableOverride();
    const code = await runUpdate(scratchDir(), { values: {}, positionals: [] }, override);
    expect(typeof code).toBe('number');
    expect(override.fetchLatest).not.toHaveBeenCalled();
  });

  it('SBL_FORCE_OFFLINE skips the self-update path entirely', async () => {
    process.env.SBL_FORCE_OFFLINE = '1';
    const override = unreachableOverride();
    const code = await runUpdate(scratchDir(), { values: {}, positionals: [] }, override);
    expect(typeof code).toBe('number');
    expect(override.fetchLatest).not.toHaveBeenCalled();
  });

  it('offline fetch (unavailable) falls through to the normal refresh, no re-exec', async () => {
    const spawnSelf = vi.fn();
    const code = await runUpdate(scratchDir(), { values: {}, positionals: [] }, {
      fetchLatest: async () => null,
      // Fixed so this never shells out to a real `npm root -g` in a unit test.
      binRealPath: '/somewhere/not-under/cwd-or-global/bin.js',
      globalRoot: null,
      spawnSelf,
    });
    expect(typeof code).toBe('number');
    expect(spawnSelf).not.toHaveBeenCalled();
  });

  it('newer + local/unknown install kind hints and falls through, never re-execs', async () => {
    const spawnSelf = vi.fn();
    const npmInstallGlobal = vi.fn(() => ({ status: 0 }));
    const code = await runUpdate(scratchDir(), { values: {}, positionals: [] }, {
      fetchLatest: async () => '999.0.0',
      binRealPath: '/somewhere/not-under/cwd-or-global/bin.js',
      globalRoot: null,
      npmInstallGlobal,
      spawnSelf,
    });
    expect(typeof code).toBe('number');
    expect(npmInstallGlobal).not.toHaveBeenCalled();
    expect(spawnSelf).not.toHaveBeenCalled();
  });

  it('not newer (current) falls through to the normal refresh, never re-execs', async () => {
    const spawnSelf = vi.fn();
    const code = await runUpdate(scratchDir(), { values: {}, positionals: [] }, {
      fetchLatest: async () => KIT_VERSION,
      // Fixed so this never shells out to a real `npm root -g` in a unit test.
      binRealPath: '/somewhere/not-under/cwd-or-global/bin.js',
      globalRoot: null,
      spawnSelf,
    });
    expect(typeof code).toBe('number');
    expect(spawnSelf).not.toHaveBeenCalled();
  });

  it('global install + newer version: installs, re-execs the new binary exactly once, forwards its exit code', async () => {
    const spawnSelf = vi.fn(() => ({ status: 7 }));
    const npmInstallGlobal = vi.fn(() => ({ status: 0 }));
    const cwd = scratchDir();
    const globalRoot = join(cwd, 'fake-global', 'node_modules');
    const binRealPath = join(globalRoot, 'super-backlog', 'dist', 'bin.js');

    const code = await runUpdate(cwd, { values: {}, positionals: ['extra-positional'] }, {
      fetchLatest: async () => '999.0.0',
      binRealPath,
      globalRoot,
      npmInstallGlobal,
      spawnSelf,
    });

    expect(npmInstallGlobal).toHaveBeenCalledTimes(1);
    expect(npmInstallGlobal).toHaveBeenCalledWith('super-backlog@999.0.0');
    expect(spawnSelf).toHaveBeenCalledTimes(1);
    expect(spawnSelf).toHaveBeenCalledWith(
      binRealPath,
      ['extra-positional'],
      cwd,
      expect.objectContaining({ SBL_SELF_UPDATED: '1' }),
    );
    expect(code).toBe(7); // forwarded from spawnSelf, not the normal refresh path
  });

  it('failed global npm install falls through to the normal refresh, never re-execs', async () => {
    const spawnSelf = vi.fn();
    const npmInstallGlobal = vi.fn(() => ({ status: 1 }));
    const cwd = scratchDir();
    const globalRoot = join(cwd, 'fake-global', 'node_modules');
    const binRealPath = join(globalRoot, 'super-backlog', 'dist', 'bin.js');

    const code = await runUpdate(cwd, { values: {}, positionals: [] }, {
      fetchLatest: async () => '999.0.0',
      binRealPath,
      globalRoot,
      npmInstallGlobal,
      spawnSelf,
    });

    expect(npmInstallGlobal).toHaveBeenCalledTimes(1);
    expect(spawnSelf).not.toHaveBeenCalled();
    expect(typeof code).toBe('number');
  });
});
