// src/lib/version-check.ts
import { spawn as spawnNode, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';

export interface VersionCheckCache {
  checkedAt: string;
  latest: string;
}

export interface VersionCheckDeps {
  home: string;
  now: () => Date;
  /** Starts a cache refresh that outlives this process; must not block. */
  refresh: () => void;
  log: (line: string) => void;
  env: NodeJS.ProcessEnv;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;
// The refresh worker runs detached after the CLI has exited, so nobody waits on it.
const REFRESH_TIMEOUT_MS = 10000;

function cachePath(home: string): string {
  return join(home, '.super-backlog', 'version-check.json');
}

/** Triple-numeric semver compare; non-numeric parts are treated as not newer. */
export function isNewerVersion(latest: string, installed: string): boolean {
  const a = latest.split('.').slice(0, 3).map(Number);
  const b = installed.split('.').slice(0, 3).map(Number);
  if (a.length < 3 || b.length < 3) return false;
  if (a.some((n) => !Number.isFinite(n)) || b.some((n) => !Number.isFinite(n))) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return false;
}

function readCache(home: string): VersionCheckCache | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(cachePath(home), 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.checkedAt !== 'string' || typeof rec.latest !== 'string') return null;
    return { checkedAt: rec.checkedAt, latest: rec.latest };
  } catch {
    return null;
  }
}

function writeCache(home: string, cache: VersionCheckCache): void {
  mkdirSync(join(home, '.super-backlog'), { recursive: true });
  writeFileSync(cachePath(home), JSON.stringify(cache));
}

function isStale(checkedAt: string, now: Date): boolean {
  const t = Date.parse(checkedAt);
  if (Number.isNaN(t)) return true;
  const nowMs = now.getTime();
  if (t > nowMs) return true; // clock skew: a future checkedAt can never be trusted
  return nowMs - t > DAY_MS;
}

// child.stdout is typed as Readable, but the underlying pipe stream (a
// net.Socket on POSIX, a Pipe wrap on Windows) always exposes unref() at
// runtime; the DOM/Node stream typings just don't declare it.
function unrefStream(stream: Readable | null | undefined): void {
  (stream as unknown as { unref?: () => void } | null | undefined)?.unref?.();
}

export interface FetchLatestOptions {
  /**
   * Spawn npm without a console window. The detached refresh worker has no
   * console of its own, so on Windows npm.cmd would otherwise flash a new one.
   */
  windowsHide?: boolean;
}

/** Queries the npm registry for the latest published version, racing a timeout. */
export async function fetchLatestVersion(
  timeoutMs: number = FETCH_TIMEOUT_MS,
  { windowsHide = false }: FetchLatestOptions = {},
): Promise<string | null> {
  let child: ChildProcess | undefined;
  const work = new Promise<string | null>((resolvePromise) => {
    try {
      child = spawn('npm', ['view', 'super-backlog', 'version'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide,
      });
    } catch {
      resolvePromise(null);
      return;
    }
    let out = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    child.on('error', () => resolvePromise(null));
    child.on('close', (code) => {
      if (code !== 0) {
        resolvePromise(null);
        return;
      }
      const line = out.split(/\r?\n/).find((l) => l.trim() !== '');
      const v = line?.trim();
      resolvePromise(v === undefined || v === '' ? null : v);
    });
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<null>((resolveTimeout) => {
    timer = setTimeout(() => {
      timedOut = true;
      resolveTimeout(null);
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (timedOut && child) {
      // On Windows kill() only reaches the cmd.exe shim; the npm process it
      // started still holds the stdout pipe, so release our handles as well.
      child.kill();
      unrefStream(child.stdout);
      child.unref();
    }
  }
}

/** Fetches the latest version into the cache; a failed fetch leaves the cache as is. */
export async function refreshVersionCache(
  home: string,
  fetchLatest: () => Promise<string | null> = () => fetchLatestVersion(REFRESH_TIMEOUT_MS, { windowsHide: true }),
  now: () => Date = () => new Date(),
): Promise<void> {
  let latest: string | null;
  try {
    latest = await fetchLatest();
  } catch {
    return;
  }
  if (latest == null || latest === '') return;
  writeCache(home, { checkedAt: now().toISOString(), latest });
}

/**
 * Runs refreshVersionCache in a detached worker process so it outlives the
 * CLI. An in-process fetch never finished for short commands: the process
 * exited first, and on Windows the npm child was even killed along with it.
 */
export function spawnVersionRefresh(home: string): void {
  try {
    const worker = fileURLToPath(new URL('../version-refresh.js', import.meta.url));
    const child = spawnNode(process.execPath, [worker, home], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    // best-effort: the hint must never break the command
  }
}

export async function applyVersionHint(installed: string, deps: VersionCheckDeps): Promise<void> {
  if (deps.env.SBL_SKIP_UPDATE_CHECK) return;

  const cache = readCache(deps.home);
  if (cache && isNewerVersion(cache.latest, installed)) {
    deps.log(
      `super-backlog ${cache.latest} is available (installed ${installed}). Update: sbl update (or npm i -g super-backlog)`,
    );
  }

  if (!cache || isStale(cache.checkedAt, deps.now())) {
    try {
      deps.refresh();
    } catch {
      // best-effort, like spawnVersionRefresh itself
    }
  }
}
