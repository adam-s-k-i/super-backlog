import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import spawn from 'cross-spawn';

export interface RunResult { status: number; stdout: string; stderr: string; }

export function runCapture(cmd: string, args: string[], cwd: string): RunResult {
  const r = spawn.sync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.error && (r.status === null || r.status === undefined)) {
    return { status: 127, stdout: '', stderr: String(r.error.message) };
  }
  return {
    status: r.status ?? 1,
    stdout: (r.stdout ?? '').toString(),
    stderr: (r.stderr ?? '').toString(),
  };
}

const EXT = process.platform === 'win32' ? '.cmd' : '';

export function resolveBacklogBin(cwd: string): string | null {
  const local = join(cwd, 'node_modules', '.bin', `backlog${EXT}`);
  if (existsSync(local)) return local;
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const w = runCapture(probe, ['backlog'], cwd);
  if (w.status === 0) {
    const first = w.stdout.split(/\r?\n/).find(Boolean);
    if (first) return first.trim().replace(/\.ps1$/i, '.cmd');
  }
  return null;
}
