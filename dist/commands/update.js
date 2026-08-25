// src/commands/update.ts
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import { executeActions, findGitDir, RefusalError, UpstreamError } from '../init/execute.js';
import { planInit } from '../init/planner.js';
import { GUARD_RE } from '../lib/hooks.js';
import { detectPackageManager } from '../lib/pm.js';
import { resolveBacklogBin, runCapture } from '../lib/run.js';
import { KIT_VERSION } from '../lib/version.js';
const REFRESH_KINDS = new Set([
    'inject-agents-block',
    'write-claude-pointer',
    'copy-skills',
    'install-guard-hook',
    'generate-dashboard',
]);
export function refreshActions(all) {
    return all.filter((action) => REFRESH_KINDS.has(action.kind));
}
function firstLine(text) {
    return text.trim().split(/\r?\n/)[0] ?? '';
}
function guardHookInstalled(cwd) {
    const gitDir = findGitDir(cwd);
    if (!gitDir)
        return false;
    const hookPath = join(gitDir, 'hooks', 'pre-commit');
    if (!existsSync(hookPath))
        return false;
    return GUARD_RE.test(readFileSync(hookPath, 'utf8'));
}
export async function runUpdate(cwd, _args) {
    const state = {
        cwd,
        detectedPm: detectPackageManager(cwd),
        hasBacklogConfig: existsSync(join(cwd, 'backlog', 'config.yml')),
        agentsExists: existsSync(join(cwd, 'AGENTS.md')),
        claudeMdExists: existsSync(join(cwd, 'CLAUDE.md')),
        opencodeConfig: undefined,
        pkgExists: existsSync(join(cwd, 'package.json')),
    };
    const projectName = basename(resolve(cwd));
    const opts = {
        projectName,
        harnesses: ['opencode', 'claude'],
        pm: 'auto',
        guard: guardHookInstalled(cwd),
        dashboard: existsSync(join(cwd, 'dashboard.html')),
        skipInstall: false,
    };
    const plan = planInit(state, opts, KIT_VERSION);
    const actions = refreshActions(plan.actions);
    const warnings = [...plan.warnings];
    try {
        const result = await executeActions(cwd, actions, {
            version: KIT_VERSION,
            projectName,
            hasBacklogConfig: state.hasBacklogConfig,
        });
        warnings.push(...result.warnings);
        console.log(`super-backlog update complete - refreshed ${actions.length} action(s), applied ${result.applied}, skipped ${result.skipped}`);
    }
    catch (err) {
        if (err instanceof RefusalError) {
            console.error(`error: ${err.message}`);
            return 2;
        }
        if (err instanceof UpstreamError) {
            console.error(`error: upstream command failed: ${err.message}`);
            return 3;
        }
        throw err;
    }
    console.log('upstream versions:');
    const bin = resolveBacklogBin(cwd);
    if (bin === null) {
        warnings.push('backlog binary not found - local backlog.md version unavailable');
    }
    else {
        const local = runCapture(bin, ['--version'], cwd);
        if (local.status === 0) {
            console.log(`  backlog.md (local):    ${firstLine(local.stdout)}`);
        }
        else {
            warnings.push(`\`${bin} --version\` failed with exit code ${local.status}`);
        }
    }
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    let published = null;
    try {
        // test seam: SBL_FORCE_OFFLINE makes e2e runs take the offline path deterministically
        if (process.env.SBL_FORCE_OFFLINE)
            throw new Error('forced offline');
        const view = runCapture(npm, ['view', 'backlog.md', 'version'], cwd);
        if (view.status === 0)
            published = firstLine(view.stdout);
    }
    catch {
        published = null;
    }
    if (published === null) {
        warnings.push('could not query the npm registry (offline?) - published version unavailable');
    }
    else {
        console.log(`  backlog.md (latest):   ${published}`);
    }
    for (const warning of warnings)
        console.log(`warning: ${warning}`);
    return warnings.length > 0 ? 4 : 0;
}
