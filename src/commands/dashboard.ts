// src/commands/dashboard.ts
import { join } from 'node:path';

import { collectDashboardData } from '../dashboard/data.js';
import { renderDashboard } from '../dashboard/render.js';
import { atomicWrite } from '../lib/atomic.js';
import { KIT_VERSION } from '../lib/version.js';

const DASHBOARD_PORT = 6428;

async function regenerateInto(outPath: string, cwd: string): Promise<void> {
  const data = collectDashboardData(cwd, { kitVersion: KIT_VERSION });
  atomicWrite(outPath, renderDashboard(data));
}

/**
 * Generate dashboard.html for the project; with `{ serve: true }`, start the
 * live-reload server afterwards (the listening socket keeps the process up).
 * Called by `sbl init` with serve disabled.
 */
export async function generateDashboard(cwd: string, o: { serve: boolean }): Promise<string> {
  const outPath = join(cwd, 'dashboard.html');
  await regenerateInto(outPath, cwd);
  if (o.serve) {
    // Dynamic import keeps init resilient if the serve module is unavailable.
    const specifier = '../dashboard/server.js';
    const mod = (await import(specifier)) as {
      startServeServer?: (cwd: string, opts: Record<string, unknown>) => Promise<unknown>;
    };
    if (typeof mod.startServeServer !== 'function') {
      throw new Error('serve module does not export startServeServer');
    }
    await mod.startServeServer(cwd, {
      port: DASHBOARD_PORT,
      regenerate: () => regenerateInto(outPath, cwd),
      openBrowser: true,
    });
  }
  return outPath;
}
