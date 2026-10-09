// test/unit/summary-facts.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collectSummaryFacts, isTestFile, readWordPressHeader } from '../../src/dashboard/summary-facts.js';
import type { RunResult } from '../../src/lib/run.js';

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sbl-facts-'));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function put(rel: string, content: string | object): void {
  const p = join(cwd, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

/** git unavailable: ls-files and tag both fail, so the walk fallback runs. */
const noGit = (): RunResult => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });

function fakeGit(files: string[], tags: string[]): (cmd: string, args: string[]) => RunResult {
  return (cmd, args) => {
    if (cmd === 'git' && args[0] === 'ls-files') return { status: 0, stdout: files.map((f) => `${f}\0`).join(''), stderr: '' };
    if (cmd === 'git' && args[0] === 'tag') return { status: 0, stdout: tags.join('\n') + '\n', stderr: '' };
    return { status: 1, stdout: '', stderr: 'unexpected' };
  };
}

describe('collectSummaryFacts: manifests', () => {
  it('reads name, version, license and dependency counts from package.json', () => {
    put('package.json', {
      name: 'demo',
      version: '1.2.3',
      license: 'MIT',
      dependencies: { 'cross-spawn': '^7.0.6' },
      devDependencies: { vitest: '^5.0.0', typescript: '^7.0.0' },
      scripts: { build: 'tsc -p tsconfig.json', test: 'vitest run' },
    });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'demo', version: '1.2.3', license: 'MIT', manifest: 'package.json', manifests: ['package.json'] });
    expect(f.dependencies).toBe(1);
    expect(f.devDependencies).toBe(2);
    expect(f.packages.map((p) => [p.name, p.group])).toEqual([
      ['cross-spawn', 'Runtime'],
      ['typescript', 'Development'],
      ['vitest', 'Development'],
    ]);
  });

  it('resolves versions from package-lock.json and falls back to the declared range', () => {
    put('package.json', { name: 'demo', dependencies: { 'cross-spawn': '^7.0.6', other: '~1.0.0' } });
    put('package-lock.json', { packages: { '': {}, 'node_modules/cross-spawn': { version: '7.0.6' }, 'node_modules/a/node_modules/other': { version: '9.9.9' } } });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.versions).toEqual({ 'cross-spawn': '7.0.6', other: '~1.0.0' });
  });

  it('reads composer.json, ignores php and ext-* in the count and resolves composer.lock versions', () => {
    put('composer.json', {
      name: 'acme/kursbuchung',
      license: 'GPL-2.0-or-later',
      require: { php: '>=8.3', 'ext-json': '*', 'mollie/mollie-api-php': '^2.0' },
      'require-dev': { 'phpunit/phpunit': '^11.0' },
      scripts: { test: 'phpunit', lint: 'phpcs' },
    });
    put('composer.lock', { packages: [{ name: 'mollie/mollie-api-php', version: 'v2.79.1' }], 'packages-dev': [{ name: 'phpunit/phpunit', version: '11.5.2' }] });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'acme/kursbuchung', version: null, license: 'GPL-2.0-or-later', manifest: 'composer.json' });
    expect(f.dependencies).toBe(1);
    expect(f.devDependencies).toBe(1);
    expect(f.versions['mollie/mollie-api-php']).toBe('v2.79.1');
    expect(f.versions.php).toBe('>=8.3');
    expect(f.commands).toEqual([{ group: 'composer.json scripts', entries: [{ run: 'composer test' }, { run: 'composer lint' }] }]);
  });

  it('reads a WordPress plugin header from a root php file', () => {
    put('kursbuchung-core.php', "<?php\n/**\n * Plugin Name: Kursbuchung Core\n * Version: 2.3.1\n * License: GPL-2.0-or-later\n */\n");
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'Kursbuchung Core', version: '2.3.1', license: 'GPL-2.0-or-later', manifest: 'wordpress' });
    expect(f.extensions).toEqual(['.php']);
  });

  it('prefers a theme style.css header and lets it fill the version composer.json lacks', () => {
    put('style.css', '/*\nTheme Name: Kurs Theme\nVersion: 1.4.0\nLicense: GPL-2.0-or-later\n*/\n');
    put('composer.json', { name: 'acme/theme', require: {} });
    expect(readWordPressHeader(cwd)).toMatchObject({ type: 'theme', name: 'Kurs Theme', version: '1.4.0' });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'acme/theme', version: '1.4.0', manifest: 'composer.json', manifests: ['composer.json', 'wordpress'] });
  });

  it('sums dependency counts across manifests and keeps the first manifest for name/version', () => {
    put('package.json', { name: 'front', version: '0.1.0', dependencies: { a: '1', b: '1' } });
    put('composer.json', { name: 'acme/back', version: '9.9.9', require: { php: '8.3', 'c/d': '1' } });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.name).toBe('front');
    expect(f.version).toBe('0.1.0');
    expect(f.dependencies).toBe(3);
  });

  it('records a warning for a broken manifest instead of throwing', () => {
    put('package.json', '{ not json');
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.manifest).toBeNull();
    expect(f.warnings[0]).toMatch(/^package\.json: /);
  });
});

describe('collectSummaryFacts: repository facts', () => {
  it('counts LOC and test files with the walk fallback, skipping node_modules, vendor, dist, build and .git', () => {
    put('package.json', { name: 'demo' });
    put('src/a.ts', 'one\ntwo\nthree\n');
    put('src/b.mjs', 'one\ntwo');
    put('src/a.test.ts', 'x\n');
    put('test/helper.js', 'y\n');
    put('src/__tests__/c.tsx', 'z\n');
    put('README.md', 'not counted\n');
    for (const d of ['node_modules/x', 'vendor', 'dist', 'build', '.git']) put(`${d}/skip.ts`, 'skipped\n');
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.fileSource).toBe('walk');
    expect(f.sourceFiles).toBe(5);
    expect(f.loc).toBe(3 + 2 + 1 + 1 + 1);
    expect(f.testFiles).toBe(3);
    expect(f.locApprox).toBe(false);
  });

  it('uses git ls-files when git works', () => {
    put('package.json', { name: 'demo' });
    put('src/tracked.ts', 'a\nb\n');
    put('src/untracked.ts', 'a\nb\nc\n');
    const f = collectSummaryFacts(cwd, { runCapture: fakeGit(['package.json', 'src/tracked.ts', 'src/deleted.ts'], []) });
    expect(f.fileSource).toBe('git');
    expect(f.sourceFiles).toBe(2);
    expect(f.loc).toBe(2);
  });

  it('sets the approximation flag when the byte budget is exhausted', () => {
    put('package.json', { name: 'demo' });
    put('src/a.ts', 'x\n'.repeat(10));
    put('src/b.ts', 'x\n'.repeat(10));
    const f = collectSummaryFacts(cwd, { runCapture: noGit, maxBytes: 25 });
    expect(f.locApprox).toBe(true);
    expect(f.loc).toBe(10);
    expect(f.sourceFiles).toBe(2);
  });

  it('counts version tags through the injected runCapture', () => {
    const f = collectSummaryFacts(cwd, { runCapture: fakeGit([], ['v1.0.0', '1.1.0', 'v1.2.0', 'nightly', 'release-3']) });
    expect(f.releases).toBe(3);
    expect(f.releasesNote).toBeNull();
  });

  it('reports 0 releases and "git unavailable" when git fails', () => {
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.releases).toBe(0);
    expect(f.releasesNote).toBe('git unavailable');
  });

  it('counts workflow files', () => {
    put('.github/workflows/ci.yml', 'on: push\n');
    put('.github/workflows/release.yaml', 'on: push\n');
    put('.github/workflows/README.md', '');
    expect(collectSummaryFacts(cwd, { runCapture: noGit }).workflows).toBe(2);
  });

  it('classifies test files by name and directory', () => {
    expect(isTestFile('src/a.test.ts')).toBe(true);
    expect(isTestFile('src/a.spec.js')).toBe(true);
    expect(isTestFile('tests/Unit/BookingTest.php')).toBe(true);
    expect(isTestFile('src/__tests__/x.ts')).toBe(true);
    expect(isTestFile('src/testing.ts')).toBe(false);
  });
});

describe('collectSummaryFacts: commands', () => {
  it.each([
    ['npm', 'package-lock.json', 'npm run build'],
    ['pnpm', 'pnpm-lock.yaml', 'pnpm run build'],
    ['bun', 'bun.lock', 'bun run build'],
  ])('maps scripts to %s commands', (_pm, lock, expected) => {
    put('package.json', { name: 'demo', scripts: { build: 'tsc' } });
    put(lock, lock.endsWith('.json') ? {} : '');
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.commands).toEqual([{ group: 'package.json scripts', entries: [{ run: expected, note: 'tsc' }] }]);
  });

  it('shortens long script bodies in the note', () => {
    put('package.json', { name: 'demo', scripts: { long: 'x'.repeat(100) } });
    const note = collectSummaryFacts(cwd, { runCapture: noGit }).commands[0].entries[0].note ?? '';
    expect(note).toHaveLength(80);
    expect(note.endsWith('…')).toBe(true);
  });
});
