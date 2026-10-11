// test/e2e/router-lifecycle.test.ts
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInit, type ParsedArgs } from '../../src/commands/init.js';
import { runUninstall } from '../../src/commands/uninstall.js';

const TIERS = ['light', 'standard', 'strong', 'top'];

function args(values: Record<string, unknown> = {}): ParsedArgs {
  return { values: values as Record<string, string | boolean | undefined>, positionals: [] };
}

describe('model router e2e lifecycle', () => {
  it('installs and uninstalls cleanly', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-router-e2e-'));
    try {
      const code = await runInit(cwd, args({ pm: 'skip', harness: 'opencode', models: true }), { doctor: () => 0 });
      expect(code).toBe(0);
      expect(JSON.parse(readFileSync(join(cwd, '.super-backlog/models.json'), 'utf8')).enabled).toBe(true);
      for (const t of TIERS) {
        expect(existsSync(join(cwd, `.claude/agents/sbl-${t}.md`))).toBe(true);
        expect(existsSync(join(cwd, `.opencode/agents/sbl-${t}.md`))).toBe(true);
      }
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(false);
      const agentsMd = readFileSync(join(cwd, 'AGENTS.md'), 'utf8').replace(/\r\n/g, '\n');
      expect(agentsMd).toContain('Examples (from `.super-backlog/models.json`; change them with');
      expect(agentsMd).toContain('top `fable`');

      const uninstall = await runUninstall(cwd, args({}), { confirm: () => false, removeGlobal: () => 0 });
      expect(uninstall).toBe(0);
      for (const t of TIERS) {
        expect(existsSync(join(cwd, `.claude/agents/sbl-${t}.md`))).toBe(false);
        expect(existsSync(join(cwd, `.opencode/agents/sbl-${t}.md`))).toBe(false);
      }
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
