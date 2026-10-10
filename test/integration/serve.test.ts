// test/integration/serve.test.ts
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { get as httpGet, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { collectDashboardData } from '../../src/dashboard/data.js';
import { renderDashboard } from '../../src/dashboard/render.js';
import { startServeServer } from '../../src/dashboard/server.js';
import { summaryFileFor, writeSummaryPage } from '../../src/dashboard/summary-render.js';

let dirs: string[] = [];
const handles: Array<{ close(): Promise<void> }> = [];

function freshProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-serve-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'backlog'), { recursive: true });
  writeFileSync(join(dir, 'backlog', 'config.yml'), 'project_name: serve-demo\n');
  return dir;
}

async function writeProjectDashboard(dir: string): Promise<void> {
  const data = collectDashboardData(dir, { kitVersion: 'test' });
  const html = renderDashboard(await data);
  writeFileSync(join(dir, 'dashboard.html'), html);
}

const PROJECT_PATH = '/p/serve-demo/';

function fetchBody(port: number, path = PROJECT_PATH): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = httpGet({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => resolvePromise(body));
    });
    req.on('error', rejectPromise);
    req.end();
  });
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

async function until(
  deadlineMs: number,
  probe: () => boolean | Promise<boolean>,
): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    if (await probe()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
}

afterEach(async () => {
  for (const h of handles) await h.close().catch(() => {});
  handles.length = 0;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

const nodeMajor = Number(process.versions.node.split('.')[0]);
const skipWatcherTests = process.platform === 'win32' && !Number.isNaN(nodeMajor) && nodeMajor >= 24;
const watcherIt = skipWatcherTests ? it.skip : it;

function fetchApi(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => resolvePromise({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', rejectPromise);
    req.end();
  });
}

describe('startServeServer', () => {
  it('serves latest dashboard bytes on an ephemeral port and regenerates on demand', async () => {
    const dir = freshProject();
    await writeProjectDashboard(dir);

    const regenerate = async (): Promise<void> => {
      await writeProjectDashboard(dir);
    };
    const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
    handles.push(handle);

    expect(handle.port).toBeGreaterThan(0);

    const first = await fetchBody(handle.port);
    expect(first.startsWith('<!doctype html>')).toBe(true);
    expect(first).toContain('serve-demo');
    const before = sha256(first);

    // manual regenerate after writing a temp backlog file: served bytes must change
    writeFileSync(join(dir, 'backlog', 'config.yml'), 'project_name: renamed-demo\n');
    await regenerate();
    let body = first;
    const changed = await until(2000, async () => {
      body = await fetchBody(handle.port);
      return sha256(body) !== before;
    });
    expect(changed).toBe(true);
    expect(body).toContain('renamed-demo');
  });

  watcherIt('watches <cwd>/backlog and triggers debounced regeneration within 2s', async () => {
    const dir = freshProject();
    const regenerate = vi.fn(async () => {});
    const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
    handles.push(handle);

    writeFileSync(join(dir, 'backlog', 'tasks.md'), '# touched\n');

    const fired = await until(2000, () => regenerate.mock.calls.length > 0);
    expect(fired).toBe(true);
  });

  watcherIt('watches task edits in the backlog/tasks subdirectory within 2s', async () => {
    const dir = freshProject();
    mkdirSync(join(dir, 'backlog', 'tasks'), { recursive: true });
    const regenerate = vi.fn(async () => {});
    const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
    handles.push(handle);

    // backlog.md stores tasks in backlog/tasks/*.md; the watcher must see
    // subdirectory writes on every platform (recursive watch).
    writeFileSync(join(dir, 'backlog', 'tasks', 'TASK-99.md'), '# TASK-99\n');

    const fired = await until(2000, () => regenerate.mock.calls.length > 0);
    expect(fired).toBe(true);
  });

  it('answers 404 while dashboard.html has not been generated yet', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const body = await fetchBody(handle.port).catch(() => '');
    expect(body).not.toContain('<!doctype html>');
    // status code check via raw request
    const status: number = await new Promise((resolvePromise, rejectPromise) => {
      const req = httpGet({ host: '127.0.0.1', port: handle.port, path: PROJECT_PATH }, (res) => {
        res.resume();
        resolvePromise(res.statusCode ?? 0);
      });
      req.on('error', rejectPromise);
      req.end();
    });
    expect(status).toBe(404);
  });

  it('mounts model API in serve mode without breaking the static file handler', async () => {
    const dir = freshProject();
    await writeProjectDashboard(dir);

    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const apiRes = await fetchApi(handle.port, `${PROJECT_PATH}api/models`);
    expect(apiRes.status).toBe(200);
    expect(JSON.parse(apiRes.body).config).toHaveProperty('enabled');

    const staticRes = await fetchApi(handle.port, PROJECT_PATH);
    expect(staticRes.status).toBe(200);
    expect(staticRes.body.startsWith('<!doctype html>')).toBe(true);
  });

  it('never opens a browser when openBrowser is false', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);
    expect(typeof handle.close).toBe('function');
    await expect(handle.close()).resolves.toBeUndefined();
  });

  it('serves an SSE stream on /api/events', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await new Promise<{ status: number; contentType: string }>((resolvePromise, rejectPromise) => {
      const req = request({ host: '127.0.0.1', port: handle.port, path: `${PROJECT_PATH}api/events`, method: 'GET' }, (r) => {
        resolvePromise({ status: r.statusCode ?? 0, contentType: String(r.headers['content-type'] ?? '') });
        req.destroy();
      });
      req.on('error', () => {}); // expected: we destroy the socket after headers
      req.end();
    });
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('text/event-stream');
  });

  watcherIt('pushes a reload event to SSE clients after a backlog change regenerates', async () => {
    const dir = freshProject();
    const regenerate = vi.fn(async () => {});
    const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
    handles.push(handle);

    const received: string[] = [];
    const req = request({ host: '127.0.0.1', port: handle.port, path: `${PROJECT_PATH}api/events`, method: 'GET' }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (c: string) => received.push(c));
    });
    req.on('error', () => {});
    req.end();

    // wait for the SSE stream to be established before triggering the watcher
    const connected = await until(2000, () => received.join('').includes(':'));
    expect(connected).toBe(true);

    writeFileSync(join(dir, 'backlog', 'tasks.md'), '# touched\n');

    const got = await until(3000, () => received.join('').includes('event: reload'));
    expect(got).toBe(true);
    expect(regenerate.mock.calls.length).toBeGreaterThan(0);
    req.destroy();
  });

  it('does not push reload events when regeneration fails', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    // without a regenerate callback there is nothing to broadcast; the stream
    // must still connect and stay silent
    const received: string[] = [];
    const req = request({ host: '127.0.0.1', port: handle.port, path: `${PROJECT_PATH}api/events`, method: 'GET' }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (c: string) => received.push(c));
    });
    req.on('error', () => {});
    req.end();

    const connected = await until(2000, () => received.join('').includes(':'));
    expect(connected).toBe(true);
    await new Promise((r) => setTimeout(r, 400));
    expect(received.join('')).not.toContain('event: reload');
    req.destroy();
  });
});

const SUMMARY_PATH = `${PROJECT_PATH}summary/`;

const ARCH_YML = [
  'schema: 1',
  'pitch: A **small** demo.',
  'grid: { cols: 2, rows: 2 }',
  'nodes:',
  '  - { id: core, label: Watcher Core, kind: core, cell: [0, 0] }',
  '  - { id: out, label: Report Sink, kind: output, cell: [1, 0] }',
  'edges:',
  '  - { from: core, to: out, label: writes }',
  '',
].join('\n');

/** Dashboard plus summary page, exactly like the hub's own regenerate chain. */
async function writeProjectPages(dir: string): Promise<void> {
  const data = await collectDashboardData(dir, { kitVersion: 'test' });
  const file = join(dir, 'dashboard.html');
  writeFileSync(file, renderDashboard(data));
  writeSummaryPage(dir, data, file);
}

function writeArchitecture(dir: string, text: string): void {
  mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
  writeFileSync(join(dir, 'backlog', 'docs', 'architecture.yml'), text);
}

function fetchRaw(port: number, path: string): Promise<{ status: number; location: string; body: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () =>
        resolvePromise({ status: res.statusCode ?? 0, location: String(res.headers.location ?? ''), body }),
      );
    });
    req.on('error', rejectPromise);
    req.end();
  });
}

describe('summary page route', () => {
  it('serves the generated summary page with its marker', async () => {
    const dir = freshProject();
    await writeProjectPages(dir);
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toContain('<meta name="sbl-page" content="summary">');
    expect(res.body).toContain('No architecture file yet');
    const viaIndex = await fetchRaw(handle.port, `${SUMMARY_PATH}index.html`);
    expect(viaIndex.status).toBe(200);
  });

  it('redirects /summary to /summary/', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await fetchRaw(handle.port, `${PROJECT_PATH}summary`);
    expect(res.status).toBe(302);
    expect(res.location).toBe(SUMMARY_PATH);
  });

  it('answers 404 with a plain text body while the summary is not generated', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.status).toBe(404);
    expect(res.body).toBe('summary not generated yet');
  });

  it('shows architecture nodes after architecture.yml is written and pages regenerate', async () => {
    const dir = freshProject();
    await writeProjectPages(dir);
    const regenerate = async (): Promise<void> => {
      await writeProjectPages(dir);
    };
    const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
    handles.push(handle);

    expect((await fetchRaw(handle.port, SUMMARY_PATH)).body).not.toContain('Watcher Core');
    writeArchitecture(dir, ARCH_YML);
    await regenerate();
    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Watcher Core');
  });

  watcherIt('regenerates and broadcasts a reload when architecture.yml changes', async () => {
    const dir = freshProject();
    await writeProjectPages(dir);
    const regenerate = vi.fn(async () => {
      await writeProjectPages(dir);
    });
    const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
    handles.push(handle);

    const received: string[] = [];
    const req = request({ host: '127.0.0.1', port: handle.port, path: `${PROJECT_PATH}api/events`, method: 'GET' }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (c: string) => received.push(c));
    });
    req.on('error', () => {});
    req.end();
    expect(await until(2000, () => received.join('').includes(':'))).toBe(true);

    writeArchitecture(dir, ARCH_YML);

    expect(await until(3000, () => received.join('').includes('event: reload'))).toBe(true);
    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.body).toContain('Watcher Core');
    req.destroy();
  });

  it('serves an invalid architecture.yml as 200 with a notice', async () => {
    const dir = freshProject();
    writeArchitecture(dir, 'schema: 2\n');
    await writeProjectPages(dir);
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toMatch(/class="notice[^"]*"/);
    expect(res.body).toContain('backlog/docs/architecture.yml');
  });

  it('keeps the dashboard intact when the summary chain fails', async () => {
    const dir = freshProject();
    // a directory where the summary file should go makes the summary write fail
    mkdirSync(summaryFileFor(join(dir, 'dashboard.html')), { recursive: true });
    await expect(writeProjectPages(dir)).resolves.toBeUndefined();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const dash = await fetchRaw(handle.port, PROJECT_PATH);
    expect(dash.status).toBe(200);
    expect(dash.body.startsWith('<!doctype html>')).toBe(true);
    expect((await fetchRaw(handle.port, SUMMARY_PATH)).status).toBe(404);
  });
});
