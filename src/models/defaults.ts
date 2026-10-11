// src/models/defaults.ts
import type { Harness, RouterConfig, Tier } from './types.js';

export const TIERS: readonly Tier[] = ['light', 'standard', 'strong', 'top'];
export const HARNESSES: readonly Harness[] = ['claude', 'opencode'];

/** Claude Code aliases, valid as the Agent tool's `model` parameter and in agent frontmatter. */
export const CLAUDE_DEFAULTS: Record<Tier, string> = {
  light: 'haiku',
  standard: 'sonnet',
  strong: 'opus',
  top: 'fable',
};

/** Ids are written into YAML frontmatter and Markdown; anything else is rejected. */
export const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;
export const MODEL_ID_MAX = 100;

export const CONFIG_PATH = '.super-backlog/models.json';

export function defaultConfig(): RouterConfig {
  return { version: 2, enabled: false, tiers: {} };
}
