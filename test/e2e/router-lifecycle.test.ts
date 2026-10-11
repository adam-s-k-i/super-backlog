// test/e2e/router-lifecycle.test.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runInit, type ParsedArgs } from '../../src/commands/init.js';
import { runUninstall } from '../../src/commands/uninstall.js';
import { runUpdate } from '../../src/commands/update.js';

const TIERS = ['light', 'standard', 'strong', 'top'];

function args(values: Record<string, unknown> = {}): ParsedArgs {
  return { values: values as Record<string, string | boolean | undefined>, positionals: [] };
}

describe('model router e2e lifecycle', () => {
  it('migrates a v1 project on update and uninstalls every router file', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-router-v1-'));
    const put = (rel: string, text: string): void => {
      mkdirSync(dirname(join(cwd, rel)), { recursive: true });
      writeFileSync(join(cwd, rel), text);
    };
    const read = (rel: string): string => readFileSync(join(cwd, rel), 'utf8');
    const sblHook = { matcher: '*', hooks: [{ type: 'command', command: 'node', args: ['node_modules/super-backlog/dist/templates/cc-session-hook.js'] }] };
    const ownHook = { matcher: '*', hooks: [{ type: 'command', command: 'node', args: ['my-own-hook.js'] }] };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      put('.super-backlog/models.json', JSON.stringify({
        version: 1,
        enabled: true,
        mode: 'individual',
        tiers: {},
        individual: { workhorse: 'opencode/claude-sonnet-4-6', budget: 'opencode/claude-haiku-4-5' },
        families: {},
        resolved: { discoveredAt: '2026-09-01T00:00:00.000Z', workhorse: 'x/w', budget: 'x/b' },
      }));
      for (const dir of ['.claude/agents', '.opencode/agents']) {
        put(`${dir}/sbl-worker.md`, '---\nname: sbl-worker\nmodel: TIER_PLACEHOLDER\n---\nbody\n');
        put(`${dir}/sbl-worker-cheap.md`, '---\nname: sbl-worker-cheap\nmodel: TIER_PLACEHOLDER\n---\nbody\n');
      }
      put('.opencode/plugins/sbl-model-router.js', 'module.exports = async () => ({});\n');
      put('.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [sblHook, ownHook] } }, null, 2));

      const code = await runUpdate(cwd, { values: { 'no-self': true }, positionals: [] }, { probePublished: () => null });
      expect([0, 4]).toContain(code);

      expect(read('.super-backlog/models.json')).toBe(`${JSON.stringify({
        version: 2,
        enabled: true,
        tiers: { opencode: { light: 'opencode/claude-haiku-4-5', standard: 'opencode/claude-sonnet-4-6' } },
        discoveredAt: '2026-09-01T00:00:00.000Z',
      }, null, 2)}\n`);
      expect(read('.claude/agents/sbl-top.md')).toContain('\nmodel: fable\n');
      expect(read('.opencode/agents/sbl-light.md')).toContain('\nmodel: opencode/claude-haiku-4-5\n');
      expect(read('.opencode/agents/sbl-strong.md')).not.toMatch(/^model:/m);
      expect(read('.opencode/agents/sbl-top.md')).not.toMatch(/^model:/m);
      for (const dir of ['.claude/agents', '.opencode/agents']) {
        for (const t of TIERS) expect(read(`${dir}/sbl-${t}.md`)).not.toContain('TIER_PLACEHOLDER');
        expect(existsSync(join(cwd, `${dir}/sbl-worker.md`))).toBe(false);
        expect(existsSync(join(cwd, `${dir}/sbl-worker-cheap.md`))).toBe(false);
      }
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(false);
      expect(JSON.parse(read('.claude/settings.json')).hooks.SessionStart).toEqual([ownHook]);
      const agentsMd = read('AGENTS.md').replace(/\r\n/g, '\n');
      expect(agentsMd).toContain('Examples (from `.super-backlog/models.json`; change them with');
      expect(agentsMd).toContain('`opencode/claude-haiku-4-5`');

      const uninstall = await runUninstall(cwd, args({}), { confirm: () => false, removeGlobal: () => 0 });
      expect(uninstall).toBe(0);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(false);
      for (const dir of ['.claude/agents', '.opencode/agents']) {
        for (const t of TIERS) expect(existsSync(join(cwd, `${dir}/sbl-${t}.md`))).toBe(false);
      }
    } finally {
      log.mockRestore();
      error.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

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
