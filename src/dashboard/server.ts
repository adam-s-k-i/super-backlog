// src/dashboard/server.ts
import { spawn } from 'node:child_process';
import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isAbsolute, join } from 'node:path';
import process from 'node:process';

import { createModelApiHandler } from '../models/dashboard-api.js';
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
    if (req.method !== 'POST' || req.url !== '/api/run') {
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
      const child = spawn(bin, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32',
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

function createApiHandler(cwd: string): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const modelApi = createModelApiHandler();
  const runApi = createRunApiHandler(cwd);
  return async (req, res) => {
    if (req.url === '/api/run') {
      await runApi(req, res);
      return;
    }
    await modelApi(req, res);
  };
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
 * Serve the latest dashboard bytes; changes inside <cwd>/backlog trigger
 * `regenerate()` debounced by 300ms. Pass port 0 for an ephemeral port (tests).
 */
export async function startServeServer(
  cwd: string,
  opts: ServeOptions = {},
): Promise<ServeHandle> {
  const file = opts.file ?? 'dashboard.html';
  const filePath = isAbsolute(file) ? file : join(cwd, file);
  const regenerate = opts.regenerate;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const debouncedRegenerate = (): void => {
    if (!regenerate) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void Promise.resolve()
        .then(regenerate)
        .catch(() => {}); // regeneration failures never kill the server
    }, 300);
  };

  let watcher: FSWatcher | null = null;
  const backlogDir = join(cwd, 'backlog');
  if (recursiveWatchSupported(process.platform, process.versions.node)) {
    try {
      // recursive so subdirectory writes (e.g. backlog/tasks/*.md) fire on every platform
      watcher = watch(backlogDir, { persistent: true, recursive: true }, debouncedRegenerate);
      watcher.on('error', () => {}); // e.g. watched dir removed mid-session
    } catch {
      watcher = null; // no backlog dir -> no live reload; serving still works
    }
  } else {
    console.warn(
      'warning: live reload is disabled because Node 24+ on Windows cannot reliably watch directories recursively (libuv fs-event bug); use Node 22 or Linux/macOS for --serve',
    );
  }

  const apiHandler = createApiHandler(cwd);

  const server: Server = createServer((req, res) => {
    if (req.url?.startsWith('/api/')) {
      void apiHandler(req, res);
      return;
    }

    const url = req.url ?? '/';
    const method = req.method ?? 'GET';
    if (method !== 'GET' || !(url === '/' || url === '/index.html')) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    readFile(filePath)
      .then((bytes) => {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(bytes);
      })
      .catch(() => {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('dashboard not generated yet');
      });
  });

  const requestedPort = opts.port ?? DASHBOARD_PORT;
  const port = await new Promise<number>((resolvePort, rejectPort) => {
    server.once('error', rejectPort);
    server.listen(requestedPort, '127.0.0.1', () => {
      const addr = server.address();
      if (addr !== null && typeof addr === 'object') resolvePort(addr.port);
      else resolvePort(requestedPort);
    });
  });

  if (opts.openBrowser) openInBrowser(`http://127.0.0.1:${port}/`);

  return {
    server,
    port,
    close(): Promise<void> {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      watcher?.close();
      watcher = null;
      return new Promise((resolveClose) => {
        server.close(() => resolveClose());
      });
    },
  };
}
