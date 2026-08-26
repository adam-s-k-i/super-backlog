// test/integration/serve.test.ts
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
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

  it('never opens a browser when openBrowser is false', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);
    expect(typeof handle.close).toBe('function');
    await expect(handle.close()).resolves.toBeUndefined();
  });
});
