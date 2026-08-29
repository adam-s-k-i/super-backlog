import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHubServer } from '../../src/dashboard/hub.js';
import { runDashboard } from '../../src/commands/dashboard.js';
import { writeHubState } from '../../src/lib/hub-state.js';

function req(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const r = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        b += c;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b }));
    });
    r.on('error', reject);
    r.end();
  });
}

function fixture(projectName: string): string {
  const cwd = mkdtempSync(join(tmpdir(), 'sbl-attach-'));
  mkdirSync(join(cwd, 'backlog'));
  writeFileSync(join(cwd, 'backlog', 'config.yml'), `project_name: ${projectName}\n`);
  return cwd;
}

describe('runDashboard attach', () => {
  const handles: Array<{ close(): Promise<void> }> = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const h of handles) await h.close().catch(() => {});
    handles.length = 0;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('attaches a second project to the running hub without binding another port', async () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-attach-home-'));
    const secondCwd = fixture('slug-b');
    dirs.push(home, secondCwd);
    const hub = await startHubServer({ port: 0, token: 'tok' });
    handles.push(hub);
    writeHubState(home, { pid: process.pid, port: hub.port, token: 'tok' });

    const startHub = vi.fn(async () => {
      throw new Error('should not become hub');
    });
    const code = await runDashboard(
      secondCwd,
      { values: { 'no-open': true }, positionals: [] },
      { homedir: () => home, startHub, openBrowser: () => {} },
    );
    expect(code).toBe(0);
    expect(startHub).not.toHaveBeenCalled();
    const page = await req(hub.port, '/p/slug-b/');
    expect(page.status).toBe(200);
  });

  it('rejects a --port that differs from the live hub without registering', async () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-attach-home-'));
    const secondCwd = fixture('slug-c');
    dirs.push(home, secondCwd);
    const hub = await startHubServer({ port: 0, token: 'tok' });
    handles.push(hub);
    writeHubState(home, { pid: process.pid, port: hub.port, token: 'tok' });

    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const startHub = vi.fn(async () => {
      throw new Error('should not become hub');
    });
    const otherPort = hub.port === 65535 ? hub.port - 1 : hub.port + 1;
    const code = await runDashboard(
      secondCwd,
      { values: { 'no-open': true, port: String(otherPort) }, positionals: [] },
      { homedir: () => home, startHub, openBrowser: () => {} },
    );
    expect(code).toBe(1);
    expect(startHub).not.toHaveBeenCalled();
    expect(err.mock.calls.map(String).join('\n')).toContain(`already running on ${hub.port}`);
    const page = await req(hub.port, '/p/slug-c/');
    expect(page.status).toBe(404);
  });

  it('attaches when --port matches the live hub port', async () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-attach-home-'));
    const secondCwd = fixture('slug-d');
    dirs.push(home, secondCwd);
    const hub = await startHubServer({ port: 0, token: 'tok' });
    handles.push(hub);
    writeHubState(home, { pid: process.pid, port: hub.port, token: 'tok' });

    const startHub = vi.fn(async () => {
      throw new Error('should not become hub');
    });
    const code = await runDashboard(
      secondCwd,
      { values: { 'no-open': true, port: String(hub.port) }, positionals: [] },
      { homedir: () => home, startHub, openBrowser: () => {} },
    );
    expect(code).toBe(0);
    expect(startHub).not.toHaveBeenCalled();
    const page = await req(hub.port, '/p/slug-d/');
    expect(page.status).toBe(200);
  });

  it('returns 1 on slug collision and prints both paths', async () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-attach-home-'));
    const a = fixture('Same');
    const b = fixture('Same');
    dirs.push(home, a, b);
    const hub = await startHubServer({ port: 0, token: 'tok' });
    handles.push(hub);
    writeHubState(home, { pid: process.pid, port: hub.port, token: 'tok' });
    writeFileSync(join(a, 'dash.html'), '<html>a</html>');
    hub.register({ cwd: a, file: join(a, 'dash.html'), regenerate: () => {} });

    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await runDashboard(
      b,
      { values: { 'no-open': true }, positionals: [] },
      { homedir: () => home, openBrowser: () => {} },
    );
    expect(code).toBe(1);
    const stderr = err.mock.calls.map(String).join('\n');
    expect(stderr).toContain(a);
    expect(stderr).toContain(b);
  });
});
