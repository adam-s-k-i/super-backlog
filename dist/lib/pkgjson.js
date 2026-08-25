// src/lib/pkgjson.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export const WANTED_SCRIPTS = {
    tasks: 'backlog task list',
    board: 'backlog board',
    browser: 'backlog browser',
    dashboard: 'super-backlog dashboard',
};
export const WANTED_DEVS = {
    'backlog.md': 'latest',
    'super-backlog': 'latest',
};
export function readPkgJson(cwd) {
    const p = join(cwd, 'package.json');
    if (!existsSync(p))
        return null;
    return JSON.parse(readFileSync(p, 'utf8'));
}
export function mergeScripts(pkg, wanted) {
    const scripts = { ...(pkg.scripts ?? {}) };
    const added = [];
    for (const [name, cmd] of Object.entries(wanted)) {
        if (!(name in scripts)) {
            scripts[name] = cmd;
            added.push(name);
        }
    }
    return { pkg: { ...pkg, ...(added.length ? { scripts } : {}) }, added };
}
export function addDevDependencies(pkg, deps) {
    const devDependencies = { ...(pkg.devDependencies ?? {}) };
    const added = [];
    for (const [name, spec] of Object.entries(deps)) {
        if (!(name in devDependencies)) {
            devDependencies[name] = spec;
            added.push(name);
        }
    }
    return { pkg: { ...pkg, ...(added.length ? { devDependencies } : {}) }, added };
}
