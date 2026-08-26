// src/models/claude.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite } from '../lib/atomic.js';
import { loadConfig } from './config.js';
import { resolveTier } from './resolve.js';

const MODEL_RE = /^model:\s*.+$/m;

export function syncClaudeAgents(cwd: string, mainModel?: string): void {
  const cfg = loadConfig(cwd);
  if (!cfg.enabled) return;
  const workhorse = mainModel ? resolveTier(mainModel, 'workhorse', cfg) : cfg.resolved.workhorse || null;
  const budget = mainModel ? resolveTier(mainModel, 'budget', cfg) : cfg.resolved.budget || null;
  updateAgentFile(cwd, 'sbl-worker.md', workhorse);
  updateAgentFile(cwd, 'sbl-worker-cheap.md', budget);
}

export function updateAgentFile(cwd: string, file: string, model: string | null): void {
  const path = join(cwd, '.claude', 'agents', file);
  if (!existsSync(path)) return;
  let content = readFileSync(path, 'utf8');
  const replacement = `model: ${model ?? 'inherit'}`;
  if (MODEL_RE.test(content)) {
    content = content.replace(MODEL_RE, replacement);
  } else {
    content = content.replace(/^---$/m, `---\n${replacement}`);
  }
  atomicWrite(path, content);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export function installClaudeAdapter(cwd: string): void {
  const workerPath = join(cwd, '.claude', 'agents', 'sbl-worker.md');
  const cheapPath = join(cwd, '.claude', 'agents', 'sbl-worker-cheap.md');
  atomicWrite(workerPath, readFileSync(join(__dirname, '../templates/claude-agent-sbl-worker.md'), 'utf8'));
  atomicWrite(cheapPath, readFileSync(join(__dirname, '../templates/claude-agent-sbl-worker-cheap.md'), 'utf8'));
  installSettingsHook(cwd);
}

function installSettingsHook(cwd: string): void {
  const path = join(cwd, '.claude', 'settings.json');
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const hook = {
    hooks: {
      SessionStart: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: 'node',
              args: ['node_modules/super-backlog/dist/templates/cc-session-hook.js'],
            },
          ],
        },
      ],
    },
  };
  const next = { ...existing, hooks: { ...existing.hooks, ...hook.hooks } };
  atomicWrite(path, `${JSON.stringify(next, null, 2)}\n`);
}
