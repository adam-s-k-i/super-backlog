// src/models/apply.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentsBlockContents } from '../init/planner.js';
import { atomicWrite } from '../lib/atomic.js';
import { injectBlock, stripOwned } from '../lib/markers.js';
import { agentModel, agentPath, cleanLegacy, isRouterInstalled, writeAgentFile } from './agents.js';
import { loadConfig, serializeConfig } from './config.js';
import { CONFIG_PATH, HARNESSES, TIERS } from './defaults.js';

export interface ApplyOptions {
  install: boolean;
  block: boolean;
  version: string;
}

/** Writes models.json back when it differs from its normalized form. Unparsable files are never touched. */
function migrateFile(cwd: string): string[] {
  const path = join(cwd, CONFIG_PATH);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [`warning: ${CONFIG_PATH} is not valid JSON - left unchanged`];
  }
  const normalized = serializeConfig(loadConfig(cwd));
  if (raw.replace(/\r\n/g, '\n') === normalized) return [];
  atomicWrite(path, normalized);
  const version = parsed !== null && typeof parsed === 'object' ? (parsed as { version?: unknown }).version : undefined;
  return [version === 2 ? `normalized ${CONFIG_PATH}` : `migrated ${CONFIG_PATH} to version 2`];
}

function refreshBlock(cwd: string, version: string): string[] {
  const path = join(cwd, 'AGENTS.md');
  if (!existsSync(path)) return [];
  const current = readFileSync(path, 'utf8');
  if (!stripOwned(current).removed) return [];
  const injected = injectBlock(current, version, agentsBlockContents(version, cwd));
  if (injected.action === 'unchanged') return [];
  atomicWrite(path, injected.content);
  return ['updated AGENTS.md'];
}

/** The only code path that writes router files. Returns the report lines. */
export function applyRouter(cwd: string, opts: ApplyOptions): string[] {
  const lines = migrateFile(cwd);
  const cfg = loadConfig(cwd);
  const harnesses = opts.install ? [...HARNESSES] : HARNESSES.filter((h) => isRouterInstalled(cwd, h));
  for (const harness of harnesses) {
    for (const tier of TIERS) {
      const result = writeAgentFile(cwd, harness, tier, agentModel(cfg, harness, tier));
      if (result !== 'unchanged') lines.push(`${result} ${agentPath(harness, tier)}`);
    }
    lines.push(...cleanLegacy(cwd, harness));
  }
  if (opts.block) lines.push(...refreshBlock(cwd, opts.version));
  return lines;
}
