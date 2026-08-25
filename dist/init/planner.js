// src/init/planner.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPluginEntry } from '../lib/opencode.js';
function readTemplate(name) {
    const here = dirname(fileURLToPath(import.meta.url)); // src/init at dev time, dist/init at runtime
    const candidates = [join(here, '..', 'templates', name), join(here, 'templates', name)];
    for (const c of candidates)
        if (existsSync(c))
            return readFileSync(c, 'utf8');
    throw new Error(`template not found: ${name}`);
}
export function agentsBlockContents(version) {
    return readTemplate('workflow-block.md').replace(/\{\{VERSION\}\}/g, version);
}
export function planInit(state, opts, _version) {
    const actions = [];
    const warnings = [];
    const degradedAuto = opts.pm === 'auto' && state.detectedPm === null;
    if (!opts.skipInstall && !degradedAuto && opts.pm !== 'skip') {
        if (opts.pm === 'auto' && state.detectedPm !== null) {
            actions.push({ kind: 'upstream-install', pm: state.detectedPm });
        }
        else if (opts.pm !== 'auto') {
            actions.push({ kind: 'upstream-install', pm: opts.pm });
        }
    }
    if (degradedAuto && !opts.skipInstall) {
        warnings.push('no package manager detected - skipped dependency installation and JSON merges; ' +
            'install backlog.md and super-backlog manually, or re-run with --pm <npm|pnpm|bun>');
    }
    if (!degradedAuto && state.pkgExists) {
        if (opts.harnesses.includes('opencode')) {
            try {
                applyPluginEntry(state.opencodeConfig);
                actions.push({ kind: 'merge-json', path: 'opencode.json', transform: 'plugin-entry' });
            }
            catch (err) {
                warnings.push(err instanceof Error ? err.message : String(err));
            }
        }
        actions.push({ kind: 'merge-json', path: 'package.json', transform: 'scripts-and-devdeps' });
    }
    if (opts.harnesses.length > 0) {
        actions.push({ kind: 'inject-agents-block' });
        actions.push({ kind: 'copy-skills' });
    }
    if (opts.harnesses.includes('claude'))
        actions.push({ kind: 'write-claude-pointer' });
    if (opts.guard)
        actions.push({ kind: 'install-guard-hook' });
    if (opts.dashboard)
        actions.push({ kind: 'generate-dashboard' });
    return { actions, warnings };
}
