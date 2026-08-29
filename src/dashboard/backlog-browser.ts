// src/dashboard/backlog-browser.ts
import { request } from 'node:http';
import { createServer } from 'node:net';
import crossSpawn from 'cross-spawn';

import { resolveBacklogBin } from '../lib/run.js';

/** Minimal child surface the manager needs; satisfied by ChildProcess and test fakes. */
export interface BrowserChild {
  pid?: number;
  exitCode: number | null;
  kill(): void;
  on(event: 'error', cb: (err: Error) => void): void;
}

export interface BrowserManagerDeps {
  resolveBin?: (cwd: string) => string | null;
  spawnFn?: (bin: string, args: string[], cwd: string) => BrowserChild;
  getFreePort?: () => Promise<number>;
  /** Single readiness attempt against the browser url; polled until timeout. */
  probe?: (url: string) => Promise<boolean>;
  timeoutMs?: number;
  intervalMs?: number;
}

export type EnsureResult =
  | { ok: true; url: string }
  | { ok: false; code: 500 | 503; message: string };

export interface BrowserManager {
  ensure(): Promise<EnsureResult>;
  close(): void;
}

function defaultSpawn(bin: string, args: string[], cwd: string): BrowserChild {
  const child = crossSpawn(bin, args, { cwd, stdio: 'ignore' });
  return child as unknown as BrowserChild;
}

function defaultGetFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = addr !== null && typeof addr === 'object' ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function defaultProbe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const r = request(url, { method: 'GET' }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });
    r.on('error', () => resolve(false));
    r.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Manages one `backlog browser` process for one project cwd. */
export function createBrowserManager(cwd: string, deps: BrowserManagerDeps = {}): BrowserManager {
  const resolveBin = deps.resolveBin ?? resolveBacklogBin;
  const spawnFn = deps.spawnFn ?? defaultSpawn;
  const getFreePort = deps.getFreePort ?? defaultGetFreePort;
  const probe = deps.probe ?? defaultProbe;
  const timeoutMs = deps.timeoutMs ?? 10_000;
  const intervalMs = deps.intervalMs ?? 200;

  let child: BrowserChild | null = null;
  let url = '';
  let starting: Promise<EnsureResult> | null = null;

  function alive(): boolean {
    return child !== null && child.exitCode === null;
  }

  async function start(): Promise<EnsureResult> {
    const bin = resolveBin(cwd);
    if (!bin) return { ok: false, code: 503, message: 'backlog cli not found' };

    let port: number;
    try {
      port = await getFreePort();
    } catch {
      return { ok: false, code: 500, message: 'no free port for the backlog browser' };
    }
    url = `http://127.0.0.1:${port}/`;
    const spawned = spawnFn(bin, ['browser', '--port', String(port), '--no-open'], cwd);
    let spawnFailed = false;
    spawned.on('error', () => {
      spawnFailed = true;
      if (child === spawned) child = null;
    });
    child = spawned;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (spawnFailed || spawned.exitCode !== null) break;
      if (await probe(url)) return { ok: true, url };
      await sleep(intervalMs);
    }
    spawned.kill();
    if (child === spawned) child = null;
    return { ok: false, code: 500, message: 'backlog browser did not start' };
  }

  return {
    ensure(): Promise<EnsureResult> {
      if (alive() && url !== '') return Promise.resolve({ ok: true, url });
      if (starting === null) {
        starting = start().finally(() => {
          starting = null;
        });
      }
      return starting;
    },
    close(): void {
      if (alive()) child?.kill();
      child = null;
    },
  };
}
