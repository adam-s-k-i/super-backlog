// src/init/planner.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PM } from '../lib/pm.js';
import { applyPluginEntry } from '../lib/opencode.js';

export interface FileOp { kind: 'write'; path: string; contents: string }
export interface JsonOp { kind: 'merge-json'; path: 'opencode.json' | 'package.json'; transform: 'plugin-entry' | 'scripts-and-devdeps' }
export interface InjectOp { kind: 'inject-agents-block' }
export interface PointerOp { kind: 'write-claude-pointer' }
export interface SkillsOp { kind: 'copy-skills' }
export interface HookOp { kind: 'install-guard-hook' }
export interface RefreshHookOp { kind: 'install-refresh-hook' }
export interface UpstreamOp { kind: 'upstream-install'; pm: PM | 'none' } // skipped when SBL_SKIP_INSTALL
export interface DashboardOp { kind: 'generate-dashboard' }
export type Action = FileOp | JsonOp | InjectOp | PointerOp | SkillsOp | HookOp | RefreshHookOp | UpstreamOp | DashboardOp;

export interface InitOptions {
  projectName?: string;
  harnesses: Array<'opencode' | 'claude'>;
  pm: PM | 'auto' | 'skip';
  guard: boolean;
  dashboard: boolean;
  refreshHook?: boolean; // default true; CLI passes --no-refresh-hook as false
  skipInstall: boolean;
}

export interface InitState {
  cwd: string;
  detectedPm: PM | null;
  hasBacklogConfig: boolean;
  agentsExists: boolean;
  claudeMdExists: boolean;
  opencodeConfig: unknown | undefined; // undefined = file absent
  pkgExists: boolean;
}

function readTemplate(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url)); // src/init at dev time, dist/init at runtime
  const candidates = [join(here, '..', 'templates', name), join(here, 'templates', name)];
  for (const c of candidates) if (existsSync(c)) return readFileSync(c, 'utf8');
  throw new Error(`template not found: ${name}`);
}

export function agentsBlockContents(version: string): string {
  return readTemplate('workflow-block.md').replace(/\{\{VERSION\}\}/g, version);
}

export function planInit(
  state: InitState,
  opts: InitOptions,
  _version: string,
): { actions: Action[]; warnings: string[] } {
  const actions: Action[] = [];
  const warnings: string[] = [];

  const degradedAuto = opts.pm === 'auto' && state.detectedPm === null;

  if (!opts.skipInstall && !degradedAuto && opts.pm !== 'skip') {
    if (opts.pm === 'auto' && state.detectedPm !== null) {
      actions.push({ kind: 'upstream-install', pm: state.detectedPm });
    } else if (opts.pm !== 'auto') {
      actions.push({ kind: 'upstream-install', pm: opts.pm });
    }
  }
  if (degradedAuto && !opts.skipInstall) {
    warnings.push(
      'no package manager detected - dependency installation and package.json merge were skipped; ' +
      'install backlog.md and super-backlog manually, or re-run with --pm <npm|pnpm|bun>',
    );
  }

  // opencode.json merge depends only on harness selection and applyPluginEntry
  // not throwing a near-miss - never on package.json presence or PM detection
  if (opts.harnesses.includes('opencode')) {
    try {
      applyPluginEntry(state.opencodeConfig);
      actions.push({ kind: 'merge-json', path: 'opencode.json', transform: 'plugin-entry' });
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (!degradedAuto && state.pkgExists) {
    actions.push({ kind: 'merge-json', path: 'package.json', transform: 'scripts-and-devdeps' });
  }

  if (opts.harnesses.length > 0) {
    actions.push({ kind: 'inject-agents-block' });
    actions.push({ kind: 'copy-skills' });
  }
  if (opts.harnesses.includes('claude')) actions.push({ kind: 'write-claude-pointer' });
  if (opts.guard) actions.push({ kind: 'install-guard-hook' });
  if (opts.refreshHook ?? true) actions.push({ kind: 'install-refresh-hook' });
  if (opts.dashboard) actions.push({ kind: 'generate-dashboard' });

  return { actions, warnings };
}
