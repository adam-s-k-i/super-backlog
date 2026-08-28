#!/usr/bin/env node
// scripts/generate-dashboard.mjs
// Internal helper for the Pages CI: writes a static docs/public/dashboard.html
// from the real repo backlog data. This is NOT exposed to end users; `sbl dashboard`
// is serve-only.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectDashboardData } from '../dist/dashboard/data.js';
import { renderDashboard } from '../dist/dashboard/render.js';
import { KIT_VERSION } from '../dist/lib/version.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs', 'public');
const outPath = join(outDir, 'dashboard.html');

mkdirSync(outDir, { recursive: true });
const data = collectDashboardData(root, { kitVersion: KIT_VERSION });
writeFileSync(outPath, renderDashboard(data));
console.log(`dashboard written: ${outPath}`);
