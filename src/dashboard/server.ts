// src/dashboard/server.ts
import { spawn } from 'node:child_process';
import { type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isAbsolute, join } from 'node:path';
import process from 'node:process';
import crossSpawn from 'cross-spawn';

import { resolveBacklogBin } from '../lib/run.js';

export const DASHBOARD_PORT = 6428;

const WHITELIST = new Map<string, string[]>([
  ['browser', ['browser']],
  ['board', ['board']],
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Safe /api/run handler: only whitelisted backlog subcommands may be spawned. */
export function createRunApiHandler(cwd: string): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (req.url !== '/api/run') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }

    let body: string;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'failed to read body' }));
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid json' }));
      return;
    }

    if (!isRecord(payload) || typeof payload.command !== 'string' || !WHITELIST.has(payload.command)) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown command' }));
      return;
    }

    const bin = resolveBacklogBin(cwd);
    if (!bin) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'backlog cli not found' }));
      return;
    }

    const args = WHITELIST.get(payload.command)!;
    try {
      const child = crossSpawn(bin, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
      });
      child.on('error', () => {});
      child.unref();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  };
}

/** SSE broker: keeps a set of response objects and broadcasts named events. */
export function createReloadBroker(): {
  handler: (req: IncomingMessage, res: ServerResponse) => boolean;
  broadcast: (event: string) => void;
  clientCount: () => number;
  close: () => void;
} {
  const clients = new Set<ServerResponse>();
  let closed = false;

  function handler(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.url !== '/api/events' || req.method !== 'GET') return false;

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(':ok\n\n');
    clients.add(res);
    const cleanup = (): void => {
      clients.delete(res);
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    return true;
  }

  function broadcast(event: string): void {
    if (closed) return;
    // A data line is mandatory: per the HTML standard, EventSource never
    // dispatches an event whose data buffer is empty, so `event: x\n\n`
    // alone would silently never reach addEventListener('x', ...) clients.
    const message = `event: ${event}\ndata: {}\n\n`;
    for (const client of clients) {
      try {
        client.write(message);
      } catch {
        clients.delete(client);
      }
    }
  }

  function clientCount(): number {
    return clients.size;
  }

  function close(): void {
    if (closed) return;
    closed = true;
    for (const client of clients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    clients.clear();
  }

  return { handler, broadcast, clientCount, close };
}

/** Debounced wrapper around a regenerate callback; on success invokes onReload. */
export function createDebouncedReloader(
  regenerate: (() => void | Promise<void>) | undefined,
  onReload: () => void,
  delayMs: number,
): { trigger(): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function trigger(): void {
    if (!regenerate) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void Promise.resolve()
        .then(regenerate)
        .then(() => {
          onReload();
        })
        .catch(() => {});
    }, delayMs);
  }

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { trigger, cancel };
}

export function recursiveWatchSupported(platform: string, nodeVersion: string): boolean {
  // Node 24 on Windows triggers a libuv assertion in recursive fs.watch:
  // https://github.com/nodejs/node/issues/xxx (fs-event.c line 72)
  const major = Number(nodeVersion.split('.')[0]);
  return !(platform === 'win32' && !Number.isNaN(major) && major >= 24);
}

export interface ServeOptions {
  port?: number;
  regenerate?: () => void | Promise<void>;
  openBrowser?: boolean;
  /** File name served under cwd (absolute paths allowed); defaults to dashboard.html. */
  file?: string;
}

export interface ServeHandle {
  server: Server;
  port: number;
  close(): Promise<void>;
}

function openInBrowser(url: string): void {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
        .on('error', () => {}) // async ENOENT must not become an uncaught throw
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
    // best-effort only; a missing opener must never crash the server
  }
}

/**
 * Serve the latest dashboard bytes via the hub at `/p/<slug>/`.
 * Pass port 0 for an ephemeral port (tests).
 */
export async function startServeServer(
  cwd: string,
  opts: ServeOptions = {},
): Promise<ServeHandle> {
  const { startHubServer } = await import('./hub.js');
  const file = opts.file ?? 'dashboard.html';
  const filePath = isAbsolute(file) ? file : join(cwd, file);
  const hub = await startHubServer({ port: opts.port ?? DASHBOARD_PORT, token: 'serve' });
  const result = hub.register({
    cwd,
    file: filePath,
    regenerate: opts.regenerate ?? ((): void => {}),
  });
  if (!result.ok) {
    await hub.close();
    const message = result.code === 400 ? result.message : `register failed (${result.code})`;
    throw new Error(message);
  }
  if (opts.openBrowser) openInBrowser(result.url);
  return {
    server: hub.server,
    port: hub.port,
    close(): Promise<void> {
      return hub.close();
    },
  };
}
