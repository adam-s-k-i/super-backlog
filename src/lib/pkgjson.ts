// src/lib/pkgjson.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PkgJson = Record<string, unknown> & {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export const WANTED_SCRIPTS: Record<string, string> = {
  tasks: 'backlog task list',
  board: 'backlog board',
  browser: 'backlog browser',
  dashboard: 'super-backlog dashboard',
};

export const WANTED_DEVS: Record<string, string> = {
  'backlog.md': 'latest',
  'super-backlog': 'latest',
};

export function readPkgJson(cwd: string): PkgJson | null {
  const p = join(cwd, 'package.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as PkgJson;
}

export function mergeScripts(pkg: PkgJson, wanted: Record<string, string>): { pkg: PkgJson; added: string[] } {
  const scripts = { ...(pkg.scripts ?? {}) };
  const added: string[] = [];
  for (const [name, cmd] of Object.entries(wanted)) {
    if (!(name in scripts)) { scripts[name] = cmd; added.push(name); }
  }
  return { pkg: { ...pkg, ...(added.length ? { scripts } : {}) }, added };
}

export function addDevDependencies(pkg: PkgJson, deps: Record<string, string>): { pkg: PkgJson; added: string[] } {
  const devDependencies = { ...(pkg.devDependencies ?? {}) };
  const added: string[] = [];
  for (const [name, spec] of Object.entries(deps)) {
    if (!(name in devDependencies)) { devDependencies[name] = spec; added.push(name); }
  }
  return { pkg: { ...pkg, ...(added.length ? { devDependencies } : {}) }, added };
}
