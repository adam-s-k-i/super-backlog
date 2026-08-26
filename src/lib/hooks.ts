// src/lib/hooks.ts
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GUARD_MARKER = 'super-backlog guard';
export const REFRESH_MARKER = 'super-backlog dashboard-refresh';

function markerBlockRe(marker: string): RegExp {
  return new RegExp(`^# >>> ${marker} [\\d.]+ >>>[\\s\\S]*?# <<< ${marker} <<<\\n?`, 'm');
}

export const GUARD_RE = markerBlockRe(GUARD_MARKER);
export const REFRESH_RE = markerBlockRe(REFRESH_MARKER);

function hookTemplate(file: string): string {
  const here = dirname(fileURLToPath(import.meta.url)); // dist/lib at runtime, src/lib under vitest
  const candidates = [join(here, '..', 'templates', file), join(here, 'templates', file)];
  for (const c of candidates) if (existsSync(c)) return readFileSync(c, 'utf8');
  throw new Error(`${file} template not found`);
}

function renderBlock(templateFile: string, version: string): string {
  return hookTemplate(templateFile).replace('{{VERSION}}', version);
}

/**
 * Shared marker-block installer: swaps this kind's own block in place when
 * present, otherwise appends after the current contents (a fresh hook file
 * gets `#!/bin/sh` + block). Foreign content - including other super-backlog
 * blocks - is always preserved.
 */
function installBlock(gitDir: string, hookName: string, re: RegExp, block: string): void {
  const path = join(gitDir, 'hooks', hookName);
  let next: string;
  if (existsSync(path)) {
    const cur = readFileSync(path, 'utf8');
    next = re.test(cur) ? cur.replace(re, block) : cur.replace(/\n?$/, '\n') + block;
  } else {
    next = '#!/bin/sh\n' + block;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  try { chmodSync(path, 0o755); } catch { /* best effort on Windows */ }
}

/** Shared marker-block remover: strips the own block; deletes the file when nothing but a shebang remains. */
function removeBlock(gitDir: string, hookName: string, re: RegExp): boolean {
  const path = join(gitDir, 'hooks', hookName);
  if (!existsSync(path)) return false;
  const cur = readFileSync(path, 'utf8');
  if (!re.test(cur)) return false;
  const rest = cur.replace(re, '').trim();
  if (rest === '' || rest === '#!/bin/sh') rmSync(path);
  else writeFileSync(path, rest + '\n');
  return true;
}

export function renderGuardHook(version: string): string {
  return renderBlock('guard-hook.sh', version);
}

export function installGuardHook(gitDir: string, version: string): void {
  installBlock(gitDir, 'pre-commit', GUARD_RE, renderGuardHook(version));
}

export function removeGuardHook(gitDir: string): boolean {
  return removeBlock(gitDir, 'pre-commit', GUARD_RE);
}

export function renderRefreshHook(version: string): string {
  return renderBlock('dashboard-refresh-hook.sh', version);
}

export function installRefreshHook(gitDir: string, version: string): void {
  installBlock(gitDir, 'post-commit', REFRESH_RE, renderRefreshHook(version));
}

export function removeRefreshHook(gitDir: string): boolean {
  return removeBlock(gitDir, 'post-commit', REFRESH_RE);
}
