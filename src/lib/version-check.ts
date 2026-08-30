// src/lib/version-check.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import type { Readable } from 'node:stream';
import spawn from 'cross-spawn';

export interface VersionCheckCache {
  checkedAt: string;
  latest: string;
}

export interface VersionCheckDeps {
  home: string;
  now: () => Date;
  fetchLatest: () => Promise<string | null>;
  log: (line: string) => void;
  env: NodeJS.ProcessEnv;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;

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

/** Queries the npm registry for the latest published version, racing a timeout. */
export async function fetchLatestVersion(timeoutMs: number = FETCH_TIMEOUT_MS): Promise<string | null> {
  const work = new Promise<string | null>((resolvePromise) => {
    let child;
    try {
      child = spawn('npm', ['view', 'super-backlog', 'version'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      resolvePromise(null);
      return;
    }
    let out = '';
    unrefStream(child.stdout);
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
    child.unref();
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolveTimeout) => {
    timer = setTimeout(() => resolveTimeout(null), timeoutMs);
    timer.unref();
  });
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function defaultFetchLatest(): Promise<string | null> {
  return fetchLatestVersion(FETCH_TIMEOUT_MS);
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
    void deps
      .fetchLatest()
      .then((latest) => {
        if (latest == null || latest === '') return;
        writeCache(deps.home, { checkedAt: deps.now().toISOString(), latest });
      })
      .catch(() => {});
  }
}
