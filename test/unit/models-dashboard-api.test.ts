// test/unit/models-dashboard-api.test.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { startHubServer } from '../../src/dashboard/hub.js';
import { injectBlock } from '../../src/lib/markers.js';
import { KIT_VERSION } from '../../src/lib/version.js';
import { createModelApiHandler, type ModelApiDeps } from '../../src/models/dashboard-api.js';

const dirs: string[] = [];
const servers: Array<{ close(): void } | { close(): Promise<void> }> = [];
const TIERS = ['light', 'standard', 'strong', 'top'];

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

function listen(cwd: string, deps: ModelApiDeps = {}): Promise<{ port: number; server: Server }> {
  const handler = createModelApiHandler(cwd, deps);
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

type Tiers = { claude: Record<string, string>; opencode: Record<string, string> };

describe('model dashboard api', () => {
  it('GET /api/models reports installed=false and the default tiers without a config file', async () => {
    const cwd = freshDir();
    const { port } = await listen(cwd);
    const res = await call(port, '/api/models');
    expect(res.status).toBe(200);
    expect(res.json['installed']).toBe(false);
    expect(res.json['config']).toEqual({ version: 2, enabled: false, tiers: {} });
    expect(res.json['tiers']).toEqual({ claude: { light: 'haiku', standard: 'sonnet', strong: 'opus', top: 'fable' }, opencode: {} });
  });

  it('POST /api/models/enable writes the config and installs the agents', async () => {
    const cwd = freshDir();
    const { port } = await listen(cwd);
    const res = await call(port, '/api/models/enable', 'POST');
    expect(res.status).toBe(200);
    expect(res.json['ok']).toBe(true);
    expect((res.json['config'] as Record<string, unknown>)['enabled']).toBe(true);
    expect(JSON.parse(readFileSync(configPath(cwd), 'utf8')).enabled).toBe(true);
    for (const t of TIERS) {
      expect(existsSync(join(cwd, `.claude/agents/sbl-${t}.md`))).toBe(true);
      expect(existsSync(join(cwd, `.opencode/agents/sbl-${t}.md`))).toBe(true);
    }
    const after = await call(port, '/api/models');
    expect(after.json['installed']).toBe(true);
  });

  it('POST /api/models/disable migrates a v1 file and flips enabled to false', async () => {
    const cwd = freshDir();
    mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
    writeFileSync(configPath(cwd), JSON.stringify({ version: 1, enabled: true, individual: { budget: 'x/cheap' } }));
    const { port } = await listen(cwd);
    const res = await call(port, '/api/models/disable', 'POST');
    expect(res.status).toBe(200);
    expect((res.json['config'] as Record<string, unknown>)['enabled']).toBe(false);
    expect((res.json['tiers'] as Tiers).opencode['light']).toBe('x/cheap');
    expect(JSON.parse(readFileSync(configPath(cwd), 'utf8'))).toEqual({
      version: 2,
      enabled: false,
      tiers: { opencode: { light: 'x/cheap' } },
    });
  });

  it('persists discovered tiers and writes them into installed agents', async () => {
    const cwd = freshDir('sbl-mapi-disc-');
    mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
    writeFileSync(configPath(cwd), JSON.stringify({ version: 2, enabled: true, tiers: {} }));
    mkdirSync(join(cwd, '.opencode', 'agents'), { recursive: true });
    writeFileSync(join(cwd, '.opencode', 'agents', 'sbl-light.md'), '---\nname: sbl-light\nmode: subagent\n---\nbody\n');
    const { port } = await listen(cwd, {
      discover: async () => ({ discoveredAt: '2026-10-11T08:00:00.000Z', tiers: { standard: 'model-w', light: 'model-b' } }),
    });
    const res = await call(port, '/api/models/discover', 'POST');
    expect(res.status).toBe(200);
    expect(res.json['ok']).toBe(true);
    expect((res.json['tiers'] as Tiers).opencode).toEqual({ light: 'model-b', standard: 'model-w' });
    const persisted = JSON.parse(readFileSync(configPath(cwd), 'utf8'));
    expect(persisted.tiers.opencode).toEqual({ light: 'model-b', standard: 'model-w' });
    expect(persisted.discoveredAt).toBe('2026-10-11T08:00:00.000Z');
    expect(readFileSync(join(cwd, '.opencode', 'agents', 'sbl-light.md'), 'utf8')).toContain('\nmodel: model-b\n');
    const info = await call(port, '/api/models');
    expect((info.json['config'] as { tiers: { opencode: Record<string, string> } }).tiers.opencode['standard']).toBe('model-w');
  });

  it('reports a failed discovery without writing', async () => {
    const cwd = freshDir();
    const { port } = await listen(cwd, { discover: async () => null });
    const res = await call(port, '/api/models/discover', 'POST');
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: false, error: 'discovery failed' });
    expect(existsSync(configPath(cwd))).toBe(false);
  });

  it('re-renders the managed block on enable', async () => {
    const cwd = freshDir();
    writeFileSync(join(cwd, 'AGENTS.md'), injectBlock('', '0.0.1', 'old body').content);
    const { port } = await listen(cwd);
    await call(port, '/api/models/enable', 'POST');
    const agents = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
    expect(agents).toContain(`<!-- SUPER-BACKLOG:${KIT_VERSION} START -->`);
    expect(agents).toContain('Examples (from `.super-backlog/models.json`; change them with');
  });

  it('returns 500 with a message when the config cannot be written', async () => {
    const cwd = freshDir('sbl-mapi-err-');
    writeFileSync(join(cwd, '.super-backlog'), 'a file blocking the config dir');
    const { port } = await listen(cwd);
    const res = await call(port, '/api/models/enable', 'POST');
    expect(res.status).toBe(500);
    expect(res.json['ok']).toBe(false);
    expect(typeof res.json['message']).toBe('string');
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
