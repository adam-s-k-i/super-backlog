// test/unit/atomic.test.ts
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWrite } from '../../src/lib/atomic.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sbl-atomic-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

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
});
