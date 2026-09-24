import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { createBrowserManager, type BrowserManagerDeps } from './backlog-browser.js';
import { collectDashboardData } from './data.js';
import { renderDashboard } from './render.js';
import {
  createDebouncedReloader,
  createReloadBroker,
  DASHBOARD_PORT,
  recursiveWatchSupported,
} from './server.js';
import { atomicWrite } from '../lib/atomic.js';
import { defaultBuildFingerprint } from '../lib/build-fingerprint.js';
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
  register(project: Omit<HubProject, 'slug'>): RegisterResult;
  triggerReload(slug: string): void;
  close(): Promise<void>;
}

type ProjectEntry = {
  cwd: string;
  realpath: string;
  file: string;
  broker: ReturnType<typeof createReloadBroker>;
  reloader: ReturnType<typeof createDebouncedReloader>;
  watcher: FSWatcher | null;
  browser: ReturnType<typeof createBrowserManager>;
  modelApi: ReturnType<typeof createModelApiHandler>;
};

const WATCH_WARN =
  'warning: live reload is disabled because Node 24+ on Windows cannot reliably watch directories recursively (libuv fs-event bug); use Node 22 or Linux/macOS for live reload';

const ALLOWED_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;

function isAllowedHost(headerValue: string | string[] | undefined): boolean {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof value !== 'string') return false;
  return ALLOWED_HOST.test(value.trim().toLowerCase());
}

function hasJsonContentType(req: IncomingMessage): boolean {
  const value = req.headers['content-type'];
  const ct = Array.isArray(value) ? value[0] : value;
  return typeof ct === 'string' && ct.toLowerCase().startsWith('application/json');
}

function cookieValue(req: IncomingMessage, name: string): string | null {
  const raw = req.headers.cookie;
  if (typeof raw !== 'string') return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

function proxyToOrigin(
  origin: string,
  pathAndQuery: string,
  req: IncomingMessage,
  res: ServerResponse,
  resHeaders: Record<string, string> = {},
): void {
  const target = new URL(origin);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key === 'host' || key === 'connection' || value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  const upstream = httpRequest(
    {
      host: target.hostname,
      port: target.port,
      method: req.method ?? 'GET',
      path: pathAndQuery,
      headers,
    },
    (up) => {
      const outHeaders: Record<string, string | string[]> = { ...resHeaders };
      for (const [key, value] of Object.entries(up.headers)) {
        if (key === 'connection' || key === 'keep-alive' || value === undefined) continue;
        outHeaders[key] = value;
      }
      res.writeHead(up.statusCode ?? 502, outHeaders);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) sendText(res, 502, 'backlog browser unreachable');
    else res.end();
  });
  req.pipe(upstream);
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

export async function startHubServer(opts: {
  port?: number;
  token: string;
  /** Injectable backlog-browser process deps (tests); production uses the defaults. */
  browserDeps?: BrowserManagerDeps;
}): Promise<HubHandle> {
  const projects = new Map<string, ProjectEntry>();
  const token = opts.token;
  const fingerprint = defaultBuildFingerprint();
  let port = 0;
  let watchWarned = false;

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
    if (!watchWarned) {
      watchWarned = true;
      console.warn(WATCH_WARN);
    }
    return null;
  }

  function disposeEntry(entry: ProjectEntry): void {
    entry.reloader.cancel();
    entry.broker.close();
    entry.watcher?.close();
    entry.browser.close();
  }

  function register(project: Omit<HubProject, 'slug'>): RegisterResult {
    let computed;
    try {
      computed = projectSlug(project.cwd);
    } catch {
      return { ok: false, code: 400, message: 'invalid cwd' };
    }
    if (!computed.ok) {
      return { ok: false, code: 400, message: 'empty slug' };
    }
    const slug = computed.slug;
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
      existing.modelApi = createModelApiHandler(project.cwd);
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
      browser: createBrowserManager(project.cwd, opts.browserDeps),
      modelApi: createModelApiHandler(project.cwd),
    };
    projects.set(slug, entry);
    return { ok: true, slug, url };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!isAllowedHost(req.headers.host)) {
      sendText(res, 403, 'forbidden');
      return;
    }

    const method = req.method ?? 'GET';

    const parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = parsed.pathname;

    const cookieSlug = cookieValue(req, 'sbl_bb');
    const cookieEntry = cookieSlug !== null ? projects.get(cookieSlug) ?? null : null;
    const bbScoped = /^\/p\/([^/]+)\/bb(\/.*)?$/.exec(pathname);

    if (method === 'POST' && !hasJsonContentType(req) && cookieEntry === null && bbScoped === null) {
      sendText(res, 415, 'unsupported media type: expected application/json');
      return;
    }

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
      sendJson(res, 200, { pid: process.pid, port, version: KIT_VERSION, fingerprint: fingerprint ?? undefined });
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
      if (cookieEntry !== null) {
        const result = await cookieEntry.browser.ensure();
        if (!result.ok) {
          sendJson(res, result.code, result);
          return;
        }
        proxyToOrigin(result.url, pathname + parsed.search, req, res);
        return;
      }
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

    if (rest === '/bb') {
      res.writeHead(302, { location: `/p/${slug}/bb/` });
      res.end();
      return;
    }

    if (rest === '/bb/' || rest.startsWith('/bb/')) {
      const result = await entry.browser.ensure();
      if (!result.ok) {
        sendJson(res, result.code, result);
        return;
      }
      const browserPath = rest.slice('/bb'.length) || '/';
      proxyToOrigin(result.url, browserPath + parsed.search, req, res, {
        'set-cookie': `sbl_bb=${slug}; Path=/; SameSite=Lax`,
      });
      return;    }

    if (rest.startsWith('/api/')) {
      req.url = rest;
      if (rest === '/api/backlog-browser' && method === 'POST') {
        const result = await entry.browser.ensure();
        sendJson(res, result.ok ? 200 : result.code, result);
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
    triggerReload(slug: string): void {
      projects.get(slug)?.reloader.trigger();
    },
    close(): Promise<void> {
      for (const entry of projects.values()) disposeEntry(entry);
      projects.clear();
      return new Promise((resolveClose) => {
        server.close(() => resolveClose());
      });
    },
  };
}
