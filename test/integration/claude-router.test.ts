// test/integration/claude-router.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installClaudeAdapter, syncClaudeAgents } from '../../src/models/claude.js';
import { atomicWrite } from '../../src/lib/atomic.js';

describe('Claude adapter', () => {
  it('installs agent files with placeholders', () => {
    const cwd = join(tmpdir(), `sbl-cc-${Date.now()}`);
    try {
      installClaudeAdapter(cwd);
      const worker = readFileSync(join(cwd, '.claude/agents/sbl-worker.md'), 'utf8');
      expect(worker).toContain('model: TIER_PLACEHOLDER');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('syncs agents to resolved models when main model is absent', () => {
    const cwd = join(tmpdir(), `sbl-cc-sync-${Date.now()}`);
    try {
      mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
      mkdirSync(join(cwd, '.claude/agents'), { recursive: true });
      atomicWrite(join(cwd, '.super-backlog/models.json'), JSON.stringify({
        version: 1, enabled: true, mode: 'family', tiers: {}, individual: {}, families: {},
        resolved: { workhorse: 'sonnet', budget: 'haiku' },
      }));
      atomicWrite(join(cwd, '.claude/agents/sbl-worker.md'), '---\nname: sbl-worker\nmodel: TIER_PLACEHOLDER\n---\n');
      atomicWrite(join(cwd, '.claude/agents/sbl-worker-cheap.md'), '---\nname: sbl-worker-cheap\nmodel: TIER_PLACEHOLDER\n---\n');
      syncClaudeAgents(cwd);
      expect(readFileSync(join(cwd, '.claude/agents/sbl-worker.md'), 'utf8')).toContain('model: sonnet');
      expect(readFileSync(join(cwd, '.claude/agents/sbl-worker-cheap.md'), 'utf8')).toContain('model: haiku');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
