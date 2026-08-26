import type { RouterConfig } from './types.js';
import { getFamilyTable } from './config.js';
import { detectFamily } from './family.js';

export { detectFamily } from './family.js';

export function resolveTier(
  mainModel: string,
  tier: 'workhorse' | 'budget',
  config: RouterConfig,
): string | null {
  if (!config.enabled) return null;

  if (config.mode === 'individual') {
    return config.individual[tier] || null;
  }

  const family = detectFamily(mainModel);
  if (!family) return null;

  if (config.mode === 'family') {
    const table = getFamilyTable(config);
    const entry = table[family];
    if (!entry) return null;
    return config.tiers[tier] || entry[tier] || null;
  }

  // auto mode falls back to family table when discovery is not populated
  return config.resolved[tier] || config.tiers[tier] || null;
}
