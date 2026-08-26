// src/dashboard/regen.ts
// Standalone regeneration entry invoked by the post-commit freshness hook:
//   node "<repo>/node_modules/super-backlog/dist/dashboard/regen.js"
// Contract: never throw, never exit non-zero - a broken dashboard generation
// must never block or fail a user's commit. All errors go to console.error.
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import { collectDashboardData } from './data.js';
import { renderDashboard } from './render.js';
import { atomicWrite } from '../lib/atomic.js';
import { KIT_VERSION } from '../lib/version.js';

/** Regenerate <cwd>/dashboard.html. Throws on failure; the direct-run wrapper swallows. */
export function regenerateDashboard(cwd: string): void {
  const html = renderDashboard(collectDashboardData(cwd, { kitVersion: KIT_VERSION }));
  atomicWrite(join(cwd, 'dashboard.html'), html);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    regenerateDashboard(process.cwd());
  } catch (err) {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  }
  process.exit(0); // always - success or failure
}
