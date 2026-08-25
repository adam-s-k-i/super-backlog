// src/lib/pm.ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type PM = 'npm' | 'pnpm' | 'bun';

export function detectPackageManager(cwd: string): PM | null {
  const has = (f: string) => existsSync(join(cwd, f));
  if (!has('package.json')) return null;
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('bun.lockb') || has('bun.lock')) return 'bun';
  return 'npm';
}

export function installCmdsFor(pm: PM, pkgs: string[]): { cmd: string; args: string[] } {
  switch (pm) {
    case 'pnpm': return { cmd: 'pnpm', args: ['add', '-D', ...pkgs] };
    case 'bun': return { cmd: 'bun', args: ['add', '-d', ...pkgs] };
    default: return { cmd: 'npm', args: ['install', '--save-dev', ...pkgs] };
  }
}
