// src/dashboard/server.ts
import { spawn } from 'node:child_process';
import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { isAbsolute, join } from 'node:path';
import process from 'node:process';

export const DASHBOARD_PORT = 6428;

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
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
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
  try {
    watcher = watch(join(cwd, 'backlog'), { persistent: true }, debouncedRegenerate);
    watcher.on('error', () => {}); // e.g. watched dir removed mid-session
  } catch {
    watcher = null; // no backlog dir -> no live reload; serving still works
  }

  const server: Server = createServer((req, res) => {
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
