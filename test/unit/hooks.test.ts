import { mkdtempSync, existsSync, readFileSync, rmSync, chmodSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installGuardHook, installRefreshHook, removeGuardHook, removeRefreshHook, renderGuardHook } from '../../src/lib/hooks.js';

let dir: string;
beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), 'sbl-hook-')), '.git');
  mkdirSync(dir, { recursive: true });
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('guard hook lifecycle', () => {
  it('installs into pre-commit preserving foreign content', async () => {
    await new Promise((r) => setTimeout(r, 0));
    const pre = join(dir, 'hooks', 'pre-commit');
    const { writeFileSync } = await import('node:fs');
    mkdirSync(dirname(pre), { recursive: true });
    writeFileSync(pre, '#!/bin/sh\nnpm test\n');
    installGuardHook(dir, '1.0.0');
    const content = readFileSync(pre, 'utf8');
    expect(content).toContain('npm test');
    expect(content).toContain('>>> super-backlog guard 1.0.0 >>>');
    expect(content).toContain('<<< super-backlog guard <<<');
  });
  it('replaces older guard block on re-install', async () => {
    await new Promise((r) => setTimeout(r, 0));
    installGuardHook(dir, '1.0.0');
    installGuardHook(dir, '1.1.0');
    const content = readFileSync(join(dir, 'hooks', 'pre-commit'), 'utf8');
    expect(content).toContain('1.1.0');
    expect(content).not.toContain('1.0.0');
  });
  it('remove strips block and deletes file when nothing else remains', async () => {
    await new Promise((r) => setTimeout(r, 0));
    installGuardHook(dir, '1.0.0');
    expect(removeGuardHook(dir)).toBe(true);
    expect(existsSync(join(dir, 'hooks', 'pre-commit'))).toBe(false);
  });
  it('remove keeps foreign pre-commit intact', async () => {
    await new Promise((r) => setTimeout(r, 0));
    const { writeFileSync } = await import('node:fs');
    const pre = join(dir, 'hooks', 'pre-commit');
    mkdirSync(dirname(pre), { recursive: true });
    writeFileSync(pre, '#!/bin/sh\nnpm test\n');
    installGuardHook(dir, '1.0.0');
    expect(removeGuardHook(dir)).toBe(true);
    expect(readFileSync(pre, 'utf8')).toContain('npm test');
  });
});

describe('dashboard-refresh hook lifecycle', () => {
  it('installs into post-commit preserving foreign content', async () => {
    await new Promise((r) => setTimeout(r, 0));
    const post = join(dir, 'hooks', 'post-commit');
    const { writeFileSync } = await import('node:fs');
    mkdirSync(dirname(post), { recursive: true });
    writeFileSync(post, '#!/bin/sh\nnpm run build\n');
    installRefreshHook(dir, '1.0.0');
    const content = readFileSync(post, 'utf8');
    expect(content).toContain('npm run build');
    expect(content).toContain('>>> super-backlog dashboard-refresh 1.0.0 >>>');
    expect(content).toContain('<<< super-backlog dashboard-refresh <<<');
  });

  it('replaces older refresh block on re-install', async () => {
    await new Promise((r) => setTimeout(r, 0));
    installRefreshHook(dir, '1.0.0');
    installRefreshHook(dir, '1.1.0');
    const content = readFileSync(join(dir, 'hooks', 'post-commit'), 'utf8');
    expect(content).toContain('dashboard-refresh 1.1.0');
    expect(content).not.toContain('1.0.0');
    expect(content.match(/super-backlog dashboard-refresh/g)).toHaveLength(2); // open + close marker only
  });

  it('remove strips block and deletes file when nothing else remains', async () => {
    await new Promise((r) => setTimeout(r, 0));
    installRefreshHook(dir, '1.0.0');
    expect(removeRefreshHook(dir)).toBe(true);
    expect(existsSync(join(dir, 'hooks', 'post-commit'))).toBe(false);
  });

  it('remove keeps foreign post-commit intact', async () => {
    await new Promise((r) => setTimeout(r, 0));
    const { writeFileSync } = await import('node:fs');
    const post = join(dir, 'hooks', 'post-commit');
    mkdirSync(dirname(post), { recursive: true });
    writeFileSync(post, '#!/bin/sh\nnpm run build\n');
    installRefreshHook(dir, '1.0.0');
    expect(removeRefreshHook(dir)).toBe(true);
    expect(readFileSync(post, 'utf8')).toContain('npm run build');
  });

  it('remove returns false when no refresh block exists', async () => {
    await new Promise((r) => setTimeout(r, 0));
    expect(removeRefreshHook(dir)).toBe(false);
  });
});

describe('guard and refresh blocks coexist in one hook file', () => {
  it('installing the refresh hook keeps a pre-existing guard block (foreign to it)', async () => {
    await new Promise((r) => setTimeout(r, 0));
    const { writeFileSync } = await import('node:fs');
    const post = join(dir, 'hooks', 'post-commit');
    mkdirSync(dirname(post), { recursive: true });
    writeFileSync(post, '#!/bin/sh\n' + renderGuardHook('9.9.9'));
    installRefreshHook(dir, '1.0.0');
    const content = readFileSync(post, 'utf8');
    expect(content).toContain('>>> super-backlog guard 9.9.9 >>>');
    expect(content).toContain('<<< super-backlog guard <<<');
    expect(content).toContain('>>> super-backlog dashboard-refresh 1.0.0 >>>');
  });

  it('removing the refresh block leaves the guard block fully intact', async () => {
    await new Promise((r) => setTimeout(r, 0));
    const { writeFileSync } = await import('node:fs');
    const post = join(dir, 'hooks', 'post-commit');
    mkdirSync(dirname(post), { recursive: true });
    writeFileSync(post, '#!/bin/sh\n' + renderGuardHook('9.9.9'));
    installRefreshHook(dir, '1.0.0');
    expect(removeRefreshHook(dir)).toBe(true);
    const content = readFileSync(post, 'utf8');
    expect(content).toContain('super-backlog guard');
    expect(content).not.toContain('dashboard-refresh');
    // the surviving file is still executable-looking and shebang-complete
    expect(content.startsWith('#!/bin/sh\n')).toBe(true);
  });
});
