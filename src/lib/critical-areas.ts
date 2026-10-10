// src/lib/critical-areas.ts
// Reads backlog/docs/critical-areas.md, the per-project profile of areas that
// always run on the top tier (spec 2026-10-10). Only the Status line is parsed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CRITICAL_AREAS_PATH = 'backlog/docs/critical-areas.md';

export type CriticalAreasState =
  | { status: 'missing' }
  | { status: 'present'; provisional: boolean; stamp: string | null };

/** Never throws: an unreadable file (for example a directory) is present with a null stamp. */
export function readCriticalAreas(cwd: string): CriticalAreasState {
  const path = join(cwd, ...CRITICAL_AREAS_PATH.split('/'));
  if (!existsSync(path)) return { status: 'missing' };
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { status: 'present', provisional: false, stamp: null };
  }
  const line = text.split(/\r?\n/).find((l) => l.startsWith('Status:'));
  if (line === undefined) return { status: 'present', provisional: false, stamp: null };
  const stamp = line.slice('Status:'.length).trim();
  return { status: 'present', provisional: /\bprovisional\b/i.test(stamp), stamp };
}
