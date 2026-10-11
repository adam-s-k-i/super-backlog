// src/commands/models.ts
import { KIT_VERSION } from '../lib/version.js';
import { applyRouter } from '../models/apply.js';
import { InvalidConfigError, isHarness, isTier, isValidModelId, loadConfig, serializeConfig } from '../models/config.js';
import { HARNESSES, TIERS } from '../models/defaults.js';
import { discoverModels } from '../models/discovery.js';
import { saveDiscovery, setRouterEnabled, setRouterTier } from '../models/install.js';
import type { RouterConfig } from '../models/types.js';
import type { ParsedArgs } from './init.js';

const DISABLED_NOTICE = 'router is disabled; run sbl models enable to use these tiers';
const SET_USAGE = 'usage: sbl models set <harness> <tier> <model>';
const MODEL_RULE =
  'allowed: letters, digits and . _ : / @ + -, starting with a letter or digit, not ending with ":", at most 100 characters; "-" removes the entry';

function apply(cwd: string, install: boolean): void {
  for (const line of applyRouter(cwd, { install, block: true, version: KIT_VERSION })) console.log(line);
}

function noticeIfDisabled(cfg: RouterConfig): void {
  if (!cfg.enabled) console.log(DISABLED_NOTICE);
}

function runSet(cwd: string, rest: string[]): number {
  const [harness, tier, model, ...extra] = rest;
  if (harness === undefined || tier === undefined || model === undefined || extra.length > 0) {
    console.error(SET_USAGE);
    return 1;
  }
  if (!isHarness(harness)) {
    console.error(`invalid harness: ${harness} (allowed: ${HARNESSES.join(', ')})`);
    return 1;
  }
  if (!isTier(tier)) {
    console.error(`invalid tier: ${tier} (allowed: ${TIERS.join(', ')})`);
    return 1;
  }
  if (model !== '-' && !isValidModelId(model)) {
    console.error(`invalid model id: ${JSON.stringify(model)} (${MODEL_RULE})`);
    return 1;
  }
  const cfg = setRouterTier(cwd, harness, tier, model === '-' ? null : model);
  console.log(model === '-' ? `${harness} ${tier} removed` : `${harness} ${tier} = ${model}`);
  apply(cwd, false);
  noticeIfDisabled(cfg);
  return 0;
}

async function runDiscover(cwd: string): Promise<number> {
  const result = await discoverModels(cwd);
  if (!result) {
    console.error('discovery failed (is the OpenCode CLI available?)');
    return 1;
  }
  const cfg = saveDiscovery(cwd, result.discoveredAt, result.tiers);
  for (const tier of TIERS) console.log(`opencode ${tier}: ${result.tiers[tier] ?? '(session model)'}`);
  apply(cwd, false);
  noticeIfDisabled(cfg);
  return 0;
}

export async function runModels(cwd: string, args: ParsedArgs): Promise<number> {
  try {
    return await runSubcommand(cwd, args);
  } catch (err) {
    if (!(err instanceof InvalidConfigError)) throw err;
    console.error(err.message);
    return 1;
  }
}

async function runSubcommand(cwd: string, args: ParsedArgs): Promise<number> {
  const [sub = 'show', ...rest] = args.positionals;
  switch (sub) {
    case 'show':
      console.log(serializeConfig(loadConfig(cwd)).trimEnd());
      return 0;
    case 'enable':
      setRouterEnabled(cwd, true);
      console.log('model router enabled');
      apply(cwd, true);
      return 0;
    case 'disable':
      setRouterEnabled(cwd, false);
      console.log('model router disabled');
      apply(cwd, false);
      return 0;
    case 'set':
      return runSet(cwd, rest);
    case 'discover':
      return runDiscover(cwd);
    default:
      console.error(`unknown models subcommand: ${sub}`);
      return 1;
  }
}
