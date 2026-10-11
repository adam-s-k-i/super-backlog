// src/models/types.ts
export type Tier = 'light' | 'standard' | 'strong' | 'top';
export type Harness = 'claude' | 'opencode';
export type TierModels = Partial<Record<Tier, string>>;

/** `.super-backlog/models.json` version 2. */
export interface RouterConfig {
  version: 2;
  enabled: boolean;
  tiers: Partial<Record<Harness, TierModels>>;
  discoveredAt?: string;
}
