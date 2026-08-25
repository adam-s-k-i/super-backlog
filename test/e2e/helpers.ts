// test/e2e/helpers.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

export const CLI_PATH = join(__dirname, '..', '..', 'dist', 'cli.js');

export function scaffoldProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-e2e-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo', version: '0.0.1' }));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

export function runCli(dir: string, args: string[]): string {
  return execFileSync(process.execPath, [CLI_PATH, ...args], {
    cwd: dir,
    env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    encoding: 'utf8',
  });
}

export function scaffoldAndInit(
  initArgs: string[] = ['init', '--pm', 'npm', '--guard', '--no-dashboard'],
): string {
  const dir = scaffoldProject();
  runCli(dir, initArgs);
  return dir;
}
