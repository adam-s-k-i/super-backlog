// src/models/dashboard-api.ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import process from 'node:process';
import { loadConfig } from './config.js';
import { discoverModels } from './discovery.js';

function currentCwd(): string {
  try {
    return process.cwd();
  } catch {
    return '.';
  }
}

export function createModelApiHandler(): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && url === '/api/models') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ config: loadConfig(currentCwd()), status: 'ok' }));
      return;
    }

    if (method === 'POST' && url === '/api/models/discover') {
      const result = await discoverModels(currentCwd());
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result ?? { error: 'discovery failed' }));
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  };
}
