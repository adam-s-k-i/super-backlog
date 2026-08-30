// src/commands/update.ts
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import spawn from 'cross-spawn';

import { executeActions, findGitDir, InvalidJsonError, validateJsonFile, RefusalError, UpstreamError } from '../init/execute.js';
import { planInit, type Action, type InitOptions, type InitState } from '../init/planner.js';
import { GUARD_RE } from '../lib/hooks.js';
import { detectPackageManager } from '../lib/pm.js';
import { resolveBacklogBin, runCapture } from '../lib/run.js';
import { detectInstallKind, runSelfUpdate } from '../lib/self-update.js';
import { KIT_VERSION } from '../lib/version.js';
import { fetchLatestVersion } from '../lib/version-check.js';
import type { ParsedArgs } from './init.js';

/** Longer than the startup version-hint fetch: this one blocks `sbl update` directly. */
const SELF_UPDATE_FETCH_TIMEOUT_MS = 10000;

export interface SelfUpdateOverride {
  fetchLatest?: () => Promise<string | null>;
  npmInstallGlobal?: (spec: string) => { status: number | null };
  binRealPath?: string | null;
  globalRoot?: string | null;
  spawnSelf?: (
    binPath: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
  ) => { status: number | null };
}

function resolveGlobalRoot(cwd: string): string | null {
  const r = runCapture('npm', ['root', '-g'], cwd);
  if (r.status !== 0) return null;
  const line = firstLine(r.stdout);
  return line === '' ? null : line;
}

function resolveBinRealPath(): string | null {
  const argvBin = process.argv[1];
  if (!argvBin) return null;
  try {
    return realpathSync(argvBin);
  } catch {
    return null;
  }
}

/**
 * Runs the self-update check/install and, when a new version was installed,
 * re-execs the new binary once (env-guarded via SBL_SELF_UPDATED) and
 * returns its exit code. Returns null when the caller should fall through
 * to the normal refresh (no update available, offline, install failed, or
 * the update was skipped entirely).
 */
async function maybeSelfUpdate(
  cwd: string,
  args: ParsedArgs,
  override: SelfUpdateOverride,
): Promise<number | null> {
  const skip =
    args.values['no-self'] === true ||
    Boolean(process.env.SBL_SELF_UPDATED) ||
    Boolean(process.env.SBL_SKIP_UPDATE_CHECK);
  if (skip) return null;

  const binRealPath = override.binRealPath !== undefined ? override.binRealPath : resolveBinRealPath();
  const globalRoot = override.globalRoot !== undefined ? override.globalRoot : resolveGlobalRoot(cwd);
  const installKind = binRealPath === null ? 'unknown' : detectInstallKind(binRealPath, cwd, globalRoot);

  const fetchLatest = override.fetchLatest ?? (() => fetchLatestVersion(SELF_UPDATE_FETCH_TIMEOUT_MS));
  const npmInstallGlobal =
    override.npmInstallGlobal ?? ((spec: string) => runCapture('npm', ['i', '-g', spec], cwd));

  const result = await runSelfUpdate({
    installed: KIT_VERSION,
    fetchLatest,
    installKind,
    npmInstallGlobal,
    log: (line) => console.log(line),
    warn: (line) => console.warn(`warning: ${line}`),
  });

  if (result.kind !== 'updated') return null;

  // npm rewrites the global package's files in place, so process.argv[1]
  // still points at a valid path after the install -- re-resolve anyway in
  // case the realpath target moved (e.g. a version-pinned symlink).
  const updatedBinPath = override.binRealPath !== undefined ? override.binRealPath : resolveBinRealPath();
  if (updatedBinPath === null) return null; // can't re-exec without a bin path; fall through on the old version

  const spawnSelf =
    override.spawnSelf ??
    ((binPath: string, rArgs: string[], execCwd: string, env: NodeJS.ProcessEnv) => {
      const r = spawn.sync(process.execPath, [binPath, 'update', ...rArgs], {
        cwd: execCwd,
        stdio: 'inherit',
        env,
      });
      return { status: r.status ?? 1 };
    });
  const res = spawnSelf(updatedBinPath, args.positionals, cwd, {
    ...process.env,
    SBL_SELF_UPDATED: '1',
  });
  return res.status ?? 1;
}

const REFRESH_KINDS: ReadonlySet<Action['kind']> = new Set([
  'inject-agents-block',
  'write-claude-pointer',
  'copy-skills',
  'install-guard-hook',
]);

export function refreshActions(all: Action[]): Action[] {
  return all.filter((action) => REFRESH_KINDS.has(action.kind));
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/)[0] ?? '';
}

function guardHookInstalled(cwd: string): boolean {
  const gitDir = findGitDir(cwd);
  if (!gitDir) return false;
  const hookPath = join(gitDir, 'hooks', 'pre-commit');
  if (!existsSync(hookPath)) return false;
  return GUARD_RE.test(readFileSync(hookPath, 'utf8'));
}

export async function runUpdate(
  cwd: string,
  args: ParsedArgs,
  selfUpdateOverride: SelfUpdateOverride = {},
): Promise<number> {
  const selfUpdateExitCode = await maybeSelfUpdate(cwd, args, selfUpdateOverride);
  if (selfUpdateExitCode !== null) return selfUpdateExitCode;

  // Up-front detection-failure check (mirrors uninstall): refuse before mutating anything.
  for (const f of ['package.json', 'opencode.json']) {
    const p = join(cwd, f);
    if (!existsSync(p)) continue;
    try {
      validateJsonFile(p, f);
    } catch (err) {
      if (err instanceof InvalidJsonError) {
        console.error(`error: ${err.message}`);
        return 1;
      }
      throw err;
    }
  }
  const state: InitState = {
    cwd,
    detectedPm: detectPackageManager(cwd),
    hasBacklogConfig: existsSync(join(cwd, 'backlog', 'config.yml')),
    agentsExists: existsSync(join(cwd, 'AGENTS.md')),
    claudeMdExists: existsSync(join(cwd, 'CLAUDE.md')),
    opencodeConfig: undefined,
    pkgExists: existsSync(join(cwd, 'package.json')),
  };
  const projectName = basename(resolve(cwd));
  const opts: InitOptions = {
    projectName,
    harnesses: ['opencode', 'claude'],
    pm: 'auto',
    guard: guardHookInstalled(cwd),
    skipInstall: false,
  };

  const plan = planInit(state, opts, KIT_VERSION);
  const actions = refreshActions(plan.actions);
  const warnings = [...plan.warnings];

  try {
    const result = await executeActions(cwd, actions, {
      version: KIT_VERSION,
      projectName,
      hasBacklogConfig: state.hasBacklogConfig,
    });
    warnings.push(...result.warnings);
    console.log(
      `super-backlog update complete - refreshed ${actions.length} action(s), applied ${result.applied}, skipped ${result.skipped}`,
    );
  } catch (err) {
    if (err instanceof RefusalError) {
      console.error(`error: ${err.message}`);
      return 2;
    }
    if (err instanceof UpstreamError) {
      console.error(`error: upstream command failed: ${err.message}`);
      return 3;
    }
    throw err;
  }

  console.log('upstream versions:');
  const bin = resolveBacklogBin(cwd);
  if (bin === null) {
    warnings.push('backlog binary not found - local backlog.md version unavailable');
  } else {
    const local = runCapture(bin, ['--version'], cwd);
    if (local.status === 0) {
      console.log(`  backlog.md (local):    ${firstLine(local.stdout)}`);
    } else {
      warnings.push(`\`${bin} --version\` failed with exit code ${local.status}`);
    }
  }

  let published: string | null = null;
  try {
    // test seam: SBL_FORCE_OFFLINE makes e2e runs take the offline path deterministically
    if (process.env.SBL_FORCE_OFFLINE) throw new Error('forced offline');
    const view = runCapture('npm', ['view', 'backlog.md', 'version'], cwd);
    if (view.status === 0) published = firstLine(view.stdout);
  } catch {
    published = null;
  }
  if (published === null) {
    warnings.push('could not query the npm registry (offline?) - published version unavailable');
  } else {
    console.log(`  backlog.md (latest):   ${published}`);
  }

  for (const warning of warnings) console.log(`warning: ${warning}`);
  return warnings.length > 0 ? 4 : 0;
}
