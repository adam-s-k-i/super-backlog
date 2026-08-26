// test/integration/opencode-router.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installOpenCodeAdapter } from '../../src/models/opencode.js';
import { executeActions } from '../../src/init/execute.js';

describe('OpenCode adapter install', () => {
  it('writes plugin and agent files', () => {
    const cwd = join(tmpdir(), `sbl-oc-${Date.now()}`);
    try {
      installOpenCodeAdapter(cwd);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(true);
      expect(existsSync(join(cwd, '.opencode/agents/sbl-worker.md'))).toBe(true);
      const plugin = readFileSync(join(cwd, '.opencode/plugins/sbl-model-router.js'), 'utf8');
      expect(plugin).toContain('sbl-worker');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('installs adapter via executeActions when router enabled', async () => {
    const cwd = join(tmpdir(), `sbl-oc-exec-${Date.now()}`);
    try {
      const result = await executeActions(cwd, [{ kind: 'install-model-router', enabled: true }], {
        version: '0.4.0',
        projectName: 'test',
        hasBacklogConfig: false,
      });
      expect(result.applied).toBe(1);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(true);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(true);
      expect(existsSync(join(cwd, '.opencode/agents/sbl-worker-cheap.md'))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
