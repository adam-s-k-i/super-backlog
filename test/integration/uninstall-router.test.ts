// test/integration/uninstall-router.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installOpenCodeAdapter } from '../../src/models/opencode.js';
import { installClaudeAdapter } from '../../src/models/claude.js';
import { uninstallModelRouter } from '../../src/models/uninstall.js';
import { atomicWrite } from '../../src/lib/atomic.js';

describe('uninstall model router', () => {
  it('removes all router-owned files', () => {
    const cwd = join(tmpdir(), `sbl-uninstall-${Date.now()}`);
    try {
      mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
      atomicWrite(join(cwd, '.super-backlog/models.json'), JSON.stringify({ version: 1 }));
      installOpenCodeAdapter(cwd);
      installClaudeAdapter(cwd);
      const report: { verdict: string; label: string }[] = [];
      uninstallModelRouter(cwd, report);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(false);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(false);
      expect(report.some((r) => r.label === '.opencode/plugins/sbl-model-router.js')).toBe(true);
      expect(report.some((r) => r.label === '.super-backlog/models.json')).toBe(true);
      expect(report.some((r) => r.label === '.super-backlog/')).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('removes the Claude SessionStart hook from settings.json', () => {
    const cwd = join(tmpdir(), `sbl-uninstall-cc-${Date.now()}`);
    try {
      installClaudeAdapter(cwd);
      expect(existsSync(join(cwd, '.claude/settings.json'))).toBe(true);
      const report: { verdict: string; label: string }[] = [];
      uninstallModelRouter(cwd, report);
      const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
      expect(settings.hooks?.SessionStart).toBeUndefined();
      expect(report.some((r) => r.label === '.claude/settings.json SessionStart hook')).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('keeps unrelated SessionStart hooks', () => {
    const cwd = join(tmpdir(), `sbl-uninstall-cc-keep-${Date.now()}`);
    try {
      mkdirSync(join(cwd, '.claude'), { recursive: true });
      atomicWrite(
        join(cwd, '.claude/settings.json'),
        JSON.stringify({
          hooks: {
            SessionStart: [
              {
                matcher: '*',
                hooks: [
                  { type: 'command', command: 'node', args: ['some-other-script.js'] },
                ],
              },
            ],
          },
        }, null, 2) + '\n',
      );
      const report: { verdict: string; label: string }[] = [];
      uninstallModelRouter(cwd, report);
      const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
      expect(settings.hooks?.SessionStart).toHaveLength(1);
      expect(report.some((r) => r.label === '.claude/settings.json SessionStart hook (none owned)')).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
