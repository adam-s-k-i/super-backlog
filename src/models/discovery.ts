// src/models/discovery.ts
import { runCapture } from '../lib/run.js';
import { isValidModelId } from './config.js';
import { TIERS } from './defaults.js';
import type { Tier, TierModels } from './types.js';

export interface DiscoveryResult {
  discoveredAt: string;
  tiers: TierModels;
}

const LIGHT_PATTERNS = ['haiku', 'flash-lite', 'nano', '-lite', '-mini'];

/** Ordered substring preferences; earlier patterns win, the first id matching a pattern wins. */
const PREFERENCES: Record<Tier, string[]> = {
  top: ['fable', 'mythos', 'opus'],
  strong: ['opus', 'codex', 'gpt-5', '-pro'],
  standard: ['sonnet', 'flash', 'k2.5'],
  light: LIGHT_PATTERNS,
};

export function parseOpenCodeModels(output: string): string[] {
  return output
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes('/'));
}

function isLightMatch(id: string): boolean {
  const lower = id.toLowerCase();
  return LIGHT_PATTERNS.some((p) => lower.includes(p));
}

function pick(available: string[], tier: Tier): string | undefined {
  const pool = tier === 'light' ? available : available.filter((id) => !isLightMatch(id));
  for (const pattern of PREFERENCES[tier]) {
    const hit = pool.find((id) => id.toLowerCase().includes(pattern));
    if (hit !== undefined) return hit;
  }
  return undefined;
}

export function rankFourTiers(available: string[]): TierModels {
  const picks: TierModels = {
    light: pick(available, 'light'),
    standard: pick(available, 'standard'),
    strong: pick(available, 'strong'),
  };
  picks.top = pick(available, 'top') ?? picks.strong;
  const out: TierModels = {};
  for (const tier of TIERS) {
    const id = picks[tier];
    if (id !== undefined) out[tier] = id;
  }
  return out;
}

export async function discoverModels(cwd: string): Promise<DiscoveryResult | null> {
  try {
    const result = runCapture('opencode', ['models'], cwd);
    if (result.status !== 0) return null;
    const available = parseOpenCodeModels(result.stdout).filter(isValidModelId);
    if (available.length === 0) return null;
    const tiers = rankFourTiers(available);
    if (Object.keys(tiers).length === 0) return null;
    return { discoveredAt: new Date().toISOString(), tiers };
  } catch {
    return null;
  }
}
