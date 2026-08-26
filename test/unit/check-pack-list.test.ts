import { describe, expect, it } from 'vitest';
import { findUnexpectedFiles } from '../../scripts/check-pack-list.mjs';

describe('findUnexpectedFiles', () => {
  const allowed = ['README.md', 'LICENSE', 'package.json', 'dist/**'];

  it('accepts dist files and root metadata', () => {
    const entries = [
      { path: 'package.json' },
      { path: 'README.md' },
      { path: 'LICENSE' },
      { path: 'dist/cli.js' },
      { path: 'dist/lib/x.js' }
    ];
    expect(findUnexpectedFiles(entries, allowed)).toEqual([]);
  });

  it('flags stray files', () => {
    const entries = [{ path: 'src/cli.ts' }, { path: 'dashboard.html' }];
    expect(findUnexpectedFiles(entries, allowed)).toEqual(['src/cli.ts', 'dashboard.html']);
  });

  it('does not match prefix lookalikes outside dist', () => {
    const entries = [{ path: 'distribution/evil.js' }];
    expect(findUnexpectedFiles(entries, allowed)).toEqual(['distribution/evil.js']);
  });
});
