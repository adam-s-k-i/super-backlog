import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync as rf } from 'node:fs';
import { dirname, join as j } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD_RE = /^# >>> super-backlog guard [\d.]+ >>>[\s\S]*?# <<< super-backlog guard <<<\n?/m;

function hookTemplate(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // dist/lib at runtime, src/lib under vitest
  const candidates = [j(here, '..', 'templates', 'guard-hook.sh'), j(here, 'templates', 'guard-hook.sh')];
  for (const c of candidates) if (existsSync(c)) return rf(c, 'utf8');
  throw new Error('guard-hook.sh template not found');
}

export function renderGuardHook(version: string): string {
  return hookTemplate().replace('{{VERSION}}', version);
}

export function installGuardHook(gitDir: string, version: string): void {
  const path = join(gitDir, 'hooks', 'pre-commit');
  const block = renderGuardHook(version);
  let next: string;
  if (existsSync(path)) {
    const cur = readFileSync(path, 'utf8');
    next = GUARD_RE.test(cur) ? cur.replace(GUARD_RE, block) : cur.replace(/\n?$/, '\n') + block;
  } else {
    next = '#!/bin/sh\n' + block;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  try { chmodSync(path, 0o755); } catch { /* best effort on Windows */ }
}

export function removeGuardHook(gitDir: string): boolean {
  const path = join(gitDir, 'hooks', 'pre-commit');
  if (!existsSync(path)) return false;
  const cur = readFileSync(path, 'utf8');
  if (!GUARD_RE.test(cur)) return false;
  const rest = cur.replace(GUARD_RE, '').trim();
  if (rest === '' || rest === '#!/bin/sh') rmSync(path);
  else writeFileSync(path, rest + '\n');
  return true;
}
