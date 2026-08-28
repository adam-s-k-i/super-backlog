// src/commands/dashboard.ts
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { collectDashboardData } from '../dashboard/data.js';
import { renderDashboard } from '../dashboard/render.js';
import { DASHBOARD_PORT, startServeServer } from '../dashboard/server.js';
import { atomicWrite } from '../lib/atomic.js';
import { resolveBacklogBin } from '../lib/run.js';
import { KIT_VERSION } from '../lib/version.js';
import type { ParsedArgs } from './init.js';

async function regenerateInto(outPath: string, cwd: string): Promise<void> {
  const data = collectDashboardData(cwd, { kitVersion: KIT_VERSION });
  atomicWrite(outPath, renderDashboard(data));
}

function spawnBacklogBrowser(cwd: string): void {
  const bin = resolveBacklogBin(cwd);
  if (!bin) {
    console.warn('warning: backlog CLI not found; dashboard will serve without the Backlog browser');
    return;
  }
  try {
    const child = spawn(bin, ['browser', '--no-open', '--non-interactive'], {
      cwd,
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.on('error', () => {});
    child.unref();
    console.log('started Backlog browser (dashboard still serves if browser fails)');
  } catch {
    console.warn('warning: failed to start Backlog browser; dashboard still serves');
  }
}

/** CLI entry for `sbl dashboard [--port N] [--no-open]`. Starts a local server
 * that watches backlog/ and regenerates a temp dashboard file on changes. */
export async function runDashboard(cwd: string, args: ParsedArgs): Promise<number> {
  const values = args.values;

  let port = DASHBOARD_PORT;
  if (values['port'] !== undefined) {
    const parsed = Number(values['port']);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
      console.error(`error: invalid --port "${String(values['port'])}" (expected 0-65535)`);
      return 1;
    }
    port = parsed;
  }

  const noOpen = values['no-open'] === true;
  const outPath = join(tmpdir(), `sbl-dashboard-${Date.now()}.html`);

  try {
    await regenerateInto(outPath, cwd);
    console.log(`dashboard written: ${outPath}`);
    console.log(`serving dashboard at http://127.0.0.1:${port}/ (press Ctrl+C to stop)`);

    // Start backlog browser in parallel; don't await so the dashboard server can listen immediately.
    spawnBacklogBrowser(cwd);

    await startServeServer(cwd, {
      port,
      file: outPath,
      regenerate: () => regenerateInto(outPath, cwd),
      openBrowser: !noOpen,
    });
    return 0;
  } catch (err) {
    console.error(`error: dashboard serve failed (${err instanceof Error ? err.message : String(err)})`);
    return 1;
  }
}
