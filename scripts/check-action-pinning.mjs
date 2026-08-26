#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const USES = /^\s*(?:-\s+)?uses:\s*([^\s@]+)@(\S+)/;
const SHA = /^[0-9a-f]{40}$/;

export function findUnpinnedActions(text) {
  return text.split(/\r?\n/).flatMap((line) => {
    const m = line.match(USES);
    if (!m) return [];
    const [, action, ref] = m;
    if (action.startsWith('./') || SHA.test(ref)) return [];
    return [{ action, ref }];
  });
}

export function findUnpinnedInDir(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .flatMap((f) =>
      findUnpinnedActions(readFileSync(join(dir, f), 'utf8')).map((o) => ({ ...o, file: f }))
    );
}

if (process.argv[1]?.endsWith('check-action-pinning.mjs')) {
  const offenders = findUnpinnedInDir('.github/workflows');
  if (offenders.length) {
    for (const o of offenders) {
      console.error(`${o.file}: ${o.action}@${o.ref} must be pinned to a full commit SHA`);
    }
    process.exit(1);
  }
}
