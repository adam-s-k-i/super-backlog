// test/unit/pm.test.ts
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectPackageManager } from '../../src/lib/pm.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sbl-pm-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('detectPackageManager', () => {
  it('returns null in empty dir', () => {
    expect(detectPackageManager(dir)).toBeNull();
  });
  it('defaults to npm when only package.json exists', () => {
    writeFileSync(join(dir, 'package.json'), '{}');
    expect(detectPackageManager(dir)).toBe('npm');
  });
  it('detects each lockfile', () => {
    for (const [lock, pm] of [
      ['pnpm-lock.yaml', 'pnpm'],
      ['bun.lockb', 'bun'],
      ['bun.lock', 'bun'],
      ['package-lock.json', 'npm'],
    ] as const) {
      writeFileSync(join(dir, 'package.json'), '{}');
      writeFileSync(join(dir, lock), '');
      expect(detectPackageManager(dir)).toBe(pm);
      rmSync(join(dir, lock));
    }
  });
});
