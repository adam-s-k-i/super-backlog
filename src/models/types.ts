export { DEFAULT_CONFIG } from './defaults.js';

export type ModelMode = 'auto' | 'family' | 'individual';

export interface FamilyTiers {
  workhorse: string;
  budget: string;
}

export interface RouterConfig {
  version: number;
  enabled: boolean;
  mode: ModelMode;
  tiers: Partial<FamilyTiers>;
  individual: Partial<FamilyTiers>;
  families: Record<string, Partial<FamilyTiers>>;
  resolved: Partial<{ discoveredAt: string } & FamilyTiers>;
}
