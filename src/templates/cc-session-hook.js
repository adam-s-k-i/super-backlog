// src/templates/cc-session-hook.js
import { loadConfig } from 'super-backlog/dist/models/config.js';
import { resolveTier } from 'super-backlog/dist/models/resolve.js';
import { updateAgentFile } from 'super-backlog/dist/models/claude.js';

async function main() {
  try {
    let input = '';
    process.stdin.on('data', (d) => { input += d; });
    await new Promise((resolve) => process.stdin.on('end', resolve));
    let event = {};
    try { event = JSON.parse(input); } catch { /* ignore */ }
    const cwd = process.cwd();
    const cfg = loadConfig(cwd);
    if (!cfg.enabled) process.exit(0);
    const mainModel = event.model;
    if (!mainModel || typeof mainModel !== 'string') process.exit(0);
    updateAgentFile(cwd, 'sbl-worker.md', resolveTier(mainModel, 'workhorse', cfg));
    updateAgentFile(cwd, 'sbl-worker-cheap.md', resolveTier(mainModel, 'budget', cfg));
  } catch {
    // degrade silently so a broken router never blocks Claude Code startup
  }
  process.exit(0);
}

main().catch(() => process.exit(0));
