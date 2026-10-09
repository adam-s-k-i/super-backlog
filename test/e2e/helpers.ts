// test/e2e/helpers.ts
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import process from 'node:process';

export const CLI_PATH = join(__dirname, '..', '..', 'dist', 'bin.js');

export interface CliResult {
  out: string;
  status: number;
}

export function scaffoldProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-e2e-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo', version: '0.0.1' }));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

export function runCliResult(dir: string, args: string[]): CliResult {
  try {
    const out = execFileSync(process.execPath, [CLI_PATH, ...args], {
      cwd: dir,
      env: { ...process.env, SBL_SKIP_INSTALL: '1', SBL_SKIP_UPDATE_CHECK: '1' },
      encoding: 'utf8',
    });
    return { out, status: 0 };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string | Buffer };
    const stdout = e.stdout ?? '';
    return {
      out: typeof stdout === 'string' ? stdout : stdout.toString('utf8'),
      status: e.status ?? -1,
    };
  }
}

export function runCli(dir: string, args: string[]): string {
  return runCliResult(dir, args).out;
}

export function scaffoldAndInit(
  initArgs: string[] = ['init', '--pm', 'npm', '--guard'],
): string {
  const dir = scaffoldProject();
  // init finishes as success-with-warnings (exit 4): the claude plugin install is printed, not run
  const res = runCliResult(dir, initArgs);
  if (res.status !== 0 && res.status !== 4) {
    throw new Error(`init failed with status ${res.status}:\n${res.out}`);
  }
  return dir;
}

const FAKE_NPM_SCRIPT = `import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2).join(' ');
if (process.env.FAKE_NPM_LOG) appendFileSync(process.env.FAKE_NPM_LOG, args + '\\n');
setTimeout(() => {
  if (args === 'view super-backlog version') console.log(process.env.FAKE_NPM_VERSION ?? '9.9.9');
  else if (args === 'view backlog.md version') console.log('9.9.9-fake');
  else process.exitCode = 1;
}, Number(process.env.FAKE_NPM_DELAY_MS ?? 0));
`;

/**
 * Writes a fake `npm` (npm.cmd on Windows) into a fresh temp dir and returns
 * an env with that dir first on PATH, so spawned code never reaches the real
 * registry or runs a real install. Behavior is steered via FAKE_NPM_VERSION,
 * FAKE_NPM_DELAY_MS and FAKE_NPM_LOG (one line of args per invocation).
 */
export function fakeNpmEnv(extra: NodeJS.ProcessEnv = {}): { dir: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-fake-npm-'));
  const script = join(dir, 'fake-npm.mjs');
  writeFileSync(script, FAKE_NPM_SCRIPT);
  if (process.platform === 'win32') {
    writeFileSync(join(dir, 'npm.cmd'), `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
  } else {
    const bin = join(dir, 'npm');
    writeFileSync(bin, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
    chmodSync(bin, 0o755);
  }
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Windows env keys are case-insensitive but a spread copy is not: drop every
  // PATH spelling so the child sees exactly one.
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const original = env[pathKey] ?? '';
  for (const k of Object.keys(env)) if (k.toUpperCase() === 'PATH') delete env[k];
  env[pathKey] = `${dir}${delimiter}${original}`;
  return { dir, env: { ...env, ...extra } };
}
