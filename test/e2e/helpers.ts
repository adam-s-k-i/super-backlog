// test/e2e/helpers.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

export const CLI_PATH = join(__dirname, '..', '..', 'dist', 'cli.js');

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
      env: { ...process.env, SBL_SKIP_INSTALL: '1' },
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
