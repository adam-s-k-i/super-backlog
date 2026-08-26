// test/integration/models-cli.test.ts
import { describe, it, expect } from 'vitest';
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
      const args = emptyArgs({ pm: 'skip', 'no-dashboard': true, models: true });
      await runInit(cwd, args);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(true);
      const raw = JSON.parse(readFileSync(join(cwd, '.super-backlog/models.json'), 'utf8'));
      expect(raw.enabled).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
