// src/models/dashboard-api.ts
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { KIT_VERSION } from '../lib/version.js';
import { applyRouter } from './apply.js';
import { effectiveTiers, loadConfig } from './config.js';
import { CONFIG_PATH } from './defaults.js';
import { discoverModels } from './discovery.js';
import { saveDiscovery, setRouterEnabled } from './install.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function snapshot(cwd: string) {
  const config = loadConfig(cwd);
  return { config, tiers: effectiveTiers(config), installed: existsSync(join(cwd, CONFIG_PATH)) };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface ModelApiDeps {
  discover?: typeof discoverModels;
}

export function createModelApiHandler(
  cwd: string,
  deps: ModelApiDeps = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const discover = deps.discover ?? discoverModels;
  return async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && url === '/api/models') {
      sendJson(res, 200, { ...snapshot(cwd), status: 'ok' });
      return;
    }

    if (method === 'POST' && (url === '/api/models/enable' || url === '/api/models/disable')) {
      const enabled = url === '/api/models/enable';
      try {
        setRouterEnabled(cwd, enabled);
        applyRouter(cwd, { install: enabled, block: true, version: KIT_VERSION });
        sendJson(res, 200, { ok: true, ...snapshot(cwd) });
      } catch (err) {
        sendJson(res, 500, { ok: false, message: errorMessage(err) });
      }
      return;
    }

    if (method === 'POST' && url === '/api/models/discover') {
      const result = await discover(cwd);
      if (!result) {
        sendJson(res, 200, { ok: false, error: 'discovery failed' });
        return;
      }
      try {
        saveDiscovery(cwd, result.discoveredAt, result.tiers);
        applyRouter(cwd, { install: false, block: true, version: KIT_VERSION });
        sendJson(res, 200, { ok: true, ...snapshot(cwd) });
      } catch (err) {
        sendJson(res, 500, { ok: false, message: errorMessage(err) });
      }
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  };
}
