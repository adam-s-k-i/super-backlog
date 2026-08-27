// src/models/uninstall.ts
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../lib/atomic.js';

const ROUTER_FILES = [
  '.super-backlog/models.json',
  '.opencode/plugins/sbl-model-router.js',
  '.opencode/agents/sbl-worker.md',
  '.opencode/agents/sbl-worker-cheap.md',
  '.claude/agents/sbl-worker.md',
  '.claude/agents/sbl-worker-cheap.md',
];

type ReportLine = { verdict: 'removed' | 'kept' | 'skipped' | 'error'; label: string };

export function uninstallModelRouter(cwd: string, report: ReportLine[]): void {
  for (const rel of ROUTER_FILES) {
    const abs = join(cwd, rel);
    if (!existsSync(abs)) {
      report.push({ verdict: 'skipped', label: `${rel} (not found)` });
      continue;
    }
    rmSync(abs, { force: true });
    report.push({ verdict: 'removed', label: rel });
  }

  // Remove .super-backlog directory if it is now empty
  const dir = join(cwd, '.super-backlog');
  if (existsSync(dir)) {
    try {
      const remaining = readdirSync(dir);
      if (remaining.length === 0) {
        rmSync(dir, { recursive: true, force: true });
        report.push({ verdict: 'removed', label: '.super-backlog/' });
      } else {
        report.push({ verdict: 'kept', label: '.super-backlog/ (contains other files)' });
      }
    } catch {
      // ignore race conditions
    }
  }

  uninstallClaudeSettingsHook(cwd, report);
}

function uninstallClaudeSettingsHook(cwd: string, report: ReportLine[]): void {
  const path = join(cwd, '.claude', 'settings.json');
  if (!existsSync(path)) {
    report.push({ verdict: 'skipped', label: '.claude/settings.json model-router hook (not found)' });
    return;
  }
  let settings: { hooks?: { SessionStart?: unknown } };
  try {
    settings = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    report.push({ verdict: 'skipped', label: '.claude/settings.json (not valid JSON)' });
    return;
  }
  const before = JSON.stringify(settings);
  const sessionStart = settings.hooks?.SessionStart;
  if (!Array.isArray(sessionStart) || sessionStart.length === 0) {
    report.push({ verdict: 'skipped', label: '.claude/settings.json SessionStart hook (none)' });
    return;
  }
  const filtered = sessionStart.filter((entry) => {
    const hooks = (entry as { hooks?: unknown[] }).hooks;
    if (!Array.isArray(hooks)) return true;
    return !hooks.some(
      (h) =>
        typeof h === 'object' &&
        h !== null &&
        (h as { type?: string; args?: unknown[] }).type === 'command' &&
        Array.isArray((h as { args?: unknown[] }).args) &&
        String((h as { args?: unknown[] }).args?.[0] ?? '').includes('cc-session-hook.js'),
    );
  });
  if (filtered.length === sessionStart.length) {
    report.push({ verdict: 'skipped', label: '.claude/settings.json SessionStart hook (none owned)' });
    return;
  }
  if (filtered.length === 0) {
    delete settings.hooks!.SessionStart;
    if (Object.keys(settings.hooks ?? {}).length === 0) delete settings.hooks;
  } else {
    settings.hooks!.SessionStart = filtered;
  }
  if (JSON.stringify(settings) !== before) {
    atomicWrite(path, `${JSON.stringify(settings, null, 2)}\n`);
    report.push({ verdict: 'removed', label: '.claude/settings.json SessionStart hook' });
  } else {
    report.push({ verdict: 'skipped', label: '.claude/settings.json SessionStart hook (none owned)' });
  }
}
