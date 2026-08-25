// test/unit/pkgjson.test.ts
import { describe, expect, it } from 'vitest';
import { WANTED_DEVS, WANTED_SCRIPTS, addDevDependencies, mergeScripts, readPkgJson, type PkgJson } from '../../src/lib/pkgjson.js';

describe('mergeScripts', () => {
  it('adds missing scripts', () => {
    const pkg: PkgJson = {};
    const r = mergeScripts(pkg, WANTED_SCRIPTS);
    expect(r.added.sort()).toEqual(['board', 'browser', 'dashboard', 'tasks']);
    expect(r.pkg.scripts?.board).toBe('backlog board');
  });
  it('never overwrites existing values', () => {
    const pkg: PkgJson = { scripts: { board: 'my-custom-board' } };
    const r = mergeScripts(pkg, WANTED_SCRIPTS);
    expect(r.added).toEqual(['tasks', 'browser', 'dashboard']);
    expect(r.pkg.scripts?.board).toBe('my-custom-board');
  });
  it('is idempotent', () => {
    let pkg: PkgJson = {};
    pkg = mergeScripts(pkg, WANTED_SCRIPTS).pkg;
    const again = mergeScripts(pkg, WANTED_SCRIPTS);
    expect(again.added).toEqual([]);
  });
});

describe('addDevDependencies', () => {
  it('adds wanted deps with latest spec', () => {
    const r = addDevDependencies({}, WANTED_DEVS);
    expect(r.added.sort()).toEqual(['backlog.md', 'super-backlog']);
    expect(r.pkg.devDependencies?.['backlog.md']).toBe('latest');
  });
  it('keeps pinned versions of the user', () => {
    const r = addDevDependencies({ devDependencies: { 'backlog.md': '^1.50.1' } }, WANTED_DEVS);
    expect(r.added).toEqual(['super-backlog']);
    expect(r.pkg.devDependencies?.['backlog.md']).toBe('^1.50.1');
  });
});

describe('readPkgJson', () => {
  it('returns null when absent', () => {
    expect(readPkgJson('/definitely/not/here')).toBeNull();
  });
});
