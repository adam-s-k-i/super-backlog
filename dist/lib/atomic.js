// src/lib/atomic.ts
import { mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
export function atomicWrite(filePath, contents) {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = filePath + '.tmp';
    writeFileSync(tmp, contents, 'utf8');
    try {
        renameSync(tmp, filePath);
    }
    catch (err) {
        // Windows rename over an existing file can fail on some filesystems.
        rmSync(filePath, { force: true });
        renameSync(tmp, filePath);
    }
}
