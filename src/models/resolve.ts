// src/models/resolve.ts
import type { RouterConfig } from './types.js';

/**
 * Compat shim: the v1 OpenCode plugin (.opencode/plugins/sbl-model-router.js)
 * imports this and returns early on null, leaving the model alone. Router v2
 * writes models into agent files instead. The next major version removes it.
 */
export function resolveTier(_mainModel: string, _tier: string, _config: RouterConfig): null {
  return null;
}
