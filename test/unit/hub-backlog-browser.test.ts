// test/unit/hub-backlog-browser.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserManager, type BrowserChild } from '../../src/dashboard/backlog-browser.js';
import { startHubServer } from '../../src/dashboard/hub.js';

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

describe('createBrowserManager', () => {
  it('spawns backlog browser on a free port and returns its url once ready', async () => {
    const child = fakeChild();
    const spawnFn = vi.fn(() => child);
    const probe = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const m = createBrowserManager('/proj', {
      resolveBin: () => 'backlog',
      spawnFn,
      getFreePort: async () => 7001,
      probe,
      timeoutMs: 500,
      intervalMs: 1,
    });
    const r = await m.ensure();
    expect(r).toEqual({ ok: true, url: 'http://127.0.0.1:7001/' });
    expect(spawnFn).toHaveBeenCalledWith('backlog', ['browser', '--port', '7001', '--no-open'], '/proj');
  });

  it('reuses the live child on a second ensure', async () => {
    const spawnFn = vi.fn(() => fakeChild());
    const m = createBrowserManager('/proj', {
      resolveBin: () => 'backlog',
      spawnFn,
      getFreePort: async () => 7002,
      probe: async () => true,
      timeoutMs: 500,
      intervalMs: 1,
    });
    await m.ensure();
    const r = await m.ensure();
    expect(r.ok).toBe(true);
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });

  it('respawns after the child died', async () => {
    const children: FakeChild[] = [];
    const spawnFn = vi.fn(() => {
      const c = fakeChild();
      children.push(c);
      return c;
    });
    const m = createBrowserManager('/proj', {
      resolveBin: () => 'backlog',
      spawnFn,
      getFreePort: async () => 7003,
      probe: async () => true,
      timeoutMs: 500,
      intervalMs: 1,
    });
    await m.ensure();
    children[0]!.exitCode = 0;
    const r = await m.ensure();
    expect(r.ok).toBe(true);
    expect(spawnFn).toHaveBeenCalledTimes(2);
  });

  it('returns 503 when the backlog cli is missing', async () => {
    const m = createBrowserManager('/proj', {
      resolveBin: () => null,
      spawnFn: vi.fn(),
      getFreePort: async () => 7004,
      probe: async () => true,
    });
    const r = await m.ensure();
    expect(r).toEqual({ ok: false, code: 503, message: 'backlog cli not found' });
  });

  it('returns 500 and kills the child when readiness times out', async () => {
    const child = fakeChild();
    const m = createBrowserManager('/proj', {
      resolveBin: () => 'backlog',
      spawnFn: () => child,
      getFreePort: async () => 7005,
      probe: async () => false,
      timeoutMs: 10,
      intervalMs: 1,
    });
    const r = await m.ensure();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(500);
    expect(child.killed).toBe(true);
  });

  it('close kills a live child', async () => {
    const child = fakeChild();
    const m = createBrowserManager('/proj', {
      resolveBin: () => 'backlog',
      spawnFn: () => child,
      getFreePort: async () => 7006,
      probe: async () => true,
      timeoutMs: 500,
      intervalMs: 1,
    });
    await m.ensure();
    m.close();
    expect(child.killed).toBe(true);
  });
});

function req(
  port: number,
  path: string,
  method = 'GET',
  body?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const r = request(
      { host: '127.0.0.1', port, path, method, headers: { 'content-type': 'application/json' } },
      (res) => {
        let b = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => {
          b += c;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b }));
      },
    );
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

describe('hub backlog-browser route', () => {
  const handles: Array<{ close(): Promise<void> }> = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const h of handles) await h.close().catch(() => {});
    handles.length = 0;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function projectDir(name: string): string {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-bb-'));
    dirs.push(cwd);
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), `project_name: ${name}\n`);
    writeFileSync(join(cwd, 'dash.html'), '<html>x</html>');
    return cwd;
  }

  it('POST /p/<slug>/api/backlog-browser starts the managed browser and returns its url', async () => {
    const cwd = projectDir('Bravo');
    const child = fakeChild();
    const hub = await startHubServer({
      port: 0,
      token: 't',
      browserDeps: {
        resolveBin: () => 'backlog',
        spawnFn: () => child,
        getFreePort: async () => 7100,
        probe: async () => true,
        timeoutMs: 500,
        intervalMs: 1,
      },
    });
    handles.push(hub);
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    const r = await req(hub.port, `/p/${reg.slug}/api/backlog-browser`, 'POST', '{}');
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ ok: true, url: 'http://127.0.0.1:7100/' });
  });

  it('propagates 503 when the backlog cli is missing', async () => {
    const cwd = projectDir('Charlie');
    const hub = await startHubServer({
      port: 0,
      token: 't',
      browserDeps: { resolveBin: () => null, spawnFn: () => fakeChild(), getFreePort: async () => 7101, probe: async () => true },
    });
    handles.push(hub);
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    if (!reg.ok) return;
    const r = await req(hub.port, `/p/${reg.slug}/api/backlog-browser`, 'POST', '{}');
    expect(r.status).toBe(503);
  });

  it('hub close kills the managed browser child', async () => {
    const cwd = projectDir('Delta');
    const child = fakeChild();
    const hub = await startHubServer({
      port: 0,
      token: 't',
      browserDeps: {
        resolveBin: () => 'backlog',
        spawnFn: () => child,
        getFreePort: async () => 7102,
        probe: async () => true,
        timeoutMs: 500,
        intervalMs: 1,
      },
    });
    handles.push(hub);
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    if (!reg.ok) return;
    await req(hub.port, `/p/${reg.slug}/api/backlog-browser`, 'POST', '{}');
    await hub.close();
    expect(child.killed).toBe(true);
  });

  it('the retired /api/run route is gone', async () => {
    const cwd = projectDir('Echo');
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    if (!reg.ok) return;
    const r = await req(hub.port, `/p/${reg.slug}/api/run`, 'POST', '{"command":"browser"}');
    expect(r.status).toBe(404);
  });
});
