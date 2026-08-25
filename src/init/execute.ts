// src/init/execute.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { atomicWrite } from '../lib/atomic.js';
import { installGuardHook } from '../lib/hooks.js';
import { injectBlock } from '../lib/markers.js';
import { applyPluginEntry } from '../lib/opencode.js';
import { OwnershipError, renderSkill } from '../lib/ownership.js';
import {
  addDevDependencies,
  mergeScripts,
  WANTED_DEVS,
  WANTED_SCRIPTS,
  type PkgJson,
} from '../lib/pkgjson.js';
import { installCmdsFor, type PM } from '../lib/pm.js';
import { resolveBacklogBin, runCapture } from '../lib/run.js';
import { agentsBlockContents, type Action, type JsonOp, type UpstreamOp } from './planner.js';

export class UpstreamError extends Error {}
export class RefusalError extends Error {}

export interface ExecuteContext {
  version: string;
  projectName: string;
  hasBacklogConfig: boolean;
}

export interface ExecuteResult {
  applied: number;
  skipped: number;
  warnings: string[];
}

const UPSTREAM_PKGS = ['backlog.md@latest', 'super-backlog@latest'];
const POINTER_HEADING_RE = /Workflow system \(managed by super-backlog\)/;

export function findGitDir(startDir: string): string | null {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, '.git');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readTemplate(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url)); // src/init at dev time, dist/init at runtime
  const candidates = [join(here, '..', 'templates', name), join(here, 'templates', name)];
  for (const c of candidates) if (existsSync(c)) return readFileSync(c, 'utf8');
  throw new Error(`template not found: ${name}`);
}

function readTextIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function skipInstallEnv(): boolean {
  const v = process.env.SBL_SKIP_INSTALL;
  return v !== undefined && v !== '';
}

function fabricateBacklogConfig(cwd: string, projectName: string): void {
  atomicWrite(join(cwd, 'backlog', 'config.yml'), `project_name: ${projectName}\n`);
}

function runUpstreamInstall(cwd: string, op: UpstreamOp, ctx: ExecuteContext): void {
  if (op.pm === 'none') throw new UpstreamError('cannot install dependencies without a package manager');
  if (skipInstallEnv()) {
    fabricateBacklogConfig(cwd, ctx.projectName);
    return;
  }
  const { cmd, args } = installCmdsFor(op.pm as PM, UPSTREAM_PKGS);
  const inst = runCapture(cmd, args, cwd);
  if (inst.status !== 0) {
    throw new UpstreamError(
      `\`${cmd} ${args.join(' ')}\` failed with exit code ${inst.status}${inst.stderr.trim() ? `:\n${inst.stderr.trim()}` : ''}`,
    );
  }
  if (ctx.hasBacklogConfig) return;
  const bin = resolveBacklogBin(cwd);
  if (!bin) throw new UpstreamError('backlog binary not found after dependency installation');
  const init = runCapture(bin, ['init', ctx.projectName, '--defaults', '--agent-instructions', 'none'], cwd);
  if (init.status !== 0) {
    throw new UpstreamError(
      `\`${bin} init\` failed with exit code ${init.status}${init.stderr.trim() ? `:\n${init.stderr.trim()}` : ''}`,
    );
  }
}

function parseJsonFile(path: string, label: string): unknown {
  const raw = readTextIfExists(path);
  if (raw === null || raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new RefusalError(`${label} is not valid JSON - fix it manually, then re-run`);
  }
}

function applyMergeJson(cwd: string, op: JsonOp): boolean {
  if (op.path === 'package.json') {
    const path = join(cwd, 'package.json');
    const pkg = parseJsonFile(path, 'package.json') as PkgJson;
    const merged = addDevDependencies(mergeScripts(pkg, WANTED_SCRIPTS).pkg, WANTED_DEVS).pkg;
    const next = prettyJson(merged);
    if (readTextIfExists(path) === next) return false;
    atomicWrite(path, next);
    return true;
  }
  const path = join(cwd, 'opencode.json');
  let result: { config: Record<string, unknown>; changed: boolean };
  try {
    result = applyPluginEntry(parseJsonFile(path, 'opencode.json'));
  } catch (err) {
    if (err instanceof OwnershipError) throw new RefusalError(err.message);
    throw err;
  }
  if (!result.changed) return false;
  atomicWrite(path, prettyJson(result.config));
  return true;
}

function applyInjectAgentsBlock(cwd: string, ctx: ExecuteContext): boolean {
  const path = join(cwd, 'AGENTS.md');
  const current = readTextIfExists(path) ?? '';
  const injected = injectBlock(current, ctx.version, agentsBlockContents(ctx.version));
  if (injected.action === 'unchanged') return false;
  atomicWrite(path, injected.content);
  return true;
}

function applyClaudePointer(cwd: string): boolean {
  const path = join(cwd, 'CLAUDE.md');
  const current = readTextIfExists(path) ?? '';
  if (POINTER_HEADING_RE.test(current)) return false;
  let template = readTemplate('claude-pointer.md');
  if (!template.endsWith('\n')) template += '\n';
  const sep = current.length === 0 ? '' : current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  atomicWrite(path, current + sep + template);
  return true;
}

function applyCopySkills(cwd: string, version: string): boolean {
  const rendered = renderSkill(readTemplate('skill-spec-to-backlog.md'), version);
  atomicWrite(join(cwd, '.opencode', 'skill', 'spec-to-backlog', 'SKILL.md'), rendered);
  atomicWrite(join(cwd, '.claude', 'skills', 'spec-to-backlog', 'SKILL.md'), rendered);
  return true;
}

async function applyGenerateDashboard(cwd: string, warnings: string[]): Promise<boolean> {
  try {
    // Non-literal specifier: the dashboard module lands in a later batch; a missing
    // module must degrade to a warning here, never crash init.
    const specifier = '../commands/dashboard.js';
    const mod = (await import(specifier)) as {
      generateDashboard?: (cwd: string, opts: { serve: boolean }) => unknown;
    };
    if (typeof mod.generateDashboard !== 'function') {
      throw new Error('dashboard module does not export generateDashboard');
    }
    await mod.generateDashboard(cwd, { serve: false });
  } catch (err) {
    warnings.push(`dashboard generation skipped (${err instanceof Error ? err.message : String(err)})`);
  }
  return true;
}

export async function executeActions(
  cwd: string,
  actions: Action[],
  ctx: ExecuteContext,
): Promise<ExecuteResult> {
  const warnings: string[] = [];
  let applied = 0;
  let skipped = 0;

  for (const action of actions) {
    switch (action.kind) {
      case 'upstream-install':
        runUpstreamInstall(cwd, action, ctx);
        applied++;
        break;
      case 'merge-json':
        applyMergeJson(cwd, action) ? applied++ : skipped++;
        break;
      case 'inject-agents-block':
        applyInjectAgentsBlock(cwd, ctx) ? applied++ : skipped++;
        break;
      case 'write-claude-pointer':
        applyClaudePointer(cwd) ? applied++ : skipped++;
        break;
      case 'copy-skills':
        applyCopySkills(cwd, ctx.version) ? applied++ : skipped++;
        break;
      case 'install-guard-hook': {
        const gitDir = findGitDir(cwd);
        if (!gitDir) {
          warnings.push('no .git directory found - guard hook not installed');
          skipped++;
        } else {
          installGuardHook(gitDir, ctx.version);
          applied++;
        }
        break;
      }
      case 'generate-dashboard':
        (await applyGenerateDashboard(cwd, warnings)) ? applied++ : skipped++;
        break;
      case 'write':
        atomicWrite(join(cwd, action.path), action.contents);
        applied++;
        break;
    }
  }

  return { applied, skipped, warnings };
}
