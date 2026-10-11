// src/models/install.ts
import { loadConfig, normalizeConfig, writeConfig } from './config.js';
import type { Harness, RouterConfig, Tier, TierModels } from './types.js';

function mutate(cwd: string, change: (cfg: RouterConfig) => void): RouterConfig {
  const cfg = loadConfig(cwd);
  change(cfg);
  const next = normalizeConfig(cfg);
  writeConfig(cwd, next);
  return next;
}

export function setRouterEnabled(cwd: string, enabled: boolean): RouterConfig {
  return mutate(cwd, (cfg) => {
    cfg.enabled = enabled;
  });
}

/** `model: null` removes the entry. */
export function setRouterTier(cwd: string, harness: Harness, tier: Tier, model: string | null): RouterConfig {
  return mutate(cwd, (cfg) => {
    const current: TierModels = { ...(cfg.tiers[harness] ?? {}) };
    if (model === null) delete current[tier];
    else current[tier] = model;
    cfg.tiers[harness] = current;
  });
}

/** Replaces the OpenCode tiers; Claude tiers and `enabled` stay. */
export function saveDiscovery(cwd: string, discoveredAt: string, tiers: TierModels): RouterConfig {
  return mutate(cwd, (cfg) => {
    cfg.tiers.opencode = { ...tiers };
    cfg.discoveredAt = discoveredAt;
  });
}
