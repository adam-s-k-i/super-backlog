// test/e2e/router-lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit, type ParsedArgs } from '../../src/commands/init.js';
import { runUninstall } from '../../src/commands/uninstall.js';

function args(values: Record<string, unknown> = {}): ParsedArgs {
  return { values: values as Record<string, string | boolean | undefined>, positionals: [] };
}

describe('model router e2e lifecycle', () => {
  it('installs and uninstalls cleanly', async () => {
    const cwd = join(tmpdir(), `sbl-router-e2e-${Date.now()}`);
    mkdirSync(cwd, { recursive: true });
    try {
      // Use harness:'opencode' and 'no-refresh-hook':true to avoid .git/refresher warnings that would make runInit exit 4.
      // doctor is stubbed: this test is about router files, not environment verification.
      const code = await runInit(
        cwd,
        args({ pm: 'skip', 'no-dashboard': true, 'no-refresh-hook': true, harness: 'opencode', models: true }),
        { doctor: () => 0 },
      );
      expect(code).toBe(0);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(true);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(true);
      expect(existsSync(join(cwd, '.opencode/agents/sbl-worker.md'))).toBe(true);
      expect(existsSync(join(cwd, '.claude/agents/sbl-worker.md'))).toBe(true);

      const uninstall = await runUninstall(cwd, args({}));
      expect(uninstall).toBe(0);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(false);
      expect(existsSync(join(cwd, '.opencode/agents/sbl-worker.md'))).toBe(false);
      expect(existsSync(join(cwd, '.claude/agents/sbl-worker.md'))).toBe(false);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
