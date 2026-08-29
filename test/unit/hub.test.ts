import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

    function connect(slug: string): { chunks: string[]; close(): void } {
      const chunks: string[] = [];
      const sse = request({ host: '127.0.0.1', port: hub.port, path: `/p/${slug}/api/events`, method: 'GET' }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (c: string) => chunks.push(c));
      });
      sse.on('error', () => {});
      sse.end();
      return { chunks, close: () => sse.destroy() };
    }

    const clientA = connect(regA.slug);
    const clientB = connect(regB.slug);
    const connected = async (client: { chunks: string[] }): Promise<boolean> => {
      const deadline = Date.now() + 2000;
      while (!client.chunks.join('').includes(':') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      return client.chunks.join('').includes(':');
    };
    expect(await connected(clientA)).toBe(true);
    expect(await connected(clientB)).toBe(true);

    hub.triggerReload(regA.slug);

    const gotA = async (): Promise<boolean> => {
      const deadline = Date.now() + 2000;
      while (!clientA.chunks.join('').includes('event: reload') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      return clientA.chunks.join('').includes('event: reload');
    };
    expect(await gotA()).toBe(true);
    expect(clientB.chunks.join('')).not.toContain('event: reload');
    clientA.close();
    clientB.close();
  });

  it('scopes /api/models to each registered project cwd', async () => {
    const a = fixture('sbl-hub-models-a-', 'Alpha');
    const b = fixture('sbl-hub-models-b-', 'Bravo');
    dirs.push(a.cwd, b.cwd);
    mkdirSync(join(a.cwd, '.super-backlog'));
    mkdirSync(join(b.cwd, '.super-backlog'));
    writeFileSync(join(a.cwd, '.super-backlog', 'models.json'), JSON.stringify({ enabled: true, mode: 'family' }));
    writeFileSync(join(b.cwd, '.super-backlog', 'models.json'), JSON.stringify({ enabled: true, mode: 'individual' }));

    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    const regA = hub.register({ cwd: a.cwd, file: a.file, regenerate: () => {} });
    const regB = hub.register({ cwd: b.cwd, file: b.file, regenerate: () => {} });
    expect(regA.ok).toBe(true);
    expect(regB.ok).toBe(true);
    if (!regA.ok || !regB.ok) return;

    const modelsA = await req(hub.port, `/p/${regA.slug}/api/models`);
    const modelsB = await req(hub.port, `/p/${regB.slug}/api/models`);
    expect(modelsA.status).toBe(200);
    expect(modelsB.status).toBe(200);
    expect(JSON.parse(modelsA.body).config).toMatchObject({ enabled: true, mode: 'family' });
    expect(JSON.parse(modelsB.body).config).toMatchObject({ enabled: true, mode: 'individual' });
  });
});

describe('Node 24 watch warning', () => {
  it('does not mention --serve', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/dashboard/hub.ts', import.meta.url)), 'utf8');
    expect(src).not.toContain('--serve');
  });
});
