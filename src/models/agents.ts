// src/models/agents.ts
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../lib/atomic.js';
import { detectEol } from '../lib/eol.js';
import { claudeModel } from './config.js';
import { TIERS } from './defaults.js';
import type { Harness, RouterConfig, Tier } from './types.js';
import { stripSessionHook } from './uninstall.js';

export const AGENT_DIRS: Record<Harness, string> = {
  claude: '.claude/agents',
  opencode: '.opencode/agents',
};
export const LEGACY_AGENT_FILES: readonly string[] = ['sbl-worker.md', 'sbl-worker-cheap.md'];
export const LEGACY_PLUGIN = '.opencode/plugins/sbl-model-router.js';

const TIER_LABELS: Record<Tier, string> = { light: 'Light', standard: 'Standard', strong: 'Strong', top: 'Top' };

const TIER_DESCRIPTIONS: Record<Tier, string> = {
  light: 'purely mechanical work such as searching, listing, extracting and reformatting.',
  standard: 'clearly specified routine work such as research, summaries, routine code, tests and documentation.',
  strong: 'demanding work with clear boundaries such as complex implementation, debugging and reviews.',
  top: 'analysis, design, architecture and every decision where a mistake is costly.',
};

const AGENT_BODY =
  'Work on the delegated task exactly as briefed. Return the result with evidence (paths, sources, numbers), no raw logs.';

export function agentFileName(tier: Tier): string {
  return `sbl-${tier}.md`;
}

/** POSIX path relative to the project root, used both for writing and for report lines. */
export function agentPath(harness: Harness, tier: Tier): string {
  return `${AGENT_DIRS[harness]}/${agentFileName(tier)}`;
}

/** The model written into an agent file; null means "no model line" (OpenCode only). */
export function agentModel(cfg: RouterConfig, harness: Harness, tier: Tier): string | null {
  if (harness === 'claude') return cfg.enabled ? claudeModel(cfg, tier) : 'inherit';
  return cfg.enabled ? (cfg.tiers.opencode?.[tier] ?? null) : null;
}

export function renderAgentFile(harness: Harness, tier: Tier, model: string | null): string {
  const lines = ['---', `name: sbl-${tier}`, `description: ${TIER_LABELS[tier]} tier — ${TIER_DESCRIPTIONS[tier]}`];
  if (harness === 'opencode') lines.push('mode: subagent');
  if (model !== null) lines.push(`model: ${model}`);
  lines.push('---', AGENT_BODY, '');
  return lines.join('\n');
}

/**
 * Replaces, inserts (after the opening ---) or removes (null) the frontmatter `model:` line; keeps everything
 * else, a leading UTF-8 BOM and the file's EOL. A file whose frontmatter has no closing --- is returned unchanged.
 */
export function setModelLine(content: string, model: string | null): string {
  const bom = content.startsWith('\uFEFF') ? '\uFEFF' : '';
  const eol = detectEol(content);
  const lines = content.slice(bom.length).split(/\r?\n/);
  if ((lines[0] ?? '').trimEnd() !== '---') {
    return model === null ? content : bom + ['---', `model: ${model}`, '---', ...lines].join(eol);
  }
  const close = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---');
  // Unclosed frontmatter: any edit would be repeated on every apply, so leave the file alone.
  if (close === -1) return content;
  const found = lines.slice(1, close).findIndex((l) => l.startsWith('model:'));
  const at = found === -1 ? -1 : found + 1;
  if (model === null) {
    if (at !== -1) lines.splice(at, 1);
  } else if (at !== -1) {
    lines[at] = `model: ${model}`;
  } else {
    lines.splice(1, 0, `model: ${model}`);
  }
  return bom + lines.join(eol);
}

export type AgentWrite = 'created' | 'updated' | 'unchanged';

export function writeAgentFile(cwd: string, harness: Harness, tier: Tier, model: string | null): AgentWrite {
  const abs = join(cwd, agentPath(harness, tier));
  if (!existsSync(abs)) {
    atomicWrite(abs, renderAgentFile(harness, tier, model));
    return 'created';
  }
  const current = readFileSync(abs, 'utf8');
  const next = setModelLine(current, model);
  if (next === current) return 'unchanged';
  atomicWrite(abs, next);
  return 'updated';
}

/** Any v2 or v1 agent file, or (OpenCode) the v1 plugin. */
export function isRouterInstalled(cwd: string, harness: Harness): boolean {
  const names = [...TIERS.map(agentFileName), ...LEGACY_AGENT_FILES];
  if (names.some((n) => existsSync(join(cwd, AGENT_DIRS[harness], n)))) return true;
  return harness === 'opencode' && existsSync(join(cwd, LEGACY_PLUGIN));
}

/** Removes router v1 leftovers for one harness; one report line per removal. */
export function cleanLegacy(cwd: string, harness: Harness): string[] {
  const lines: string[] = [];
  const rels = LEGACY_AGENT_FILES.map((f) => `${AGENT_DIRS[harness]}/${f}`);
  if (harness === 'opencode') rels.push(LEGACY_PLUGIN);
  for (const rel of rels) {
    const abs = join(cwd, rel);
    if (!existsSync(abs)) continue;
    rmSync(abs, { force: true });
    lines.push(`removed legacy ${rel}`);
  }
  if (harness === 'claude') {
    const hook = stripSessionHook(cwd);
    if (hook === 'removed') lines.push('removed legacy .claude/settings.json SessionStart hook');
    if (hook === 'invalid') lines.push('warning: .claude/settings.json is not valid JSON - legacy SessionStart hook left in place');
  }
  return lines;
}
