// test/unit/atomic.test.ts
import { mkdirSync, mkdtempSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

import { renameSync } from 'node:fs';
import { atomicWrite } from '../../src/lib/atomic.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sbl-atomic-')); });
afterEach(() => {
  vi.mocked(renameSync).mockReset();
  rmSync(dir, { recursive: true, force: true });
});

/** Makes the next `times` renames whose source matches fail like a Windows EPERM; every other rename runs for real. */
async function failRenames(times: number, from: (path: string) => boolean = (p) => p.endsWith('.tmp')): Promise<void> {
  const actual = (await vi.importActual<typeof import('node:fs')>('node:fs')).renameSync;
  let left = times;
  vi.mocked(renameSync).mockImplementation((src, dest) => {
    if (from(String(src)) && left > 0) {
      left--;
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    }
    actual(src, dest);
  });
}

const failTmpRenames = (times: number) => failRenames(times);

describe('atomicWrite', () => {
  it('creates nested dirs and writes content', () => {
    const p = join(dir, 'a/b/c.txt');
    atomicWrite(p, 'hello');
    expect(readFileSync(p, 'utf8')).toBe('hello');
  });
  it('overwrites atomically and leaves no temp files', () => {
    const p = join(dir, 'x.md');
    atomicWrite(p, 'one');
    atomicWrite(p, 'two');
    expect(readFileSync(p, 'utf8')).toBe('two');
    const leftovers = existsSync(p + '.tmp');
    expect(leftovers).toBe(false);
  });

  describe('rename fallback', () => {
    it('replaces the target when only the first rename fails', async () => {
      const p = join(dir, 'x.md');
      atomicWrite(p, 'one');
      await failTmpRenames(1);
      atomicWrite(p, 'two');
      expect(readFileSync(p, 'utf8')).toBe('two');
      expect(readdirSync(dir)).toEqual(['x.md']);
    });

    it('restores the original target and cleans up when the second rename fails too', async () => {
      const p = join(dir, 'x.md');
      atomicWrite(p, 'one');
      await failTmpRenames(2);
      expect(() => atomicWrite(p, 'two')).toThrow(/EPERM/);
      expect(readFileSync(p, 'utf8')).toBe('one');
      expect(readdirSync(dir)).toEqual(['x.md']);
    });

    it('leaves the target untouched when it cannot be moved aside', async () => {
      const p = join(dir, 'x.md');
      atomicWrite(p, 'one');
      await failRenames(2, (src) => src.endsWith('.tmp') || src === p);
      expect(() => atomicWrite(p, 'two')).toThrow(/EPERM/);
      expect(readFileSync(p, 'utf8')).toBe('one');
      expect(readdirSync(dir)).toEqual(['x.md']);
    });

    it('keeps the original in the backup, names it in the error and removes the temp file when the restore fails too', async () => {
      const p = join(dir, 'x.md');
      atomicWrite(p, 'one');
      await failRenames(3, (src) => src.endsWith('.tmp') || src.includes('.sbl-bak'));
      expect(() => atomicWrite(p, 'two')).toThrow(/x\.md\.sbl-bak/);
      const left = readdirSync(dir);
      expect(left).toHaveLength(1);
      expect(left[0]).toMatch(/^x\.md\.sbl-bak/);
      expect(readFileSync(join(dir, left[0]!), 'utf8')).toBe('one');
    });

    it('never overwrites a user file that already has the backup name', async () => {
      const p = join(dir, 'x.md');
      atomicWrite(p, 'one');
      writeFileSync(p + '.sbl-bak', 'mine');
      await failTmpRenames(1);
      atomicWrite(p, 'two');
      expect(readFileSync(p, 'utf8')).toBe('two');
      expect(readFileSync(p + '.sbl-bak', 'utf8')).toBe('mine');
      expect(readdirSync(dir).sort()).toEqual(['x.md', 'x.md.sbl-bak']);
    });

    it('never moves a directory aside that sits where the file should go', () => {
      const p = join(dir, 'x.md');
      mkdirSync(join(p, 'inner'), { recursive: true });
      expect(() => atomicWrite(p, 'two')).toThrow();
      expect(statSync(p).isDirectory()).toBe(true);
      expect(readdirSync(p)).toEqual(['inner']);
      expect(readdirSync(dir)).toEqual(['x.md']);
    });

    it('throws and leaves no temp file when a new file cannot be renamed into place', async () => {
      const p = join(dir, 'new.md');
      await failTmpRenames(2);
      expect(() => atomicWrite(p, 'two')).toThrow(/EPERM/);
      expect(readdirSync(dir)).toEqual([]);
    });
  });
});
