import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { computeBuildFingerprint } from '../../src/lib/build-fingerprint.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

function fakeDist(): string {
  const root = mkdtempSync(join(tmpdir(), 'sbl-fp-'));
  dirs.push(root);
  mkdirSync(join(root, 'dashboard'), { recursive: true });
  mkdirSync(join(root, 'templates'), { recursive: true });
  writeFileSync(join(root, 'bin.js'), 'bin');
  writeFileSync(join(root, 'dashboard', 'hub.js'), 'hub-v1');
  writeFileSync(join(root, 'templates', 'dashboard.html'), '<html>v1</html>');
  return root;
}

describe('computeBuildFingerprint', () => {
  it('returns null when the build directory does not exist', () => {
    expect(computeBuildFingerprint(join(tmpdir(), 'sbl-fp-missing-xyz'))).toBeNull();
  });

  it('is stable for identical builds', () => {
    const a = computeBuildFingerprint(fakeDist());
    const b = computeBuildFingerprint(fakeDist());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when a build file changes', () => {
    const root = fakeDist();
    const before = computeBuildFingerprint(root);
    writeFileSync(join(root, 'templates', 'dashboard.html'), '<html>v2</html>');
    expect(computeBuildFingerprint(root)).not.toBe(before);
  });

  it('changes when a build file is added', () => {
    const root = fakeDist();
    const before = computeBuildFingerprint(root);
    writeFileSync(join(root, 'dashboard', 'phase.js'), 'new module');
    expect(computeBuildFingerprint(root)).not.toBe(before);
  });
});
