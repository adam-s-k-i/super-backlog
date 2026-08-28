// test/integration/models-cli.test.ts
import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit, type ParsedArgs } from '../../src/commands/init.js';
import { runModels } from '../../src/commands/models.js';

function emptyArgs(values: Record<string, unknown> = {}): ParsedArgs {
  return { values: values as Record<string, string | boolean | undefined>, positionals: [] };
}

describe('sbl models CLI', () => {
  it('enables router via init --models and writes config', async () => {
    const cwd = join(tmpdir(), `sbl-models-${Date.now()}`);
    try {
      const args = emptyArgs({ pm: 'skip', models: true });
      await runInit(cwd, args);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(true);
      const raw = JSON.parse(readFileSync(join(cwd, '.super-backlog/models.json'), 'utf8'));
      expect(raw.enabled).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('enable/disable subcommands toggle the config', async () => {
    const cwd = join(tmpdir(), `sbl-models-toggle-${Date.now()}`);
    try {
      const args = emptyArgs({ pm: 'skip', models: true });
      await runInit(cwd, args);
      expect(JSON.parse(readFileSync(join(cwd, '.super-backlog/models.json'), 'utf8')).enabled).toBe(true);

      await runModels(cwd, { values: {}, positionals: ['disable'] });
      expect(JSON.parse(readFileSync(join(cwd, '.super-backlog/models.json'), 'utf8')).enabled).toBe(false);

      await runModels(cwd, { values: {}, positionals: ['enable'] });
      expect(JSON.parse(readFileSync(join(cwd, '.super-backlog/models.json'), 'utf8')).enabled).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('show prints current config', async () => {
    const cwd = join(tmpdir(), `sbl-models-show-${Date.now()}`);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runModels(cwd, { values: {}, positionals: ['show'] });
      const output = spy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(output).toContain('"enabled": false');
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
