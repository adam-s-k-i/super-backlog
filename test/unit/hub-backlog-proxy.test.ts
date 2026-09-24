// test/unit/hub-backlog-proxy.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BrowserChild } from '../../src/dashboard/backlog-browser.js';
import { startHubServer, type HubHandle } from '../../src/dashboard/hub.js';

interface FakeChild extends BrowserChild {
  killed: boolean;
}

function fakeChild(): FakeChild {
  return {
    pid: 4242,
    exitCode: null,
    killed: false,
    kill(): void {
      this.killed = true;
      this.exitCode = 1;
    },
    on(): void {},
  };
}

interface FakeBrowser {
  server: Server;
  port: number;
  hits: string[];
}

async function fakeBrowser(marker: string): Promise<FakeBrowser> {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    hits.push(`${req.method ?? 'GET'} ${url}`);
    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html>${marker}</html>`);
      return;
    }
    if (url.startsWith('/chunk-')) {
      res.writeHead(200, { 'content-type': 'text/css' });
      res.end(`/* ${marker} */`);
      return;
    }
    if (url.startsWith('/api/')) {
      let body = '';
      req.on('data', (c: Buffer) => {
        body += c.toString('utf8');
      });
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ marker, echo: body }));
      });
      return;
    }
    res.writeHead(404);
    res.end('nope');
  });
  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr !== null && typeof addr === 'object') resolve(addr.port);
      else resolve(0);
    });
  });
  return { server, port, hits };
}

interface ReqOptions {
  method?: string;
  cookie?: string;
  contentType?: string;
  body?: string;
}

function req(port: number, path: string, opts: ReqOptions = {}): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opts.cookie !== undefined) headers.cookie = opts.cookie;
    if (opts.contentType !== undefined) headers['content-type'] = opts.contentType;
    const r = request(
      { host: '127.0.0.1', port, path, method: opts.method ?? 'GET', headers },
      (res) => {
        let b = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => {
          b += c;
        });
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: b, headers: res.headers }),
        );
      },
    );
    r.on('error', reject);
    if (opts.body !== undefined) r.write(opts.body);
    r.end();
  });
}

describe('hub backlog-browser same-origin proxy', () => {
  const handles: HubHandle[] = [];
  const browsers: FakeBrowser[] = [];
  const dirs: string[] = [];

  afterEach(async () => {
    for (const h of handles) await h.close().catch(() => {});
    handles.length = 0;
    for (const b of browsers) await new Promise<void>((resolve) => b.server.close(() => resolve()));
    browsers.length = 0;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function projectDir(name: string): string {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-bbp-'));
    dirs.push(cwd);
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), `project_name: ${name}\n`);
    writeFileSync(join(cwd, 'dash.html'), '<html>x</html>');
    return cwd;
  }

  async function startHub(ports: Array<Promise<number> | number>) {
    const resolved = await Promise.all(ports);
    let i = 0;
    return startHubServer({
      port: 0,
      token: 't',
      browserDeps: {
        resolveBin: () => 'backlog',
        spawnFn: () => fakeChild(),
        getFreePort: async () => resolved[i++] ?? 7199,
        probe: async () => true,
        timeoutMs: 500,
        intervalMs: 1,
      },
    });
  }

  it('GET /p/<slug>/bb/ proxies the browser root and registers the routing cookie', async () => {
    const browser = await fakeBrowser('alpha-root');
    browsers.push(browser);
    const hub = await startHub([browser.port]);
    handles.push(hub);
    const cwd = projectDir('Alpha');
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    if (!reg.ok) throw new Error('register failed');
    const r = await req(hub.port, `/p/${reg.slug}/bb/`);
    expect(r.status).toBe(200);
    expect(r.body).toContain('alpha-root');
    const setCookie = r.headers['set-cookie'];
    expect(String(Array.isArray(setCookie) ? setCookie[0] : setCookie)).toContain(`sbl_bb=${reg.slug}`);
  });

  it('routes absolute SPA paths by cookie to the right project browser', async () => {
    const alpha = await fakeBrowser('alpha-root');
    const bravo = await fakeBrowser('bravo-root');
    browsers.push(alpha, bravo);
    const hub = await startHub([alpha.port, bravo.port]);
    handles.push(hub);
    const alphaDir = projectDir('Alpha');
    const bravoDir = projectDir('Bravo');
    const regA = hub.register({ cwd: alphaDir, file: join(alphaDir, 'dash.html'), regenerate: () => {} });
    const regB = hub.register({ cwd: bravoDir, file: join(bravoDir, 'dash.html'), regenerate: () => {} });
    if (!regA.ok || !regB.ok) throw new Error('register failed');

    const pageA = await req(hub.port, `/p/${regA.slug}/bb/`);
    const cookieA = String(Array.isArray(pageA.headers['set-cookie']) ? pageA.headers['set-cookie'][0] : pageA.headers['set-cookie']).split(';')[0];
    const pageB = await req(hub.port, `/p/${regB.slug}/bb/`);
    const cookieB = String(Array.isArray(pageB.headers['set-cookie']) ? pageB.headers['set-cookie'][0] : pageB.headers['set-cookie']).split(';')[0];

    const chunkA = await req(hub.port, '/chunk-alpha.css', { cookie: cookieA });
    expect(chunkA.status).toBe(200);
    expect(chunkA.body).toContain('alpha-root');

    const chunkB = await req(hub.port, '/chunk-alpha.css', { cookie: cookieB });
    expect(chunkB.status).toBe(200);
    expect(chunkB.body).toContain('bravo-root');

    expect(alpha.hits).toContain('GET /chunk-alpha.css');
    expect(bravo.hits).toContain('GET /chunk-alpha.css');
    expect(bravo.hits.some((h) => h.includes('alpha-root'))).toBe(false);
  });

  it('keeps unknown root paths 404 without the routing cookie', async () => {
    const browser = await fakeBrowser('alpha-root');
    browsers.push(browser);
    const hub = await startHub([browser.port]);
    handles.push(hub);
    const cwd = projectDir('Alpha');
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    if (!reg.ok) throw new Error('register failed');

    const noCookie = await req(hub.port, '/chunk-alpha.css');
    expect(noCookie.status).toBe(404);
    const ghostCookie = await req(hub.port, '/chunk-alpha.css', { cookie: 'sbl_bb=ghost' });
    expect(ghostCookie.status).toBe(404);
    expect(browser.hits).toHaveLength(0);
  });

  it('proxies non-JSON POSTs to cookie-routed browser api paths instead of rejecting 415', async () => {
    const browser = await fakeBrowser('alpha-root');
    browsers.push(browser);
    const hub = await startHub([browser.port]);
    handles.push(hub);
    const cwd = projectDir('Alpha');
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    if (!reg.ok) throw new Error('register failed');

    const page = await req(hub.port, `/p/${reg.slug}/bb/`);
    const cookie = String(Array.isArray(page.headers['set-cookie']) ? page.headers['set-cookie'][0] : page.headers['set-cookie']).split(';')[0];
    const r = await req(hub.port, '/api/echo', {
      method: 'POST',
      cookie,
      contentType: 'text/plain',
      body: 'hello-proxy',
    });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).echo).toBe('hello-proxy');
    expect(browser.hits).toContain('POST /api/echo');
  });

  it('redirects /p/<slug>/bb to the trailing-slash proxy path', async () => {
    const browser = await fakeBrowser('alpha-root');
    browsers.push(browser);
    const hub = await startHub([browser.port]);
    handles.push(hub);
    const cwd = projectDir('Alpha');
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    if (!reg.ok) throw new Error('register failed');
    const r = await req(hub.port, `/p/${reg.slug}/bb`);
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe(`/p/${reg.slug}/bb/`);
  });

  it('propagates the browser start failure on the bb route', async () => {
    const hub = await startHubServer({
      port: 0,
      token: 't',
      browserDeps: {
        resolveBin: () => null,
        spawnFn: () => fakeChild(),
        getFreePort: async () => 7101,
        probe: async () => true,
      },
    });
    handles.push(hub);
    const cwd = projectDir('Charlie');
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    if (!reg.ok) throw new Error('register failed');
    const r = await req(hub.port, `/p/${reg.slug}/bb/`);
    expect(r.status).toBe(503);
  });
});
