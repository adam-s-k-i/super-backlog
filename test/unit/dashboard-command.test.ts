import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}));

import spawn from 'cross-spawn';
import { createShutdown, runDashboard } from '../../src/commands/dashboard.js';
import type { HubHandle } from '../../src/dashboard/hub.js';
import { readHubState, writeHubState } from '../../src/lib/hub-state.js';
import { KIT_VERSION } from '../../src/lib/version.js';

const dirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function project(name: string): string {
  const cwd = tempDir('sbl-dash-proj-');
  mkdirSync(join(cwd, 'backlog'));
  writeFileSync(join(cwd, 'backlog', 'config.yml'), `project_name: ${name}\n`);
  return cwd;
}

function fakeHub(
  register = vi.fn().mockReturnValue({
    ok: true,
    slug: 'alpha',
    url: 'http://127.0.0.1:6428/p/alpha/',
  }),
): HubHandle {
  const closeListeners: Array<() => void> = [];
  const fireClose = (): void => {
    const cbs = closeListeners.splice(0);
    for (const cb of cbs) cb();
  };
  return {
    port: 6428,
    register,
    triggerReload: vi.fn(),
    close: vi.fn(async () => {
      fireClose();
    }),
    server: {
      once(event: string, cb: () => void) {
        if (event === 'close') {
          closeListeners.push(cb);
          queueMicrotask(fireClose);
        }
      },
    },
  } as unknown as HubHandle;
}

describe('runDashboard', () => {
  it('does not call cross-spawn for backlog', async () => {
    vi.mocked(spawn).mockImplementation(() => ({ on: vi.fn(), unref: vi.fn() }) as unknown as ReturnType<typeof spawn>);
    const startHub = vi.fn(async () => fakeHub());
    const cwd = project('Alpha');
    const home = tempDir('sbl-dash-home-');
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      openBrowser: () => {},
    });
    expect(code).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('becomes hub on first call and registers the project', async () => {
    const register = vi.fn().mockReturnValue({
      ok: true,
      slug: 'alpha',
      url: 'http://127.0.0.1:6428/p/alpha/',
    });
    const startHub = vi.fn(async () => fakeHub(register));
    const cwd = project('Alpha');
    const home = tempDir('sbl-dash-home-');
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      openBrowser: () => {},
    });
    expect(code).toBe(0);
    expect(startHub).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd,
        file: expect.stringMatching(/sbl-dashboard-\d+-alpha\.html$/),
        regenerate: expect.any(Function),
      }),
    );
  });

  it('respects --no-open and a custom --port', async () => {
    const register = vi.fn().mockReturnValue({
      ok: true,
      slug: 'alpha',
      url: 'http://127.0.0.1:9000/p/alpha/',
    });
    const startHub = vi.fn(async () => {
      const hub = fakeHub(register);
      (hub as { port: number }).port = 9000;
      return hub;
    });
    const opened: string[] = [];
    const cwd = project('Alpha');
    const home = tempDir('sbl-dash-home-');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const code = await runDashboard(
      cwd,
      { values: { port: '9000', 'no-open': true }, positionals: [] },
      { homedir: () => home, startHub, openBrowser: (url) => opened.push(url) },
    );
    expect(code).toBe(0);
    expect(startHub).toHaveBeenCalledWith(expect.objectContaining({ port: 9000, token: expect.any(String) }));
    expect(opened).toEqual([]);
    expect(warn.mock.calls.map(String).join('\n')).toContain(':6428');
  });

  it('writes no dashboard.html in the project directory', async () => {
    const register = vi.fn().mockReturnValue({
      ok: true,
      slug: 'alpha',
      url: 'http://127.0.0.1:6428/p/alpha/',
    });
    const cwd = project('Alpha');
    const home = tempDir('sbl-dash-home-');
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub: async () => fakeHub(register),
      openBrowser: () => {},
    });
    expect(code).toBe(0);
    const file = register.mock.calls[0]?.[0]?.file as string;
    expect(file).not.toBe(join(cwd, 'dashboard.html'));
    expect(file).toMatch(/\.html$/);
  });

  it('returns 1 when the slug is empty', async () => {
    const cwd = project('!!!');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const startHub = vi.fn(async () => fakeHub());
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => tempDir('sbl-dash-home-'),
      startHub,
      openBrowser: () => {},
    });
    expect(code).toBe(1);
    expect(startHub).not.toHaveBeenCalled();
    expect(err.mock.calls.map(String).join('\n')).toContain('project_name');
  });

  it('attaches to a live hub without starting another', async () => {
    const cwd = project('Bravo');
    const home = tempDir('sbl-dash-home-');
    mkdirSync(join(home, '.super-backlog'), { recursive: true });
    writeFileSync(
      join(home, '.super-backlog', 'hub.json'),
      JSON.stringify({ pid: process.pid, port: 6428, token: 'tok', version: KIT_VERSION }),
    );
    const startHub = vi.fn(async () => fakeHub());
    const opened: string[] = [];
    const killPid = vi.fn();
    const attach = vi.fn(async (url: string, body: unknown) => {
      if (url.includes('/api/hub/status')) {
        return { status: 200, json: { pid: process.pid, port: 6428, version: KIT_VERSION, fingerprint: 'fp-a' } };
      }
      expect(body).toEqual({ cwd, token: 'tok' });
      return { status: 200, json: { ok: true, slug: 'bravo', url: 'http://127.0.0.1:6428/p/bravo/' } };
    });
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      attach,
      openBrowser: (url) => opened.push(url),
      killPid,
      buildFingerprint: () => 'fp-a',
    });
    expect(code).toBe(0);
    expect(startHub).not.toHaveBeenCalled();
    expect(attach).toHaveBeenCalled();
    expect(killPid).not.toHaveBeenCalled();
    expect(opened).toEqual([]);
    expect(readHubState(home)?.port).toBe(6428);
  });

  it('restarts a same-version hub whose build fingerprint differs', async () => {
    const cwd = project('Hotel');
    const home = tempDir('sbl-dash-home-');
    writeHubState(home, { pid: 777, port: 6428, token: 'tok', version: KIT_VERSION });
    let fingerprintAtRegister: string | undefined;
    const register = vi.fn(() => {
      fingerprintAtRegister = readHubState(home)?.fingerprint;
      return { ok: true, slug: 'hotel', url: 'http://127.0.0.1:6428/p/hotel/' };
    });
    const startHub = vi.fn(async () => fakeHub(register));
    let alive = true;
    const killPid = vi.fn(() => {
      alive = false;
    });
    const isAlive = vi.fn(() => alive);
    const sleep = vi.fn(async () => {});
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const attach = vi.fn(async (url: string) => {
      if (url.includes('/api/hub/status')) {
        return { status: 200, json: { pid: 777, port: 6428, version: KIT_VERSION, fingerprint: 'old-build' } };
      }
      throw new Error('should not talk to the old hub again');
    });
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      attach,
      openBrowser: () => {},
      killPid,
      isAlive,
      sleep,
      buildFingerprint: () => 'new-build',
    });
    expect(code).toBe(0);
    expect(killPid).toHaveBeenCalledWith(777);
    expect(startHub).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalled();
    expect(log.mock.calls.map(String).join('\n')).toContain('fingerprint');
    expect(fingerprintAtRegister).toBe('new-build');
  });

  it('restarts a same-version hub that reports no fingerprint (hub from an older CLI)', async () => {
    const cwd = project('India');
    const home = tempDir('sbl-dash-home-');
    writeHubState(home, { pid: 888, port: 6428, token: 'tok', version: KIT_VERSION });
    const startHub = vi.fn(async () => fakeHub());
    let alive = true;
    const killPid = vi.fn(() => {
      alive = false;
    });
    const isAlive = vi.fn(() => alive);
    const sleep = vi.fn(async () => {});
    const attach = vi.fn(async (url: string) => {
      if (url.includes('/api/hub/status')) {
        return { status: 200, json: { pid: 888, port: 6428, version: KIT_VERSION } };
      }
      throw new Error('should not talk to the old hub again');
    });
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      attach,
      openBrowser: () => {},
      killPid,
      isAlive,
      sleep,
      buildFingerprint: () => 'new-build',
    });
    expect(code).toBe(0);
    expect(killPid).toHaveBeenCalledWith(888);
    expect(startHub).toHaveBeenCalledTimes(1);
  });

  it('keeps version-only behavior when the local build fingerprint is unavailable', async () => {
    const cwd = project('Juliett');
    const home = tempDir('sbl-dash-home-');
    mkdirSync(join(home, '.super-backlog'), { recursive: true });
    writeFileSync(
      join(home, '.super-backlog', 'hub.json'),
      JSON.stringify({ pid: process.pid, port: 6428, token: 'tok', version: KIT_VERSION }),
    );
    const startHub = vi.fn(async () => fakeHub());
    const killPid = vi.fn();
    const attach = vi.fn(async (url: string, body: unknown) => {
      if (url.includes('/api/hub/status')) {
        return { status: 200, json: { pid: process.pid, port: 6428, version: KIT_VERSION } };
      }
      expect(body).toEqual({ cwd, token: 'tok' });
      return { status: 200, json: { ok: true, slug: 'juliett', url: 'http://127.0.0.1:6428/p/juliett/' } };
    });
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      attach,
      openBrowser: () => {},
      killPid,
      buildFingerprint: () => null,
    });
    expect(code).toBe(0);
    expect(killPid).not.toHaveBeenCalled();
    expect(startHub).not.toHaveBeenCalled();
  });

  it('restarts an outdated hub on version mismatch and starts a fresh one', async () => {
    const cwd = project('Echo');
    const home = tempDir('sbl-dash-home-');
    writeHubState(home, { pid: 12345, port: 6428, token: 'tok', version: '0.0.1' });
    let versionAtRegister: string | undefined;
    const register = vi.fn(() => {
      versionAtRegister = readHubState(home)?.version;
      return { ok: true, slug: 'echo', url: 'http://127.0.0.1:6428/p/echo/' };
    });
    const startHub = vi.fn(async () => fakeHub(register));
    const killPid = vi.fn();
    let alive = true;
    const isAlive = vi.fn(() => alive);
    const sleep = vi.fn(async () => {
      alive = false;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const attach = vi.fn(async (url: string) => {
      if (url.includes('/api/hub/status')) {
        return { status: 200, json: { pid: 12345, port: 6428, version: '0.0.1' } };
      }
      throw new Error('should not talk to the old hub again');
    });
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      attach,
      openBrowser: () => {},
      killPid,
      isAlive,
      sleep,
    });
    expect(code).toBe(0);
    expect(killPid).toHaveBeenCalledWith(12345);
    expect(sleep).toHaveBeenCalled();
    expect(startHub).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalled();
    expect(versionAtRegister).toBe(KIT_VERSION);
    expect(log.mock.calls.map(String).join('\n')).toContain('restarting it');
  });

  it('treats a live hub reporting no version as a mismatch and restarts it', async () => {
    const cwd = project('Golf');
    const home = tempDir('sbl-dash-home-');
    writeHubState(home, { pid: 555, port: 6428, token: 'tok' });
    const register = vi.fn().mockReturnValue({
      ok: true,
      slug: 'golf',
      url: 'http://127.0.0.1:6428/p/golf/',
    });
    const startHub = vi.fn(async () => fakeHub(register));
    let alive = true;
    const killPid = vi.fn(() => {
      alive = false;
    });
    const isAlive = vi.fn(() => alive);
    const sleep = vi.fn(async () => {});
    const attach = vi.fn(async (url: string) => {
      if (url.includes('/api/hub/status')) {
        return { status: 200, json: { pid: 555, port: 6428 } };
      }
      throw new Error('should not talk to the old hub again');
    });
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      attach,
      openBrowser: () => {},
      killPid,
      isAlive,
      sleep,
    });
    expect(code).toBe(0);
    expect(killPid).toHaveBeenCalledWith(555);
    expect(sleep).not.toHaveBeenCalled();
    expect(startHub).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalled();
  });

  it('errors out when the outdated hub refuses to stop', async () => {
    const cwd = project('Foxtrot');
    const home = tempDir('sbl-dash-home-');
    writeHubState(home, { pid: 999, port: 6428, token: 'tok', version: '0.0.1' });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const startHub = vi.fn(async () => fakeHub());
    const killPid = vi.fn();
    const isAlive = vi.fn(() => true);
    const sleep = vi.fn(async () => {});
    const attach = vi.fn(async (url: string) => {
      if (url.includes('/api/hub/status')) {
        return { status: 200, json: { pid: 999, port: 6428, version: '0.0.1' } };
      }
      throw new Error('should not register with the old hub');
    });
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      attach,
      openBrowser: () => {},
      killPid,
      isAlive,
      sleep,
    });
    expect(code).toBe(1);
    expect(killPid).toHaveBeenCalledWith(999);
    expect(sleep).toHaveBeenCalledTimes(50);
    expect(startHub).not.toHaveBeenCalled();
    expect(readHubState(home)?.pid).toBe(999);
    expect(err.mock.calls.map(String).join('\n')).toContain(
      'could not stop the outdated hub (pid 999) — stop it manually and re-run',
    );
  });

  it('treats a stale hub.json (dead pid) as no hub running and becomes the hub', async () => {
    const cwd = project('Charlie');
    const home = tempDir('sbl-dash-home-');
    // A pid guaranteed dead: spawnSync only returns once the child has
    // already exited and been reaped.
    const dead = spawnSync(process.execPath, ['-e', '0']).pid ?? 0;
    writeHubState(home, { pid: dead, port: 6428, token: 'stale' });
    const register = vi.fn().mockReturnValue({
      ok: true,
      slug: 'charlie',
      url: 'http://127.0.0.1:6428/p/charlie/',
    });
    const startHub = vi.fn(async () => fakeHub(register));
    const attach = vi.fn();
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      attach,
      openBrowser: () => {},
    });
    expect(code).toBe(0);
    expect(attach).not.toHaveBeenCalled();
    expect(startHub).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalled();
  });

  it('exits 1 when the hub port is occupied by a foreign process', async () => {
    const cwd = project('Delta');
    const home = tempDir('sbl-dash-home-');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const startHub = vi.fn(async () => {
      const e = new Error('listen EADDRINUSE: address already in use 127.0.0.1:6428') as NodeJS.ErrnoException;
      e.code = 'EADDRINUSE';
      throw e;
    });
    const code = await runDashboard(cwd, { values: { 'no-open': true }, positionals: [] }, {
      homedir: () => home,
      startHub,
      openBrowser: () => {},
    });
    expect(code).toBe(1);
    expect(startHub).toHaveBeenCalledTimes(1);
    const stderr = err.mock.calls.map(String).join('\n');
    expect(stderr).toContain('port 6428 is in use');
  });
});

describe('createShutdown', () => {
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('closes the hub handle and clears hub state, idempotently', async () => {
    const home = tempDir('sbl-dash-home-');
    writeHubState(home, { pid: process.pid, port: 6428, token: 'x' });
    const hub = fakeHub();
    const shutdown = createShutdown(hub, home, process.pid);

    await shutdown();
    expect(readHubState(home)).toBeNull();
    expect(hub.close).toHaveBeenCalledTimes(1);

    await expect(shutdown()).resolves.toBeUndefined();
    expect(hub.close).toHaveBeenCalledTimes(1);
  });
});
