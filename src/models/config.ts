// src/models/config.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../lib/atomic.js';
import { CLAUDE_DEFAULTS, CONFIG_PATH, defaultConfig, HARNESSES, MODEL_ID_MAX, MODEL_ID_RE, TIERS } from './defaults.js';
import type { Harness, RouterConfig, Tier, TierModels } from './types.js';

export function isValidModelId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MODEL_ID_MAX &&
    MODEL_ID_RE.test(value) &&
    !value.endsWith(':') // `model: abc:` is invalid YAML
  );
}

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}

export function isHarness(value: unknown): value is Harness {
  return typeof value === 'string' && (HARNESSES as readonly string[]).includes(value);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function cleanTiers(value: unknown): TierModels {
  const src = asObject(value) ?? {};
  const out: TierModels = {};
  for (const tier of TIERS) {
    const model = src[tier];
    if (isValidModelId(model)) out[tier] = model;
  }
  return out;
}

function firstValid(...values: unknown[]): string | undefined {
  return values.find(isValidModelId);
}

/** v1 → v2: workhorse → OpenCode standard, budget → OpenCode light. v1 Claude values were OpenCode ids, so Claude tiers are not migrated. */
function migrateV1(raw: Record<string, unknown>): RouterConfig {
  const individual = asObject(raw['individual']) ?? {};
  const tiers = asObject(raw['tiers']) ?? {};
  const resolved = asObject(raw['resolved']) ?? {};
  const cfg: RouterConfig = { version: 2, enabled: raw['enabled'] === true, tiers: {} };
  const opencode: TierModels = {};
  const light = firstValid(individual['budget'], tiers['budget'], resolved['budget']);
  const standard = firstValid(individual['workhorse'], tiers['workhorse'], resolved['workhorse']);
  if (light !== undefined) opencode.light = light;
  if (standard !== undefined) opencode.standard = standard;
  if (Object.keys(opencode).length > 0) cfg.tiers.opencode = opencode;
  const discoveredAt = resolved['discoveredAt'];
  if (typeof discoveredAt === 'string' && discoveredAt.length > 0) cfg.discoveredAt = discoveredAt;
  return cfg;
}

/** Any input → a normalized version 2 config. Files whose `version` is not 2 are migrated from v1; readers reject versions above 2 before this. */
export function normalizeConfig(raw: unknown): RouterConfig {
  const obj = asObject(raw);
  if (!obj) return defaultConfig();
  if (obj['version'] !== 2) return migrateV1(obj);
  const tiersIn = asObject(obj['tiers']) ?? {};
  const cfg: RouterConfig = { version: 2, enabled: obj['enabled'] === true, tiers: {} };
  for (const harness of HARNESSES) {
    const models = cleanTiers(tiersIn[harness]);
    if (Object.keys(models).length > 0) cfg.tiers[harness] = models;
  }
  const discoveredAt = obj['discoveredAt'];
  if (typeof discoveredAt === 'string' && discoveredAt.length > 0) cfg.discoveredAt = discoveredAt;
  return cfg;
}

/**
 * Never throws; always returns a normalized version 2 config.
 * Compat: the v1 OpenCode plugin copied into projects imports this from
 * dist/models/config.js; keep the export path stable until the next major
 * version removes that shim.
 */
export function loadConfig(cwd: string): RouterConfig {
  const path = join(cwd, CONFIG_PATH);
  if (!existsSync(path)) return defaultConfig();
  try {
    return normalizeConfig(parseConfigText(readFileSync(path, 'utf8')));
  } catch {
    return defaultConfig();
  }
}

/** Thrown instead of overwriting an unparsable models.json. */
export class InvalidConfigError extends Error {
  constructor(message = `${CONFIG_PATH} is not valid JSON - left unchanged; fix or delete it`) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}

/** Thrown instead of migrating or overwriting a models.json written by a newer super-backlog. */
export class UnsupportedConfigVersionError extends InvalidConfigError {
  constructor(version: number) {
    super(`${CONFIG_PATH} has version ${version}, which this super-backlog does not support - left unchanged; upgrade super-backlog or delete it`);
    this.name = 'UnsupportedConfigVersionError';
  }
}

/** Editors such as PowerShell 5.1 `Set-Content -Encoding utf8` write a leading UTF-8 BOM, which JSON.parse rejects. */
export function stripBom(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

/** Parses models.json text; throws InvalidConfigError for bad JSON and UnsupportedConfigVersionError for a version above 2. */
export function parseConfigText(raw: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(raw));
  } catch {
    throw new InvalidConfigError();
  }
  const version = asObject(parsed)?.['version'];
  if (typeof version === 'number' && version > 2) throw new UnsupportedConfigVersionError(version);
  return parsed;
}

/** Like loadConfig, but an unreadable file throws InvalidConfigError. For callers that write the config back. */
export function readConfigStrict(cwd: string): RouterConfig {
  const path = join(cwd, CONFIG_PATH);
  if (!existsSync(path)) return defaultConfig();
  return normalizeConfig(parseConfigText(readFileSync(path, 'utf8')));
}

export function serializeConfig(cfg: RouterConfig): string {
  return `${JSON.stringify(normalizeConfig(cfg), null, 2)}\n`;
}

export function writeConfig(cwd: string, cfg: RouterConfig): void {
  atomicWrite(join(cwd, CONFIG_PATH), serializeConfig(cfg));
}

export function claudeModel(cfg: RouterConfig, tier: Tier): string {
  return cfg.tiers.claude?.[tier] ?? CLAUDE_DEFAULTS[tier];
}

export interface EffectiveTiers {
  claude: Record<Tier, string>;
  opencode: TierModels;
}

export function effectiveTiers(cfg: RouterConfig): EffectiveTiers {
  const claude = {} as Record<Tier, string>;
  for (const tier of TIERS) claude[tier] = claudeModel(cfg, tier);
  return { claude, opencode: { ...(cfg.tiers.opencode ?? {}) } };
}
