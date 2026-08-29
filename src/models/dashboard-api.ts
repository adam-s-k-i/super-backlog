// src/models/dashboard-api.ts
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { loadConfig } from './config.js';
import { discoverModels } from './discovery.js';
import { writeRouterConfig } from './install.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function routerInstalled(cwd: string): boolean {
  return existsSync(join(cwd, '.super-backlog', 'models.json'));
}

export function createModelApiHandler(cwd: string): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && url === '/api/models') {
      sendJson(res, 200, { config: loadConfig(cwd), installed: routerInstalled(cwd), status: 'ok' });
      return;
    }

    if (method === 'POST' && (url === '/api/models/enable' || url === '/api/models/disable')) {
      const enabled = url === '/api/models/enable';
      try {
        writeRouterConfig(cwd, enabled);
        sendJson(res, 200, { ok: true, config: loadConfig(cwd), installed: routerInstalled(cwd) });
      } catch (err) {
        sendJson(res, 500, { ok: false, message: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    if (method === 'POST' && url === '/api/models/discover') {
      const result = await discoverModels(cwd);
      sendJson(res, 200, result ?? { error: 'discovery failed' });
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  };
}
