// test/unit/models-dashboard-api.test.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createModelApiHandler } from '../../src/models/dashboard-api.js';
import { startHubServer } from '../../src/dashboard/hub.js';

const dirs: string[] = [];
const servers: Array<{ close(): void } | { close(): Promise<void> }> = [];

function freshDir(prefix = 'sbl-mapi-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const s of servers) await (s.close() as unknown as Promise<void>);
  servers.length = 0;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

function listen(cwd: string): Promise<{ port: number; server: Server }> {
  const handler = createModelApiHandler(cwd);
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  servers.push({ close: () => new Promise<void>((r) => server.close(() => r())) });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ port: addr !== null && typeof addr === 'object' ? addr.port : 0, server });
    });
  });
}

function call(
  port: number,
  path: string,
  method = 'GET',
): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const r = request(
      { host: '127.0.0.1', port, path, method, headers: { 'content-type': 'application/json' } },
      (res) => {
        let b = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => {
          b += c;
        });
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, json: JSON.parse(b) as Record<string, unknown> }),
        );
      },
    );
    r.on('error', reject);
    if (method === 'POST') r.write('{}');
    r.end();
  });
}

function configPath(cwd: string): string {
  return join(cwd, '.super-backlog', 'models.json');
}

describe('model dashboard api', () => {
  it('GET /api/models reports installed=false without a config file', async () => {
    const cwd = freshDir();
    const { port } = await listen(cwd);
    const res = await call(port, '/api/models');
    expect(res.status).toBe(200);
    expect(res.json['installed']).toBe(false);
  });

  it('POST /api/models/enable writes the config and returns it', async () => {
    const cwd = freshDir();
    const { port } = await listen(cwd);
    const res = await call(port, '/api/models/enable', 'POST');
    expect(res.status).toBe(200);
    expect(res.json['ok']).toBe(true);
    expect((res.json['config'] as Record<string, unknown>)['enabled']).toBe(true);
    expect(JSON.parse(readFileSync(configPath(cwd), 'utf8')).enabled).toBe(true);
    const after = await call(port, '/api/models');
    expect(after.json['installed']).toBe(true);
  });

  it('POST /api/models/disable flips enabled to false', async () => {
    const cwd = freshDir();
    mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
    writeFileSync(configPath(cwd), JSON.stringify({ version: 1, enabled: true }));
    const { port } = await listen(cwd);
    const res = await call(port, '/api/models/disable', 'POST');
    expect(res.status).toBe(200);
    expect((res.json['config'] as Record<string, unknown>)['enabled']).toBe(false);
    expect(JSON.parse(readFileSync(configPath(cwd), 'utf8')).enabled).toBe(false);
  });

  it('still 404s unknown model routes', async () => {
    const cwd = freshDir();
    const { port } = await listen(cwd);
    const r = request(
      { host: '127.0.0.1', port, path: '/api/models/nope', method: 'POST', headers: { 'content-type': 'application/json' } },
    );
    const status = await new Promise<number>((resolve, reject) => {
      r.on('response', (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      r.on('error', reject);
      r.end('{}');
    });
    expect(status).toBe(404);
  });

  it('hub-scoped enable writes into the registered project cwd', async () => {
    const cwd = freshDir('sbl-mapi-hub-');
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), 'project_name: ModelsProj\n');
    writeFileSync(join(cwd, 'dash.html'), '<html>x</html>');
    const hub = await startHubServer({ port: 0, token: 't' });
    servers.push(hub);
    const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    const res = await call(hub.port, `/p/${reg.slug}/api/models/enable`, 'POST');
    expect(res.status).toBe(200);
    expect(existsSync(configPath(cwd))).toBe(true);
  });
});
