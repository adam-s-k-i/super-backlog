// test/integration/claude-router.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installClaudeAdapter } from '../../src/models/claude.js';

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
});
