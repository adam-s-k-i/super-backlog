#!/usr/bin/env node
// scripts/capture-dashboard.mjs
// Regenerates docs/assets/dashboard.png from a curated demo dataset so the
// README screenshot always shows the current dashboard design with clean,
// illustrative example data.
//
// How: a temp project ("acme-webshop") gets a fake backlog bin that answers
// `backlog task list --json` with curated demo tasks (relative dates, so the
// activity calendar heatmap always looks alive). The real collector + renderer
// turn that into dashboard.html, and a headless browser (Edge on Windows,
// Chrome/Chromium on Linux) captures the screenshot.
//
// Usage: npm run screenshot   (build first: npm run build)

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectDashboardData } from '../dist/dashboard/data.js';
import { renderDashboard } from '../dist/dashboard/render.js';
import { KIT_VERSION } from '../dist/lib/version.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPng = join(root, 'docs', 'assets', 'dashboard.png');

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function demoTasks() {
  const t = (id, title, status, extra = {}) => ({
    id,
    title,
    status,
    created_at: isoDaysAgo(21),
    updated_at: isoDaysAgo(extra.updatedDaysAgo ?? 2),
    ...extra,
  });
  return [
    t('TASK-1', 'Set up storefront shell and routing', 'Done', { milestone: 'm-1', updatedDaysAgo: 14 }),
    t('TASK-2', 'Product catalog with search and filters', 'Done', {
      milestone: 'm-1',
      updatedDaysAgo: 11,
      acceptance_criteria: [{ text: 'Search returns matches by title and SKU', checked: true }, { text: 'Filters combine without full reload', checked: true }],
    }),
    t('TASK-3', 'Cart with persistent state', 'Done', { milestone: 'm-1', updatedDaysAgo: 9, deps: ['TASK-2'] }),
    t('TASK-4', 'Checkout flow: address, payment, confirmation', 'In Progress', {
      milestone: 'm-1',
      updatedDaysAgo: 1,
      deps: ['TASK-3'],
      acceptance_criteria: [{ text: 'Payment succeeds with test card', checked: true }, { text: 'Failed payment shows recoverable error', checked: false }, { text: 'Confirmation mail is queued', checked: false }],
    }),
    t('TASK-5', 'Order history for registered customers', 'To Do', { milestone: 'm-1', updatedDaysAgo: 4, deps: ['TASK-4'] }),
    t('TASK-6', 'Admin: manage inventory levels', 'In Progress', { milestone: 'm-2', updatedDaysAgo: 2 }),
    t('TASK-7', 'Admin: sales dashboard with daily revenue', 'To Do', { milestone: 'm-2', updatedDaysAgo: 6, deps: ['TASK-6'] }),
    t('TASK-8', 'Rate-limit public API endpoints', 'To Do', { updatedDaysAgo: 13 }),
    t('TASK-9', 'Lighthouse performance pass on catalog pages', 'To Do', { updatedDaysAgo: 17 }),
    t('TASK-10', 'Write customer-facing help pages', 'Done', { updatedDaysAgo: 3 }),
  ];
}

function writeDemoProject() {
  const parent = mkdtempSync(join(tmpdir(), 'sbl-shot-'));
  const proj = join(parent, 'acme-webshop');
  const binDir = join(proj, 'node_modules', '.bin');
  mkdirSync(binDir, { recursive: true });

  const tasksJson = JSON.stringify({ tasks: demoTasks() });
  writeFileSync(join(binDir, 'tasks.json'), tasksJson);

  const isWin = process.platform === 'win32';
  const shim = join(binDir, isWin ? 'backlog.cmd' : 'backlog');
  writeFileSync(
    shim,
    isWin ? '@echo off\r\n@type "%~dp0tasks.json"\r\n' : '#!/bin/sh\ncat "$(dirname "$0")/tasks.json"\n',
    { mode: 0o755 },
  );
  return { parent, proj };
}

function findBrowser() {
  const candidates =
    process.platform === 'win32'
      ? [
          join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

const { parent, proj } = writeDemoProject();
try {
  const data = collectDashboardData(proj, { kitVersion: KIT_VERSION });
  if (data.tasks.length === 0) {
    console.error('error: demo shim produced no tasks - screenshot aborted');
    process.exit(1);
  }
  const html = renderDashboard(data);
  const htmlPath = join(parent, 'dashboard.html');
  writeFileSync(htmlPath, html);

  const browser = findBrowser();
  if (!browser) {
    console.error('error: no headless browser found (Edge on Windows, Chrome/Chromium on Linux)');
    process.exit(1);
  }
  const url = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const shot = spawnSync(
    browser,
    ['--headless', '--disable-gpu', '--hide-scrollbars', '--window-size=1600,1100', '--virtual-time-budget=4000', `--screenshot=${outPng}`, url],
    { encoding: 'utf8', timeout: 60000 },
  );
  if (shot.status !== 0 || !existsSync(outPng)) {
    console.error(`error: screenshot failed: ${shot.stderr || shot.stdout || 'no output file'}`);
    process.exit(1);
  }
  console.log(`docs/assets/dashboard.png refreshed (${(statSync(outPng).size / 1024).toFixed(1)} KB, ${data.tasks.length} demo tasks, project "${data.project.name}")`);
} finally {
  rmSync(parent, { recursive: true, force: true });
}
