// src/lib/build-fingerprint.ts
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

function distRoot(): string {
  // Resolves from src/lib (dev/tests) and dist/lib (runtime) alike: both sit
  // two levels below the package root that owns dist/.
  const pkgPath = require.resolve('../../package.json');
  return join(dirname(pkgPath), 'dist');
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

/**
 * Stable content hash over the built CLI. Two builds of the same source
 * produce the same fingerprint; any changed or added file changes it.
 * Returns null when the build directory is missing.
 */
export function computeBuildFingerprint(root: string = distRoot()): string | null {
  if (!existsSync(root)) return null;
  const files: string[] = [];
  walk(root, files);
  if (files.length === 0) return null;
  files.sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.slice(root.length + 1).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

let cachedDefault: string | null | undefined;

/** Process-lifetime cached fingerprint of the running build. */
export function defaultBuildFingerprint(): string | null {
  if (cachedDefault === undefined) cachedDefault = computeBuildFingerprint();
  return cachedDefault;
}
