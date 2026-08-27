// src/commands/uninstall.ts
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { findGitDir, POINTER_HEADING_RE } from '../init/execute.js';
import { atomicWrite } from '../lib/atomic.js';
import { GUARD_RE, REFRESH_RE, removeGuardHook, removeRefreshHook } from '../lib/hooks.js';
import { stripOwned } from '../lib/markers.js';
import { PLUGIN_SPEC } from '../lib/opencode.js';
import { isOwnedSkillFile } from '../lib/ownership.js';
import { WANTED_SCRIPTS, type PkgJson } from '../lib/pkgjson.js';
import { uninstallModelRouter } from '../models/uninstall.js';
import { promptYesNo, type ParsedArgs } from './init.js';

type Verdict = 'removed' | 'kept' | 'skipped' | 'error';

interface ReportLine {
  verdict: Verdict;
  label: string;
}

export interface UninstallDeps {
  /** Runs `npm uninstall -g super-backlog`; returns the exit status. */
  removeGlobal?: () => number;
  /** Consent callback for the global package removal. */
  confirm?: (question: string) => boolean;
}

const OWNED_SKILL_DIRS = [
  '.opencode/skill/spec-to-backlog',
  '.opencode/skill/backlog-status-report',
  '.opencode/skill/task-review-gate',
  '.claude/skills/spec-to-backlog',
  '.claude/skills/backlog-status-report',
  '.claude/skills/task-review-gate',
];

// ownership probe: the kit's generated dashboard carries both markers
function isKitDashboard(content: string): boolean {
  return content.includes('id="sbl-data"') && content.includes('super-backlog');
}

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function removePointerSection(content: string): { content: string; removed: boolean } {
  const lines = content.split('\n');
  const idx = lines.findIndex((line) => POINTER_HEADING_RE.test(line));
  if (idx === -1) return { content, removed: false };
  let end = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const kept = [...lines.slice(0, idx), ...lines.slice(end)];
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
  return { content: kept.length > 0 ? `${kept.join('\n')}\n` : '', removed: true };
}

function uninstallPackageJson(
  cwd: string,
  pkg: PkgJson | null,
  withBacklog: boolean,
  report: ReportLine[],
): void {
  const path = join(cwd, 'package.json');
  if (pkg === null) {
    for (const name of Object.keys(WANTED_SCRIPTS)) {
      report.push({ verdict: 'skipped', label: `npm script "${name}" (package.json not found)` });
    }
    for (const name of ['backlog.md', 'super-backlog']) {
      report.push({
        verdict: 'skipped',
        label: `devDependency "${name}" (package.json not found)`,
      });
    }
    return;
  }

  let changed = false;
  const hadScripts = pkg.scripts !== undefined;
  const scripts = { ...(pkg.scripts ?? {}) };
  for (const [name, wanted] of Object.entries(WANTED_SCRIPTS)) {
    if (!(name in scripts)) {
      report.push({ verdict: 'skipped', label: `npm script "${name}" (not defined)` });
    } else if (scripts[name] === wanted) {
      delete scripts[name];
      changed = true;
      report.push({ verdict: 'removed', label: `npm script "${name}"` });
    } else {
      report.push({
        verdict: 'kept',
        label: `npm script "${name}" (differs from kit default)`,
      });
    }
  }

  const hadDeps = pkg.devDependencies !== undefined;
  const devDependencies = { ...(pkg.devDependencies ?? {}) };
  for (const name of ['backlog.md', 'super-backlog']) {
    const spec = devDependencies[name];
    if (spec === undefined) {
      report.push({ verdict: 'skipped', label: `devDependency "${name}" (not present)` });
    } else if (withBacklog || spec === 'latest') {
      delete devDependencies[name];
      changed = true;
      report.push({ verdict: 'removed', label: `devDependency "${name}"` });
    } else {
      report.push({
        verdict: 'kept',
        label: `devDependency "${name}" pinned to ${spec} (use --with-backlog to force removal)`,
      });
    }
  }

  if (!changed) return;
  const next: PkgJson = { ...pkg };
  if (hadScripts || Object.keys(scripts).length > 0) next.scripts = scripts;
  if (hadDeps || Object.keys(devDependencies).length > 0) next.devDependencies = devDependencies;
  atomicWrite(path, prettyJson(next));
}

function uninstallPluginEntry(
  cwd: string,
  config: Record<string, unknown> | null,
  report: ReportLine[],
): void {
  const path = join(cwd, 'opencode.json');
  if (config === null) {
    report.push({ verdict: 'skipped', label: 'opencode.json plugin entry (file not found)' });
    return;
  }
  const raw = config.plugin;
  if (raw === undefined) {
    report.push({ verdict: 'skipped', label: 'opencode.json plugin entry (none)' });
    return;
  }
  const list: unknown[] = Array.isArray(raw) ? [...raw] : [raw];
  if (list.some((entry) => typeof entry === 'string' && entry === PLUGIN_SPEC)) {
    const rest = list.filter((entry) => !(typeof entry === 'string' && entry === PLUGIN_SPEC));
    if (rest.length === 0) delete config.plugin;
    else config.plugin = rest;
    atomicWrite(path, prettyJson(config));
    report.push({ verdict: 'removed', label: 'opencode.json plugin entry' });
  } else if (list.some((entry) => typeof entry === 'string' && entry.startsWith('superpowers@'))) {
    report.push({
      verdict: 'kept',
      label: 'opencode.json plugin entry (differs from kit default)',
    });
  } else {
    report.push({ verdict: 'skipped', label: 'opencode.json plugin entry (no kit entry)' });
  }
}

/** Probes for kit-owned artifacts that survived the uninstall. */
export function verifyRemnants(cwd: string): string[] {
  const remnants: string[] = [];

  const agentsPath = join(cwd, 'AGENTS.md');
  try {
    if (existsSync(agentsPath) && stripOwned(readFileSync(agentsPath, 'utf8')).removed) {
      remnants.push('AGENTS.md managed block');
    }
  } catch {
    remnants.push('AGENTS.md (unreadable)');
  }

  const claudePath = join(cwd, 'CLAUDE.md');
  try {
    if (existsSync(claudePath) && POINTER_HEADING_RE.test(readFileSync(claudePath, 'utf8'))) {
      remnants.push('CLAUDE.md pointer section');
    }
  } catch {
    remnants.push('CLAUDE.md (unreadable)');
  }

  for (const rel of OWNED_SKILL_DIRS) {
    const skillMd = join(cwd, ...rel.split('/'), 'SKILL.md');
    if (existsSync(skillMd) && isOwnedSkillFile(readFileSync(skillMd, 'utf8'))) {
      remnants.push(`${rel}/`);
    }
  }

  const ocPath = join(cwd, 'opencode.json');
  if (existsSync(ocPath)) {
    try {
      const config = JSON.parse(readFileSync(ocPath, 'utf8')) as Record<string, unknown>;
      const raw = config.plugin;
      const list: unknown[] = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
      if (list.some((entry) => typeof entry === 'string' && entry === PLUGIN_SPEC)) {
        remnants.push('opencode.json plugin entry');
      }
    } catch {
      // unparsable config was already reported during validation
    }
  }

  const gitDir = findGitDir(cwd);
  if (gitDir) {
    const pre = join(gitDir, 'hooks', 'pre-commit');
    if (existsSync(pre) && GUARD_RE.test(readFileSync(pre, 'utf8'))) {
      remnants.push('git pre-commit guard hook');
    }
    const post = join(gitDir, 'hooks', 'post-commit');
    if (existsSync(post) && REFRESH_RE.test(readFileSync(post, 'utf8'))) {
      remnants.push('git post-commit dashboard-refresh hook');
    }
  }

  const dashboardPath = join(cwd, 'dashboard.html');
  if (existsSync(dashboardPath) && isKitDashboard(readFileSync(dashboardPath, 'utf8'))) {
    remnants.push('dashboard.html');
  }

  return remnants;
}

function defaultRemoveGlobal(): number {
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(cmd, ['uninstall', '-g', 'super-backlog'], {
    encoding: 'utf8',
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  if (r.error) return 1;
  return r.status ?? 1;
}

export function runUninstall(cwd: string, args: ParsedArgs, deps: UninstallDeps = {}): number {
  const withBacklog = args.values['with-backlog'] === true;
  const fixAll = args.values['fix-all'] === true;
  const report: ReportLine[] = [];

  // A failing step must not abort the remaining steps: collect it as an error
  // line and continue. The JSON validation above stays fail-fast on purpose.
  const attempt = (label: string, fn: () => void): void => {
    try {
      fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      report.push({ verdict: 'error', label: `${label} (${msg})` });
    }
  };

  // validate both JSON files up front - no mutation happens unless parsing succeeds
  let pkg: PkgJson | null = null;
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PkgJson;
    } catch {
      console.error('error: package.json is not valid JSON - fix it manually, then re-run');
      return 1;
    }
  }
  let opencodeConfig: Record<string, unknown> | null = null;
  const ocPath = join(cwd, 'opencode.json');
  if (existsSync(ocPath)) {
    try {
      opencodeConfig = JSON.parse(readFileSync(ocPath, 'utf8')) as Record<string, unknown>;
    } catch {
      console.error('error: opencode.json is not valid JSON - fix it manually, then re-run');
      return 1;
    }
  }

  const agentsPath = join(cwd, 'AGENTS.md');
  attempt('AGENTS.md managed block', () => {
    if (!existsSync(agentsPath)) {
      report.push({ verdict: 'skipped', label: 'AGENTS.md managed block (file not found)' });
    } else {
      const stripped = stripOwned(readFileSync(agentsPath, 'utf8'));
      if (stripped.removed) {
        atomicWrite(agentsPath, stripped.content);
        report.push({ verdict: 'removed', label: 'AGENTS.md managed block' });
      } else {
        report.push({ verdict: 'skipped', label: 'AGENTS.md managed block (none found)' });
      }
    }
  });

  const claudePath = join(cwd, 'CLAUDE.md');
  attempt('CLAUDE.md pointer section', () => {
    if (!existsSync(claudePath)) {
      report.push({ verdict: 'skipped', label: 'CLAUDE.md pointer section (file not found)' });
    } else {
      const res = removePointerSection(readFileSync(claudePath, 'utf8'));
      if (res.removed) {
        atomicWrite(claudePath, res.content);
        report.push({ verdict: 'removed', label: 'CLAUDE.md pointer section' });
      } else {
        report.push({ verdict: 'skipped', label: 'CLAUDE.md pointer section (none found)' });
      }
    }
  });

  for (const rel of OWNED_SKILL_DIRS) {
    attempt(`${rel}/`, () => {
      const abs = join(cwd, ...rel.split('/'));
      const skillMd = join(abs, 'SKILL.md');
      if (!existsSync(skillMd)) {
        report.push(
          existsSync(abs)
            ? { verdict: 'kept', label: `${rel}/ (no SKILL.md - left untouched)` }
            : { verdict: 'skipped', label: `${rel}/ (not found)` },
        );
      } else if (isOwnedSkillFile(readFileSync(skillMd, 'utf8'))) {
        rmSync(abs, { recursive: true, force: true });
        report.push({ verdict: 'removed', label: `${rel}/` });
      } else {
        report.push({
          verdict: 'kept',
          label: `${rel}/ (SKILL.md not managed by super-backlog)`,
        });
      }
    });
  }

  attempt('package.json scripts/devDependencies', () => {
    uninstallPackageJson(cwd, pkg, withBacklog, report);
  });
  attempt('opencode.json plugin entry', () => {
    uninstallPluginEntry(cwd, opencodeConfig, report);
  });

  const gitDir = findGitDir(cwd);
  attempt('git pre-commit guard hook', () => {
    if (!gitDir) {
      report.push({ verdict: 'skipped', label: 'git pre-commit guard hook (no .git directory)' });
    } else if (!existsSync(join(gitDir, 'hooks', 'pre-commit'))) {
      report.push({ verdict: 'skipped', label: 'git pre-commit guard hook (not installed)' });
    } else if (removeGuardHook(gitDir)) {
      report.push({ verdict: 'removed', label: 'git pre-commit guard hook' });
    } else {
      report.push({
        verdict: 'kept',
        label: 'git pre-commit hook (no super-backlog guard block)',
      });
    }
  });

  attempt('git post-commit dashboard-refresh hook', () => {
    if (!gitDir) {
      report.push({ verdict: 'skipped', label: 'git post-commit dashboard-refresh hook (no .git directory)' });
    } else if (!existsSync(join(gitDir, 'hooks', 'post-commit'))) {
      report.push({ verdict: 'skipped', label: 'git post-commit dashboard-refresh hook (not installed)' });
    } else if (removeRefreshHook(gitDir)) {
      report.push({ verdict: 'removed', label: 'git post-commit dashboard-refresh hook' });
    } else {
      report.push({
        verdict: 'kept',
        label: 'git post-commit hook (no super-backlog dashboard-refresh block)',
      });
    }
  });

  const dashboardPath = join(cwd, 'dashboard.html');
  attempt('dashboard.html', () => {
    if (!existsSync(dashboardPath)) {
      report.push({ verdict: 'skipped', label: 'dashboard.html (not found)' });
    } else if (isKitDashboard(readFileSync(dashboardPath, 'utf8'))) {
      rmSync(dashboardPath);
      report.push({ verdict: 'removed', label: 'dashboard.html' });
    } else {
      report.push({ verdict: 'kept', label: 'dashboard.html (not generated by super-backlog)' });
    }
  });

  let dataDeleted = false;
  const backlogDir = join(cwd, 'backlog');
  attempt('backlog/ (project task data)', () => {
    if (!existsSync(backlogDir)) {
      report.push({ verdict: 'skipped', label: 'backlog/ (not found)' });
    } else if (withBacklog) {
      rmSync(backlogDir, { recursive: true, force: true });
      dataDeleted = true;
      report.push({ verdict: 'removed', label: 'backlog/ (project task data)' });
    } else {
      report.push({
        verdict: 'kept',
        label: 'backlog/ (project task data preserved - pass --with-backlog to delete)',
      });
    }
  });

  attempt('model router', () => {
    uninstallModelRouter(cwd, report);
  });

  console.log('super-backlog uninstall');
  for (const line of report) console.log(`${line.verdict}: ${line.label}`);
  if (dataDeleted) {
    console.log('');
    console.log('============================================================');
    console.log('DATA DELETED: the backlog/ directory (project task data)');
    console.log('was permanently removed. This cannot be undone.');
    console.log('============================================================');
  }

  // verification pass: prove nothing kit-owned survives (or say what does)
  const remnants = verifyRemnants(cwd);
  if (remnants.length === 0) {
    console.log('verification: clean');
  } else {
    console.log('verification: leftover kit artifacts');
    for (const remnant of remnants) console.log(`  - ${remnant}`);
  }

  // global self-removal as the very last step
  const removeGlobal = deps.removeGlobal ?? defaultRemoveGlobal;
  const confirm = deps.confirm ?? promptYesNo;
  let removalFailed = false;
  if (fixAll || confirm('Remove the global super-backlog npm package as well?')) {
    const status = removeGlobal();
    if (status !== 0) {
      removalFailed = true;
      console.log('error: global package removal failed');
      console.log('       manual: npm uninstall -g super-backlog');
    } else {
      console.log('removed: global npm package super-backlog');
    }
  } else {
    console.log('note: global npm package kept - remove it with: npm uninstall -g super-backlog');
  }

  const hadError = report.some((line) => line.verdict === 'error');
  return hadError || removalFailed ? 1 : 0;
}
