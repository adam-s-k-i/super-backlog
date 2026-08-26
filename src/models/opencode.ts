// src/models/opencode.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite } from '../lib/atomic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function installOpenCodeAdapter(cwd: string): void {
  const pluginPath = join(cwd, '.opencode', 'plugins', 'sbl-model-router.js');
  const workerPath = join(cwd, '.opencode', 'agents', 'sbl-worker.md');
  const cheapPath = join(cwd, '.opencode', 'agents', 'sbl-worker-cheap.md');
  atomicWrite(pluginPath, readFileSync(join(__dirname, '../templates/model-router-plugin.js'), 'utf8'));
  atomicWrite(workerPath, readFileSync(join(__dirname, '../templates/agent-sbl-worker.md'), 'utf8'));
  atomicWrite(cheapPath, readFileSync(join(__dirname, '../templates/agent-sbl-worker-cheap.md'), 'utf8'));
}
