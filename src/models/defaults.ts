import type { FamilyTiers, RouterConfig } from './types.js';

export const DEFAULT_FAMILIES: Record<string, FamilyTiers> = {
  kimi: { workhorse: 'opencode/kimi-k2.7-code', budget: 'opencode/kimi-k2.5' },
  grok: { workhorse: 'xai/grok-4.5', budget: 'xai/grok-4.3' },
  claude: { workhorse: 'opencode/claude-sonnet-4-6', budget: 'opencode/claude-haiku-4-5' },
  gpt: { workhorse: 'opencode/gpt-5.1-codex-mini', budget: 'opencode/gpt-5-nano' },
  gemini: { workhorse: 'opencode/gemini-3.5-flash', budget: 'opencode/gemini-3.5-flash-lite' },
};

export const DEFAULT_CONFIG: RouterConfig = {
  version: 1,
  enabled: false,
  mode: 'family',
  tiers: {},
  individual: {},
  families: {},
  resolved: {},
};
