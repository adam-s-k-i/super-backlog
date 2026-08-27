// src/lib/preflight.ts
// Check -> Fix -> Verify units that repair a broken super-backlog environment.
// System-changing fixes (node install, execution policy) require consent or fixAll;
// safe fixes run unconditionally. Every fix is verified and reports a manual
// fallback command on failure.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import process from 'node:process';

import {
  getEffectiveExecutionPolicy,
  isBlockingExecutionPolicy,
  type Executor,
} from './powershell.js';
import { resolveBacklogBin } from './run.js';

export type UnitStatus = 'ok' | 'fixed' | 'failed' | 'skipped' | 'needs-manual';

export interface UnitReport {
  id: string;
  status: UnitStatus;
  detail: string;
  manualCommand?: string;
}

export interface PreflightDeps {
  platform?: string;
  getNodeVersion?: () => string | null;
  getPolicy?: () => string | null;
  lookupCommand?: (name: string) => string | null;
  setEnv?: (name: string, value: string) => void;
  getEnv?: (name: string) => string | null;
  resolveBacklog?: (cwd: string) => string | null;
  exists?: (path: string) => boolean;
  executor?: Executor;
  log?: (line: string) => void;
  /** Consent callback for system-changing fixes. Return true to allow. */
  confirm?: (question: string) => boolean;
  /** Run system-changing fixes without asking. */
  fixAll?: boolean;
  /** Restrict the run to these unit ids (default: all units). */
  units?: string[];
}

export interface PreflightResult {
  reports: UnitReport[];
  ok: boolean;
}

const defaultExecutor: Executor = (cmd, args) => {
  // shell on win32 — .cmd/.ps1 shims (npm.cmd etc.) are not directly executable.
  // Safe only because callers pass constant args; never pass user input here.
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  if (r.error) return { status: null, stdout: '', stderr: String(r.error.message) };
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

interface Ctx {
  platform: string;
  cwd: string;
  executor: Executor;
  getNodeVersion: () => string | null;
  getPolicy: () => string | null;
  lookupCommand: (name: string) => string | null;
  setEnv: (name: string, value: string) => void;
  getEnv: (name: string) => string | null;
  resolveBacklog: (cwd: string) => string | null;
  exists: (path: string) => boolean;
  log: (line: string) => void;
  confirm?: (question: string) => boolean;
  fixAll: boolean;
  npmCmd: string;
}

function parseMajor(version: string | null): number | null {
  if (version === null) return null;
  const major = Number(version.replace(/^v/, '').split('.')[0]);
  return Number.isNaN(major) ? null : major;
}

function allowed(ctx: Ctx, question: string): boolean {
  if (ctx.fixAll) return true;
  return ctx.confirm?.(question) === true;
}

function checkNodeVersion(ctx: Ctx): UnitReport {
  const id = 'node-version';
  const version = ctx.getNodeVersion();
  const major = parseMajor(version);
  if (major !== null && major >= 20) {
    return { id, status: 'ok', detail: `node v${version} (>= 20)` };
  }
  const installArgs =
    ctx.platform === 'win32'
      ? { cmd: 'winget', args: ['install', '-e', '--id', 'OpenJS.NodeJS', '--accept-source-agreements', '--accept-package-agreements'] }
      : { cmd: 'brew', args: ['install', 'node'] };
  const manual = `${installArgs.cmd} ${installArgs.args.join(' ')}`;
  if (!allowed(ctx, `Node.js >= 20 is required (found ${version ?? 'none'}). Install it now?`)) {
    return { id, status: 'needs-manual', detail: `node ${version ?? 'not found'} is too old or missing`, manualCommand: manual };
  }
  const r = ctx.executor(installArgs.cmd, installArgs.args);
  if (r.status !== 0) {
    return { id, status: 'failed', detail: `node install failed: ${r.stderr.trim() || 'unknown error'}`, manualCommand: manual };
  }
  const after = parseMajor(ctx.getNodeVersion());
  if (after !== null && after >= 20) {
    return { id, status: 'fixed', detail: 'node installed via package manager' };
  }
  return {
    id,
    status: 'failed',
    detail: 'node still not >= 20 after install (open a new terminal and retry)',
    manualCommand: 'install Node.js >= 20 manually: https://nodejs.org/en/download/',
  };
}

function checkExecutionPolicy(ctx: Ctx): UnitReport {
  const id = 'execution-policy';
  if (ctx.platform !== 'win32') {
    return { id, status: 'skipped', detail: 'not Windows' };
  }
  const policy = ctx.getPolicy();
  if (policy === null) {
    return { id, status: 'skipped', detail: 'policy not detectable' };
  }
  if (!isBlockingExecutionPolicy(policy)) {
    return { id, status: 'ok', detail: `execution policy: ${policy}` };
  }
  const manual = 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned';
  if (!allowed(ctx, `PowerShell execution policy "${policy}" blocks npm/npx/sbl shims. Set CurrentUser to RemoteSigned?`)) {
    return { id, status: 'needs-manual', detail: `PowerShell execution policy "${policy}" blocks .ps1 shims`, manualCommand: manual };
  }
  const r = ctx.executor('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `${manual} -Force`,
  ]);
  if (r.status !== 0) {
    return { id, status: 'failed', detail: `Set-ExecutionPolicy failed: ${r.stderr.trim() || 'unknown error'}`, manualCommand: manual };
  }
  const after = ctx.getPolicy();
  if (!isBlockingExecutionPolicy(after)) {
    return { id, status: 'fixed', detail: 'execution policy set to RemoteSigned (CurrentUser)' };
  }
  return { id, status: 'failed', detail: `policy still "${after ?? 'unknown'}" after fix`, manualCommand: manual };
}

function checkNpmCommand(ctx: Ctx): UnitReport {
  const id = 'npm-command';
  const probe = ctx.executor('npm', ['--version']);
  if (probe.status === 0) {
    ctx.npmCmd = 'npm';
    return { id, status: 'ok', detail: `npm ${probe.stdout.trim()}` };
  }
  if (ctx.platform === 'win32') {
    const fallback = ctx.executor('npm.cmd', ['--version']);
    if (fallback.status === 0) {
      ctx.npmCmd = 'npm.cmd';
      return { id, status: 'fixed', detail: 'npm not directly callable; using npm.cmd shim' };
    }
  }
  return {
    id,
    status: 'failed',
    detail: 'npm is not callable',
    manualCommand: 'reinstall Node.js (bundles npm): https://nodejs.org/en/download/',
  };
}

function checkPartialInstall(ctx: Ctx): UnitReport {
  const id = 'partial-install';
  const pkgJson = join(ctx.cwd, 'package.json');
  if (!ctx.exists(pkgJson)) {
    return { id, status: 'skipped', detail: 'no package.json (init installs upstream itself)' };
  }
  const pkgDir = join(ctx.cwd, 'node_modules', 'super-backlog');
  const shim = join(ctx.cwd, 'node_modules', '.bin', ctx.platform === 'win32' ? 'sbl.cmd' : 'sbl');
  if (!ctx.exists(pkgDir) || ctx.exists(shim)) {
    return { id, status: 'ok', detail: 'local install consistent (or absent)' };
  }
  const r = ctx.executor(ctx.npmCmd, ['install']);
  if (r.status !== 0) {
    return { id, status: 'failed', detail: `npm install failed: ${r.stderr.trim() || 'unknown error'}`, manualCommand: 'npm install' };
  }
  if (ctx.exists(shim)) {
    return { id, status: 'fixed', detail: 'repaired partial install (missing .bin shim restored)' };
  }
  return { id, status: 'failed', detail: 'partial install persists after npm install', manualCommand: 'npm install' };
}

function checkBacklogBin(ctx: Ctx): UnitReport {
  const id = 'backlog-bin';
  if (!ctx.exists(join(ctx.cwd, 'package.json'))) {
    return { id, status: 'skipped', detail: 'no package.json (init installs upstream itself)' };
  }
  const found = ctx.resolveBacklog(ctx.cwd);
  if (found !== null) {
    return { id, status: 'ok', detail: `backlog CLI at ${found}` };
  }
  const r = ctx.executor(ctx.npmCmd, ['install']);
  if (r.status !== 0) {
    return { id, status: 'failed', detail: `npm install failed: ${r.stderr.trim() || 'unknown error'}`, manualCommand: 'npm install' };
  }
  const after = ctx.resolveBacklog(ctx.cwd);
  if (after !== null) {
    return { id, status: 'fixed', detail: 'backlog CLI restored via npm install' };
  }
  return { id, status: 'failed', detail: 'backlog CLI still not resolvable after npm install', manualCommand: 'npm install' };
}

function checkSblOnPath(ctx: Ctx): UnitReport {
  const id = 'sbl-on-path';
  if (ctx.lookupCommand('sbl') !== null) {
    return { id, status: 'ok', detail: 'sbl resolvable on PATH' };
  }
  const binProbe = ctx.executor(ctx.npmCmd, ['bin', '-g']);
  if (binProbe.status !== 0 || binProbe.stdout.trim() === '') {
    return {
      id,
      status: 'failed',
      detail: 'sbl not on PATH and npm global bin directory could not be determined',
      manualCommand: 'run "npm bin -g", add the printed directory to your PATH, open a new terminal',
    };
  }
  const binDir = binProbe.stdout.trim().split(/\r?\n/)[0];
  const current = ctx.getEnv('PATH') ?? '';
  ctx.setEnv('PATH', current === '' ? binDir : `${binDir}${delimiter}${current}`);
  if (ctx.lookupCommand('sbl') !== null) {
    return { id, status: 'fixed', detail: `session PATH refreshed with ${binDir}` };
  }
  return {
    id,
    status: 'failed',
    detail: `sbl still not resolvable after adding ${binDir} to the session PATH`,
    manualCommand: `add "${binDir}" to your user PATH permanently and open a new terminal`,
  };
}

export function runPreflight(cwd: string, deps: PreflightDeps = {}): PreflightResult {
  const platform = deps.platform ?? process.platform;
  const executor = deps.executor ?? defaultExecutor;
  const ctx: Ctx = {
    platform,
    cwd,
    executor,
    getNodeVersion: deps.getNodeVersion ?? (() => process.versions.node),
    getPolicy:
      deps.getPolicy ??
      (() => getEffectiveExecutionPolicy({ platform, executor })),
    lookupCommand:
      deps.lookupCommand ??
      ((name: string) => {
        const probe = executor(platform === 'win32' ? 'where' : 'which', [name]);
        if (probe.status !== 0) return null;
        const first = probe.stdout.split(/\r?\n/).find(Boolean);
        if (!first) return null;
        return first.trim().replace(/\.ps1$/i, '.cmd');
      }),
    setEnv: deps.setEnv ?? ((name, value) => { process.env[name] = value; }),
    getEnv: deps.getEnv ?? ((name) => process.env[name] ?? null),
    resolveBacklog: deps.resolveBacklog ?? resolveBacklogBin,
    exists: deps.exists ?? existsSync,
    log: deps.log ?? ((line: string) => console.log(line)),
    confirm: deps.confirm,
    fixAll: deps.fixAll ?? false,
    npmCmd: platform === 'win32' ? 'npm.cmd' : 'npm',
  };

  const unitNames: Array<[string, (ctx: Ctx) => UnitReport]> = [
    ['node-version', checkNodeVersion],
    ['execution-policy', checkExecutionPolicy],
    ['npm-command', checkNpmCommand],
    ['partial-install', checkPartialInstall],
    ['backlog-bin', checkBacklogBin],
    ['sbl-on-path', checkSblOnPath],
  ];
  const units = deps.units === undefined
    ? unitNames.map(([, fn]) => fn)
    : unitNames.filter(([name]) => deps.units!.includes(name)).map(([, fn]) => fn);

  const reports: UnitReport[] = [];
  for (const unit of units) {
    const report = unit(ctx);
    reports.push(report);
    ctx.log(`[${report.status}] ${report.id}: ${report.detail}`);
    if (report.manualCommand !== undefined && report.status !== 'ok') {
      ctx.log(`       manual: ${report.manualCommand}`);
    }
  }
  const ok = reports.every((r) => r.status === 'ok' || r.status === 'fixed' || r.status === 'skipped');
  return { reports, ok };
}
