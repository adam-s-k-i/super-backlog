// src/lib/powershell.ts
import { spawnSync } from 'node:child_process';
import process from 'node:process';

export interface ExecutorResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type Executor = (cmd: string, args: string[]) => ExecutorResult;

const defaultExecutor: Executor = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true });
  if (r.error) return { status: null, stdout: '', stderr: String(r.error.message) };
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

export interface PolicyDeps {
  platform?: string;
  executor?: Executor;
  /** Testing seam, mirrors SBL_FAKE_POLICY: non-empty value overrides detection. */
  fakePolicy?: string;
}

export function getEffectiveExecutionPolicy(deps: PolicyDeps = {}): string | null {
  const fake = (deps.fakePolicy ?? process.env.SBL_FAKE_POLICY)?.trim();
  if (fake) return fake;
  const platform = deps.platform ?? process.platform;
  if (platform !== 'win32') return null;
  const executor = deps.executor ?? defaultExecutor;
  const r = executor('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Get-ExecutionPolicy',
  ]);
  if ((r.status === null || r.status !== 0)) return null;
  const policy = r.stdout.trim();
  if (policy === '') return null;
  return policy;
}

export function isBlockingExecutionPolicy(policy: string | null | undefined): boolean {
  if (!policy) return false;
  const normalized = policy.trim().toLowerCase();
  return normalized === 'restricted' || normalized === 'allsigned';
}

export function policyWarningLines(policy: string): string[] {
  return [
    `warning: PowerShell execution policy "${policy}" blocks direct npx/npm/sbl calls in PowerShell (.ps1 shims are not loadable)`,
    '  fix: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   (one-time, no admin needed)',
    '  alt: call the .cmd shims explicitly (npx.cmd super-backlog init) or run from cmd.exe',
    '  note: npm scripts like "npm run board" are unaffected (they execute via cmd.exe)',
  ];
}
