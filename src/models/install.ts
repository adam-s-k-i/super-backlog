// src/models/install.ts
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../lib/atomic.js';
import { loadConfig } from './config.js';
import type { RouterConfig } from './types.js';

const CONFIG_DIR = '.super-backlog';
const CONFIG_FILE = 'models.json';

export function writeRouterConfig(cwd: string, enabled: boolean): boolean {
  writeConfigPatch(cwd, { enabled });
  return true;
}

/** Persist discovered tiers so the dashboard shows them across sessions. */
export function writeResolvedTiers(
  cwd: string,
  resolved: RouterConfig['resolved'],
): void {
  writeConfigPatch(cwd, { resolved });
}

function writeConfigPatch(cwd: string, patch: Partial<RouterConfig>): void {
  const dir = join(cwd, CONFIG_DIR);
  const path = join(dir, CONFIG_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const current = loadConfig(cwd);
  const next: RouterConfig = { ...current, ...patch };
  atomicWrite(path, `${JSON.stringify(next, null, 2)}\n`);
}
