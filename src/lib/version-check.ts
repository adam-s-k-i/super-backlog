// src/lib/version-check.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { runCapture } from './run.js';

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

function isNewer(latest: string, installed: string): boolean {
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
  return now.getTime() - t > DAY_MS;
}

export async function defaultFetchLatest(): Promise<string | null> {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const work = Promise.resolve().then(() => {
    const r = runCapture(npm, ['view', 'super-backlog', 'version'], process.cwd());
    if (r.status !== 0) return null;
    const line = r.stdout.split(/\r?\n/).find((l) => l.trim() !== '');
    if (!line) return null;
    const v = line.trim();
    return v === '' ? null : v;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), FETCH_TIMEOUT_MS);
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

export async function applyVersionHint(installed: string, deps: VersionCheckDeps): Promise<void> {
  if (deps.env.SBL_SKIP_UPDATE_CHECK) return;

  const cache = readCache(deps.home);
  if (cache && isNewer(cache.latest, installed)) {
    deps.log(
      `super-backlog ${cache.latest} is available (installed ${installed}). Update: npm i -g super-backlog`,
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
