// src/lib/yamlmini.ts
import { existsSync, readFileSync } from 'node:fs';

export function readSimpleKeys(filePath: string, keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) out[k] = undefined;
  if (!existsSync(filePath)) return out;
  const wanted = new Set(keys);
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!m || !wanted.has(m[1])) continue;
    const raw = m[2].trim();
    out[m[1]] = raw.replace(/^["'](.*)["']$/, '$1');
  }
  return out;
}
