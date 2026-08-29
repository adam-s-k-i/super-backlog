import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startHubServer } from '../../src/dashboard/hub.js';

function req(port: number, path: string, method = 'GET', body?: string): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const r = request({ host: '127.0.0.1', port, path, method, headers: { 'content-type': 'application/json' } }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, body: b }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function fixture(name: string, projectName: string, html = `<html>${projectName}</html>`): { cwd: string; file: string } {
  const cwd = mkdtempSync(join(tmpdir(), name));
  mkdirSync(join(cwd, 'backlog'));
  writeFileSync(join(cwd, 'backlog', 'config.yml'), `project_name: ${projectName}\n`);
  const file = join(cwd, 'dash.html');
  writeFileSync(file, html);
  return { cwd, file };
}

describe('startHubServer', () => {
  const handles: Array<{ close(): Promise<void> }> = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const h of handles) await h.close().catch(() => {});
    handles.length = 0;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('serves HTML at /p/<slug>/ and lists it on /', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-hub-a-'));
    dirs.push(cwd);
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), 'project_name: Alpha\n');
    const file = join(cwd, 'dash.html');
    writeFileSync(file, '<html>alpha</html>');
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    const reg = hub.register({ cwd, file, regenerate: () => {} });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    const page = await req(hub.port, `/p/${reg.slug}/`);
    expect(page.status).toBe(200);
    expect(page.body).toContain('alpha');
    const index = await req(hub.port, '/');
    expect(index.body).toContain(`/p/${reg.slug}/`);
  });

  it('returns 409 on slug collision with a different cwd', async () => {
    const a = mkdtempSync(join(tmpdir(), 'sbl-hub-a-'));
    const b = mkdtempSync(join(tmpdir(), 'sbl-hub-b-'));
    dirs.push(a, b);
    for (const d of [a, b]) {
      mkdirSync(join(d, 'backlog'));
      writeFileSync(join(d, 'backlog', 'config.yml'), 'project_name: Same\n');
    }
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    hub.register({ cwd: a, file: join(a, 'x.html'), regenerate: () => {} });
    writeFileSync(join(a, 'x.html'), 'a');
    const second = hub.register({ cwd: b, file: join(b, 'x.html'), regenerate: () => {} });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe(409);
  });

  it('rejects status and register without the token', async () => {
    const hub = await startHubServer({ port: 0, token: 'secret' });
    handles.push(hub);
    expect((await req(hub.port, '/api/hub/status')).status).toBe(401);
    expect((await req(hub.port, '/api/hub/register', 'POST', JSON.stringify({ cwd: process.cwd(), token: 'nope' }))).status).toBe(401);
  });

  it('registers a second project via POST and serves GET /p/slug-b/', async () => {
    const { cwd, file } = fixture('sbl-hub-post-', 'slug-b');
    dirs.push(cwd);
    writeFileSync(file, '<html>slug-b</html>');
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    const res = await req(hub.port, '/api/hub/register', 'POST', JSON.stringify({ cwd, token: 't' }));
    expect(res.status).toBe(200);
    const page = await req(hub.port, '/p/slug-b/');
    expect(page.status).toBe(200);
  });

  it('does not send project A reload events to project B SSE clients', async () => {
    const a = fixture('sbl-hub-iso-a-', 'Alpha');
    const b = fixture('sbl-hub-iso-b-', 'Bravo');
    dirs.push(a.cwd, b.cwd);
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    const regA = hub.register({ cwd: a.cwd, file: a.file, regenerate: () => {} });
    const regB = hub.register({ cwd: b.cwd, file: b.file, regenerate: () => {} });
    expect(regA.ok).toBe(true);
    expect(regB.ok).toBe(true);
    if (!regA.ok || !regB.ok) return;

    const received: string[] = [];
    const sse = request({ host: '127.0.0.1', port: hub.port, path: `/p/${regB.slug}/api/events`, method: 'GET' }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (c: string) => received.push(c));
    });
    sse.on('error', () => {});
    sse.end();

    const deadline = Date.now() + 2000;
    while (!received.join('').includes(':') && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(received.join('')).toContain(':');

    writeFileSync(join(a.cwd, 'backlog', 'tasks.md'), '# touched\n');
    await new Promise((r) => setTimeout(r, 400));
    expect(received.join('')).not.toContain('event: reload');
    sse.destroy();
  });
});
