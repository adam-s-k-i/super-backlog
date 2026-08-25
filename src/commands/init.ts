// src/commands/init.ts
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';

import { detectPackageManager } from '../lib/pm.js';
import { KIT_VERSION } from '../lib/version.js';
import { executeActions, RefusalError, UpstreamError } from '../init/execute.js';
import { planInit, type Action, type InitOptions, type InitState } from '../init/planner.js';
import type { PM } from '../lib/pm.js';

export interface ParsedArgs {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
}

const HARNESS_VALUES = ['opencode', 'claude'] as const;
type Harness = (typeof HARNESS_VALUES)[number];

const PM_VALUES = ['auto', 'npm', 'pnpm', 'bun', 'skip'] as const;

function isHarness(value: string): value is Harness {
  return (HARNESS_VALUES as readonly string[]).includes(value);
}

function describeAction(action: Action): string {
  switch (action.kind) {
    case 'upstream-install':
      return `upstream-install via ${action.pm}`;
    case 'merge-json':
      return `merge-json ${action.path} (${action.transform})`;
    case 'inject-agents-block':
      return 'inject-agents-block AGENTS.md';
    case 'write-claude-pointer':
      return 'write-claude-pointer CLAUDE.md';
    case 'copy-skills':
      return 'copy-skills (.opencode/skill + .claude/skills)';
    case 'install-guard-hook':
      return 'install-guard-hook .git/hooks/pre-commit';
    case 'generate-dashboard':
      return 'generate-dashboard';
    case 'write':
      return `write ${action.path}`;
  }
}

export async function runInit(cwd: string, args: ParsedArgs): Promise<number> {
  const harnesses: Harness[] = [];
  const rawHarnesses = args.values.harness;
  const listed: unknown[] = Array.isArray(rawHarnesses)
    ? rawHarnesses
    : rawHarnesses === undefined
      ? []
      : [rawHarnesses];
  for (const entry of listed) {
    for (const part of String(entry).split(',')) {
      const name = part.trim();
      if (name === '') continue;
      if (!isHarness(name)) {
        console.error(`Invalid --harness "${name}" (expected: ${HARNESS_VALUES.join(', ')})`);
        return 1;
      }
      if (!harnesses.includes(name)) harnesses.push(name);
    }
  }
  if (harnesses.length === 0) harnesses.push('opencode', 'claude');

  const rawPm = args.values.pm === undefined ? 'auto' : String(args.values.pm);
  if (!(PM_VALUES as readonly string[]).includes(rawPm)) {
    console.error(`Invalid --pm "${rawPm}" (expected: ${PM_VALUES.join(', ')})`);
    return 1;
  }
  const pm = rawPm as PM | 'auto' | 'skip';

  const guard = args.values.guard === true; // opt-in per spec D8
  const dashboard = args.values['no-dashboard'] !== true;
  const dryRun = args.values['dry-run'] === true;
  const projectName = args.positionals[0] ?? basename(resolve(cwd));

  let opencodeConfig: unknown | undefined;
  const opencodePath = join(cwd, 'opencode.json');
  if (existsSync(opencodePath)) {
    try {
      opencodeConfig = JSON.parse(readFileSync(opencodePath, 'utf8'));
    } catch {
      console.error('error: opencode.json is not valid JSON - fix it manually, then re-run');
      return 1; // detection failure, consistent with uninstall
    }
  }

  const state: InitState = {
    cwd,
    detectedPm: detectPackageManager(cwd),
    hasBacklogConfig: existsSync(join(cwd, 'backlog', 'config.yml')),
    agentsExists: existsSync(join(cwd, 'AGENTS.md')),
    claudeMdExists: existsSync(join(cwd, 'CLAUDE.md')),
    opencodeConfig,
    pkgExists: existsSync(join(cwd, 'package.json')),
  };

  const opts: InitOptions = { projectName, harnesses, pm, guard, dashboard, skipInstall: false };
  const plan = planInit(state, opts, KIT_VERSION);

  if (dryRun) {
    console.log(`dry-run for "${projectName}": ${plan.actions.length} action(s) planned, nothing written`);
    for (const action of plan.actions) console.log(`  - ${describeAction(action)}`);
    for (const warning of plan.warnings) console.log(`warning: ${warning}`);
    return plan.warnings.length > 0 ? 4 : 0;
  }

  try {
    const result = await executeActions(cwd, plan.actions, {
      version: KIT_VERSION,
      projectName,
      hasBacklogConfig: state.hasBacklogConfig,
    });
    const warnings = [...plan.warnings, ...result.warnings];
    console.log(
      `super-backlog init complete - planned ${plan.actions.length}, applied ${result.applied}, skipped ${result.skipped}`,
    );
    for (const warning of warnings) console.log(`warning: ${warning}`);
    return warnings.length > 0 ? 4 : 0;
  } catch (err) {
    if (err instanceof UpstreamError) {
      console.error(`error: upstream command failed: ${err.message}`);
      return 3;
    }
    if (err instanceof RefusalError) {
      console.error(`error: ${err.message}`);
      return 2;
    }
    throw err;
  }
}
