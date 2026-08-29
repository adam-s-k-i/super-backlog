// test/unit/command-smoke.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInit } from '../../src/commands/init.js';
import { runDoctor } from '../../src/commands/doctor.js';
import { runModels } from '../../src/commands/models.js';
import { runUpdate } from '../../src/commands/update.js';

const dirs: string[] = [];
beforeEach(() => {
  process.env.SBL_SKIP_UPDATE_CHECK = '1';
});
afterEach(() => {
  delete process.env.SBL_SKIP_UPDATE_CHECK;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('command smoke', () => {
  it('init --dry-run exits 0 or 4', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-smoke-'));
    dirs.push(cwd);
    const code = await runInit(cwd, { values: { 'dry-run': true, pm: 'skip' }, positionals: [] });
    expect([0, 4]).toContain(code);
  });

  it('doctor exits 0 or 4', () => {
    const code = runDoctor(process.cwd());
    expect([0, 4]).toContain(code);
  });

  it('models show does not throw', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-smoke-'));
    dirs.push(cwd);
    const code = await runModels(cwd, { values: {}, positionals: ['show'] });
    expect(typeof code).toBe('number');
  });

  it('update on an empty dir does not throw', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-smoke-'));
    dirs.push(cwd);
    const code = await runUpdate(cwd, { values: {}, positionals: [] });
    expect(typeof code).toBe('number');
  });
});
