import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import spawn from 'cross-spawn';

export const RUN_CAPTURE_MAX_BUFFER = 64 * 1024 * 1024; // git ls-files -z for ~50k paths fits with a wide margin

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
  /** spawn error code, e.g. 'ENOENT' or 'ENOBUFS' */
  errorCode?: string;
}

export function runCapture(cmd: string, args: string[], cwd: string, opts: { maxBuffer?: number } = {}): RunResult {
  const r = spawn.sync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: opts.maxBuffer ?? RUN_CAPTURE_MAX_BUFFER });
  const errorCode = (r.error as NodeJS.ErrnoException | undefined)?.code;
  if (r.error && (r.status === null || r.status === undefined || errorCode === 'ENOBUFS')) {
    return { status: 127, stdout: '', stderr: String(r.error.message), ...(errorCode ? { errorCode } : {}) };
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
