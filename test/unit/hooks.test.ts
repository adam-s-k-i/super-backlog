import { mkdtempSync, existsSync, readFileSync, rmSync, chmodSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installGuardHook, removeGuardHook } from '../../src/lib/hooks.js';

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
