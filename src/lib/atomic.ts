// src/lib/atomic.ts
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export function atomicWrite(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, contents, 'utf8');
  try {
    renameSync(tmp, filePath);
  } catch (err) {
    // Windows rename over an existing file can fail on some filesystems:
    // move the target aside, retry, and put it back if the retry fails too.
    replaceViaBackup(tmp, filePath, err);
  }
}

/** A backup name that is not taken, so a user's own `<file>.sbl-bak` is never overwritten. */
function freeBackupPath(filePath: string): string {
  let backup = filePath + '.sbl-bak';
  while (existsSync(backup)) backup = `${filePath}.sbl-bak-${randomBytes(4).toString('hex')}`;
  return backup;
}

function replaceViaBackup(tmp: string, filePath: string, renameError: unknown): void {
  if (statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
    // never move a directory out of the way to put a file in its place
    rmSync(tmp, { force: true });
    throw renameError;
  }
  const backup = freeBackupPath(filePath);
  let movedAside = false;
  try {
    if (existsSync(filePath)) {
      renameSync(filePath, backup);
      movedAside = true;
    }
    renameSync(tmp, filePath);
  } catch (err) {
    rmSync(tmp, { force: true });
    if (movedAside) {
      try {
        renameSync(backup, filePath);
      } catch {
        throw new Error(`could not replace ${filePath}; the original was kept as ${backup}`, { cause: err });
      }
    }
    throw err;
  }
  if (movedAside) rmSync(backup, { force: true });
}
