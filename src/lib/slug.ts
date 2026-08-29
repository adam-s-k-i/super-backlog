import { realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import process from 'node:process';
import { readSimpleKeys } from './yamlmini.js';

export type SlugResult = { ok: true; slug: string } | { ok: false; reason: 'empty' };

export function realpathKey(cwd: string): string {
  const resolved = realpathSync(cwd);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function sanitizeSlug(raw: string): string {
  const nk = raw.normalize('NFKD').replace(/\p{M}/gu, '');
  return nk
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function projectSlug(cwd: string): SlugResult {
  const cfg = readSimpleKeys(join(cwd, 'backlog', 'config.yml'), ['project_name']);
  const raw = (cfg.project_name && cfg.project_name.trim() !== '' ? cfg.project_name : basename(realpathSync(cwd)));
  const slug = sanitizeSlug(raw);
  if (slug === '') return { ok: false, reason: 'empty' };
  return { ok: true, slug };
}
