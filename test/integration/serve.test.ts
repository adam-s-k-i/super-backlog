// test/integration/serve.test.ts
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { get as httpGet, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startServeServer, recursiveWatchSupported } from '../../src/dashboard/server.js';

let dirs: string[] = [];
const handles: Array<{ close(): Promise<void> }> = [];

function freshProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-serve-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'backlog'), { recursive: true });
  writeFileSync(join(dir, 'backlog', 'config.yml'), 'project_name: serve-demo\n');
  return dir;
}

function fetchBody(port: number): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = httpGet({ host: '127.0.0.1', port, path: '/' }, (res) => {
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
    const { generateDashboard } = await import('../../src/commands/dashboard.js');
    const dir = freshProject();
    await generateDashboard(dir, { serve: false });

    const regenerate = async (): Promise<void> => {
      await generateDashboard(dir, { serve: false });
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
      const req = httpGet({ host: '127.0.0.1', port: handle.port, path: '/' }, (res) => {
        res.resume();
        resolvePromise(res.statusCode ?? 0);
      });
      req.on('error', rejectPromise);
      req.end();
    });
    expect(status).toBe(404);
  });

  it('mounts model API in serve mode without breaking the static file handler', async () => {
    const { generateDashboard } = await import('../../src/commands/dashboard.js');
    const dir = freshProject();
    await generateDashboard(dir, { serve: false });

    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const apiRes = await fetchApi(handle.port, '/api/models');
    expect(apiRes.status).toBe(200);
    expect(JSON.parse(apiRes.body).config).toHaveProperty('enabled');

    const staticRes = await fetchApi(handle.port, '/');
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
      const req = request({ host: '127.0.0.1', port: handle.port, path: '/api/events', method: 'GET' }, (r) => {
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
    const req = request({ host: '127.0.0.1', port: handle.port, path: '/api/events', method: 'GET' }, (res) => {
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
    const req = request({ host: '127.0.0.1', port: handle.port, path: '/api/events', method: 'GET' }, (res) => {
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
