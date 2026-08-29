import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { collectDashboardData } from './data.js';
import { renderDashboard } from './render.js';
import {
  createDebouncedReloader,
  createReloadBroker,
  createRunApiHandler,
  DASHBOARD_PORT,
  recursiveWatchSupported,
} from './server.js';
import { atomicWrite } from '../lib/atomic.js';
import { projectSlug, realpathKey } from '../lib/slug.js';
import { KIT_VERSION } from '../lib/version.js';
import { createModelApiHandler } from '../models/dashboard-api.js';

export interface HubProject {
  cwd: string;
  slug: string;
  file: string;
  regenerate: () => void | Promise<void>;
}

export type RegisterResult =
  | { ok: true; slug: string; url: string }
  | { ok: false; code: 409; existingCwd: string; incomingCwd: string }
  | { ok: false; code: 400; message: string };

export interface HubHandle {
  server: Server;
  port: number;
  register(project: Omit<HubProject, 'slug'> & { slug?: string }): RegisterResult;
  close(): Promise<void>;
}

type ProjectEntry = {
  cwd: string;
  realpath: string;
  file: string;
  broker: ReturnType<typeof createReloadBroker>;
  reloader: ReturnType<typeof createDebouncedReloader>;
  watcher: FSWatcher | null;
  runApi: ReturnType<typeof createRunApiHandler>;
  modelApi: ReturnType<typeof createModelApiHandler>;
};

const WATCH_WARN =
  'warning: live reload is disabled because Node 24+ on Windows cannot reliably watch directories recursively (libuv fs-event bug); use Node 22 or Linux/macOS for --serve';

function watchBacklog(
  cwd: string,
  reloader: ReturnType<typeof createDebouncedReloader>,
): FSWatcher | null {
  const backlogDir = join(cwd, 'backlog');
  if (recursiveWatchSupported(process.platform, process.versions.node)) {
    try {
      const watcher = watch(backlogDir, { persistent: true, recursive: true }, () => reloader.trigger());
      watcher.on('error', () => {});
      return watcher;
    } catch {
      return null;
    }
  }
  console.warn(WATCH_WARN);
  return null;
}

function projectUrl(port: number, slug: string): string {
  return `http://127.0.0.1:${port}/p/${slug}/`;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function serveFile(file: string, res: ServerResponse): void {
  readFile(file)
    .then((bytes) => {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(bytes);
    })
    .catch(() => {
      sendText(res, 404, 'dashboard not generated yet');
    });
}

function generateDashboard(cwd: string, file: string): void {
  const data = collectDashboardData(cwd, { kitVersion: KIT_VERSION });
  atomicWrite(file, renderDashboard(data));
}

export async function startHubServer(opts: { port?: number; token: string }): Promise<HubHandle> {
  const projects = new Map<string, ProjectEntry>();
  const token = opts.token;
  let port = 0;

  function disposeEntry(entry: ProjectEntry): void {
    entry.reloader.cancel();
    entry.broker.close();
    entry.watcher?.close();
  }

  function register(project: Omit<HubProject, 'slug'> & { slug?: string }): RegisterResult {
    let computed;
    try {
      computed = projectSlug(project.cwd);
    } catch {
      return { ok: false, code: 400, message: 'invalid cwd' };
    }
    if (!computed.ok) {
      return { ok: false, code: 400, message: 'empty slug' };
    }
    const slug = project.slug ?? computed.slug;
    if (slug === '') {
      return { ok: false, code: 400, message: 'empty slug' };
    }

    let key: string;
    try {
      key = realpathKey(project.cwd);
    } catch {
      return { ok: false, code: 400, message: 'invalid cwd' };
    }

    const existing = projects.get(slug);
    if (existing && existing.realpath !== key) {
      return { ok: false, code: 409, existingCwd: existing.cwd, incomingCwd: project.cwd };
    }

    const url = projectUrl(port, slug);
    if (existing && existing.realpath === key) {
      existing.cwd = project.cwd;
      existing.file = project.file;
      existing.reloader.cancel();
      existing.watcher?.close();
      existing.reloader = createDebouncedReloader(project.regenerate, () => existing.broker.broadcast('reload'), 300);
      existing.watcher = watchBacklog(project.cwd, existing.reloader);
      return { ok: true, slug, url };
    }

    const broker = createReloadBroker();
    const reloader = createDebouncedReloader(project.regenerate, () => broker.broadcast('reload'), 300);
    const entry: ProjectEntry = {
      cwd: project.cwd,
      realpath: key,
      file: project.file,
      broker,
      reloader,
      watcher: watchBacklog(project.cwd, reloader),
      runApi: createRunApiHandler(project.cwd),
      modelApi: createModelApiHandler(),
    };
    projects.set(slug, entry);
    return { ok: true, slug, url };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = parsed.pathname;

    if (pathname === '/' && method === 'GET') {
      const links = [...projects.keys()]
        .map((s) => `<li><a href="/p/${s}/">${s}</a></li>`)
        .join('\n');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><title>sbl hub</title><ul>${links}</ul>`);
      return;
    }

    if (pathname === '/api/hub/status' && method === 'GET') {
      if (parsed.searchParams.get('token') !== token) {
        sendText(res, 401, 'unauthorized');
        return;
      }
      sendJson(res, 200, { pid: process.pid, port });
      return;
    }

    if (pathname === '/api/hub/register' && method === 'POST') {
      let body: string;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: 'failed to read body' });
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        sendJson(res, 400, { error: 'invalid json' });
        return;
      }
      if (typeof payload !== 'object' || payload === null) {
        sendJson(res, 400, { error: 'invalid json' });
        return;
      }
      const rec = payload as Record<string, unknown>;
      if (rec.token !== token) {
        sendText(res, 401, 'unauthorized');
        return;
      }
      if (typeof rec.cwd !== 'string') {
        sendJson(res, 400, { ok: false, code: 400, message: 'cwd required' });
        return;
      }
      const cwd = rec.cwd;
      const slugResult = (() => {
        try {
          return projectSlug(cwd);
        } catch {
          return { ok: false as const, reason: 'empty' as const };
        }
      })();
      const slug = slugResult.ok ? slugResult.slug : 'project';
      const file = join(tmpdir(), `sbl-dashboard-${Date.now()}-${slug}.html`);
      const regenerate = (): void => generateDashboard(cwd, file);
      try {
        regenerate();
      } catch {
        // still register; GET may 404 until a later refresh
      }
      const result = register({ cwd, file, regenerate });
      sendJson(res, result.ok ? 200 : result.code, result);
      return;
    }

    const scoped = /^\/p\/([^/]+)(\/.*)?$/.exec(pathname);
    if (!scoped) {
      sendText(res, 404, 'not found');
      return;
    }
    const slug = scoped[1] ?? '';
    const rest = scoped[2];
    const entry = projects.get(slug);
    if (!entry) {
      sendText(res, 404, 'not found');
      return;
    }

    if (rest === undefined) {
      res.writeHead(302, { location: `/p/${slug}/` });
      res.end();
      return;
    }

    if (rest.startsWith('/api/')) {
      req.url = rest;
      if (rest === '/api/run') {
        await entry.runApi(req, res);
        return;
      }
      if (entry.broker.handler(req, res)) {
        return;
      }
      await entry.modelApi(req, res);
      return;
    }

    if (method === 'GET' && (rest === '/' || rest === '/index.html')) {
      serveFile(entry.file, res);
      return;
    }

    sendText(res, 404, 'not found');
  }

  const server: Server = createServer((req, res) => {
    void handle(req, res);
  });

  const requestedPort = opts.port ?? DASHBOARD_PORT;
  port = await new Promise<number>((resolvePort, rejectPort) => {
    server.once('error', rejectPort);
    server.listen(requestedPort, '127.0.0.1', () => {
      const addr = server.address();
      if (addr !== null && typeof addr === 'object') resolvePort(addr.port);
      else resolvePort(requestedPort);
    });
  });

  return {
    server,
    port,
    register,
    close(): Promise<void> {
      for (const entry of projects.values()) disposeEntry(entry);
      projects.clear();
      return new Promise((resolveClose) => {
        server.close(() => resolveClose());
      });
    },
  };
}
