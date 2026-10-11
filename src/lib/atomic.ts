// src/lib/atomic.ts
import { existsSync, mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export function atomicWrite(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, contents, 'utf8');
  try {
    renameSync(tmp, filePath);
  } catch {
    // Windows rename over an existing file can fail on some filesystems:
    // move the target aside, retry, and put it back if the retry fails too.
    replaceViaBackup(tmp, filePath);
  }
}

function replaceViaBackup(tmp: string, filePath: string): void {
  const backup = filePath + '.sbl-bak';
  let movedAside = false;
  try {
    if (existsSync(filePath)) {
      renameSync(filePath, backup);
      movedAside = true;
    }
    renameSync(tmp, filePath);
  } catch (err) {
    if (movedAside) renameSync(backup, filePath);
    rmSync(tmp, { force: true });
    throw err;
  }
  if (movedAside) rmSync(backup, { force: true });
}
