import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG, DEFAULT_FAMILIES } from './defaults.js';
import type { FamilyTiers, RouterConfig } from './types.js';

const CONFIG_PATH = '.super-backlog/models.json';

export function loadConfig(cwd: string): RouterConfig {
  const path = join(cwd, CONFIG_PATH);
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG };
    return normalizeConfig(raw as Partial<RouterConfig>);
  } catch {
    return { ...DEFAULT_CONFIG, enabled: false };
  }
}

export function normalizeConfig(partial: Partial<RouterConfig>): RouterConfig {
  return {
    version: typeof partial.version === 'number' ? partial.version : DEFAULT_CONFIG.version,
    enabled: partial.enabled === true,
    mode: ['auto', 'family', 'individual'].includes(partial.mode as string) ? (partial.mode as RouterConfig['mode']) : 'family',
    tiers: partial.tiers && typeof partial.tiers === 'object' ? partial.tiers : {},
    individual: partial.individual && typeof partial.individual === 'object' ? partial.individual : {},
    families: partial.families && typeof partial.families === 'object' ? partial.families : {},
    resolved: partial.resolved && typeof partial.resolved === 'object' ? partial.resolved : {},
  };
}

export function getFamilyTable(config: RouterConfig): Record<string, FamilyTiers> {
  const merged: Record<string, FamilyTiers> = {};
  for (const [name, tiers] of Object.entries(DEFAULT_FAMILIES)) {
    merged[name] = { ...tiers, ...(config.families[name] || {}) };
  }
  for (const [name, tiers] of Object.entries(config.families)) {
    if (!merged[name]) merged[name] = { workhorse: '', budget: '', ...tiers };
  }
  return merged;
}
