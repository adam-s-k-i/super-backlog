import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KIT_VERSION } from '../../src/lib/version.js';

describe('KIT_VERSION', () => {
  it('matches this package.json version', () => {
    const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as { version: string };
    expect(KIT_VERSION).toBe(pkg.version);
  });
});
