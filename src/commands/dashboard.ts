import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { homedir as osHomedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { collectDashboardData } from '../dashboard/data.js';
import { startHubServer, type HubHandle } from '../dashboard/hub.js';
import { renderDashboard } from '../dashboard/render.js';
import { DASHBOARD_PORT } from '../dashboard/server.js';
import { atomicWrite } from '../lib/atomic.js';
import { clearHubState, isPidAlive, newHubToken, readHubState, writeHubState } from '../lib/hub-state.js';
import { projectSlug } from '../lib/slug.js';
import { KIT_VERSION } from '../lib/version.js';
import type { ParsedArgs } from './init.js';

export interface DashboardDeps {
  homedir?: () => string;
  startHub?: typeof startHubServer;
  attach?: (url: string, body: unknown) => Promise<{ status: number; json: unknown }>;
  openBrowser?: (url: string) => void;
  nowPid?: () => number;
}

async function regenerateInto(outPath: string, cwd: string): Promise<void> {
  const data = collectDashboardData(cwd, { kitVersion: KIT_VERSION });
  atomicWrite(outPath, renderDashboard(data));
}

function defaultOpenBrowser(url: string): void {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
        .on('error', () => {})
        .unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' })
        .on('error', () => {})
        .unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
        .on('error', () => {})
        .unref();
    }
  } catch {
  }
}

function defaultAttach(url: string, body: unknown): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = httpRequest(
      {
        host: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method: payload === undefined ? 'GET' : 'POST',
        headers:
          payload === undefined
            ? {}
            : {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              },
      },
      (res) => {
        let b = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          b += c;
        });
        res.on('end', () => {
          let json: unknown = b;
          try {
            json = JSON.parse(b);
          } catch {
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function isEaddrinuse(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'EADDRINUSE';
}

function waitForClose(hub: HubHandle): Promise<void> {
  return new Promise((resolve) => {
    hub.server.once('close', () => resolve());
  });
}

/**
 * Builds the hub shutdown routine: close the hub handle, then clear the
 * on-disk hub.json owned by `pid`. The returned function is idempotent --
 * calling it more than once (e.g. once from a signal handler, once from the
 * caller's own cleanup) only runs the underlying work once and every caller
 * observes the same result.
 */
export function createShutdown(hub: HubHandle, home: string, pid: number): () => Promise<void> {
  let done: Promise<void> | null = null;
  return function shutdown(): Promise<void> {
    if (done === null) {
      done = (async () => {
        await hub.close();
        clearHubState(home, pid);
      })();
    }
    return done;
  };
}

async function attachToHub(opts: {
  cwd: string;
  port: number;
  token: string;
  attach: (url: string, body: unknown) => Promise<{ status: number; json: unknown }>;
  openBrowser: (url: string) => void;
  noOpen: boolean;
}): Promise<number> {
  let res;
  try {
    res = await opts.attach(`http://127.0.0.1:${opts.port}/api/hub/register`, {
      cwd: opts.cwd,
      token: opts.token,
    });
  } catch (err) {
    console.error(`error: dashboard serve failed (${err instanceof Error ? err.message : String(err)})`);
    return 1;
  }

  if (res.status === 401) {
    console.error('error: hub token mismatch; stop the other hub or delete stale hub.json');
    return 1;
  }
  if (res.status === 409) {
    const json = res.json as { existingCwd?: string; incomingCwd?: string };
    console.error(
      `error: slug collision between ${json.existingCwd ?? ''} and ${json.incomingCwd ?? ''}; change project_name in one backlog/config.yml`,
    );
    return 1;
  }
  if (res.status !== 200) {
    console.error(`error: dashboard serve failed (register ${res.status})`);
    return 1;
  }
  const json = res.json as { ok?: boolean; url?: string };
  if (json.ok !== true || typeof json.url !== 'string') {
    console.error('error: dashboard serve failed (invalid register response)');
    return 1;
  }
  if (!opts.noOpen) opts.openBrowser(json.url);
  return 0;
}

export async function runDashboard(cwd: string, args: ParsedArgs, deps: DashboardDeps = {}): Promise<number> {
  const values = args.values;

  let port = DASHBOARD_PORT;
  if (values['port'] !== undefined) {
    const parsed = Number(values['port']);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
      console.error(`error: invalid --port "${String(values['port'])}" (expected 0-65535)`);
      return 1;
    }
    port = parsed;
  }

  const noOpen = values['no-open'] === true;
  const home = (deps.homedir ?? osHomedir)();
  const startHub = deps.startHub ?? startHubServer;
  const attach = deps.attach ?? defaultAttach;
  const openBrowser = deps.openBrowser ?? defaultOpenBrowser;
  const pid = (deps.nowPid ?? ((): number => process.pid))();

  let slugResult;
  try {
    slugResult = projectSlug(cwd);
  } catch {
    console.error('error: set project_name in backlog/config.yml');
    return 1;
  }
  if (!slugResult.ok) {
    console.error('error: set project_name in backlog/config.yml');
    return 1;
  }
  const slug = slugResult.slug;

  const state = readHubState(home);
  if (state !== null && isPidAlive(state.pid)) {
    try {
      const status = await attach(
        `http://127.0.0.1:${state.port}/api/hub/status?token=${encodeURIComponent(state.token)}`,
        undefined,
      );
      if (status.status === 200) {
        if (values['port'] !== undefined && port !== state.port) {
          console.error(`error: a hub is already running on ${state.port}`);
          return 1;
        }
        return await attachToHub({
          cwd,
          port: state.port,
          token: state.token,
          attach,
          openBrowser,
          noOpen,
        });
      }
    } catch {
    }
  }

  if (values['port'] !== undefined) {
    console.warn('warning: default bookmarks (:6428) will miss this hub');
  }

  const token = newHubToken();
  const outPath = join(tmpdir(), `sbl-dashboard-${Date.now()}-${slug}.html`);
  const regenerate = (): Promise<void> => regenerateInto(outPath, cwd);

  let hub: HubHandle;
  try {
    await regenerate();
    hub = await startHub({ port, token });
  } catch (err) {
    if (isEaddrinuse(err)) {
      console.error(`error: port ${port} is in use`);
      console.error('hint: pass --port as emergency only');
      return 1;
    }
    console.error(`error: dashboard serve failed (${err instanceof Error ? err.message : String(err)})`);
    return 1;
  }

  writeHubState(home, { pid, port: hub.port, token });
  const result = hub.register({ cwd, file: outPath, regenerate });
  if (!result.ok) {
    await hub.close();
    clearHubState(home, pid);
    if (result.code === 409) {
      console.error(
        `error: slug collision between ${result.existingCwd} and ${result.incomingCwd}; change project_name in one backlog/config.yml`,
      );
      return 1;
    }
    console.error(`error: dashboard serve failed (${result.message})`);
    return 1;
  }

  console.log(`dashboard written: ${outPath}`);
  console.log(`serving dashboard at ${result.url} (press Ctrl+C to stop)`);

  if (!noOpen) openBrowser(result.url);

  const shutdown = createShutdown(hub, home, pid);
  const onSignal = (): void => {
    void shutdown();
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    await waitForClose(hub);
    return 0;
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    await shutdown();
  }
}
