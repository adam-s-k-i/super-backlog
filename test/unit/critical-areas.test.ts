// test/unit/critical-areas.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CRITICAL_AREAS_PATH, readCriticalAreas } from '../../src/lib/critical-areas.js';

let cwd: string;
const file = (): string => join(cwd, ...CRITICAL_AREAS_PATH.split('/'));
const write = (text: string): void => {
  mkdirSync(join(cwd, 'backlog', 'docs'), { recursive: true });
  writeFileSync(file(), text);
};

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sbl-critical-areas-'));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe('readCriticalAreas', () => {
  it('exports the profile path', () => {
    expect(CRITICAL_AREAS_PATH).toBe('backlog/docs/critical-areas.md');
  });

  it('reports a missing file', () => {
    expect(readCriticalAreas(cwd)).toEqual({ status: 'missing' });
  });

  it('reads the Status line as the stamp', () => {
    write('# Critical areas\n\nStatus: 2026-10-10, created with Fable 5.1\n\nAlways on the top tier:\n- Payments: refunds\n');
    expect(readCriticalAreas(cwd)).toEqual({
      status: 'present',
      provisional: false,
      stamp: '2026-10-10, created with Fable 5.1',
    });
  });

  it('flags provisional regardless of case', () => {
    write('# Critical areas\r\nStatus: 2026-10-10, created with Sonnet, PROVISIONAL\r\n');
    expect(readCriticalAreas(cwd)).toEqual({
      status: 'present',
      provisional: true,
      stamp: '2026-10-10, created with Sonnet, PROVISIONAL',
    });
  });

  it('returns a null stamp without a Status line', () => {
    write('# Critical areas\n\nAlways on the top tier:\n- Payments\n');
    expect(readCriticalAreas(cwd)).toEqual({ status: 'present', provisional: false, stamp: null });
  });

  it('never throws on a directory at the path', () => {
    mkdirSync(file(), { recursive: true });
    expect(readCriticalAreas(cwd)).toEqual({ status: 'present', provisional: false, stamp: null });
  });
});
