// test/unit/floorplan.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FLOORPLAN_INSTALL_COMMANDS,
  floorplanBuiltDate,
  floorplanPagePath,
  floorplanStamp,
  floorplanStatusLine,
  readFloorplanStatus,
  type FloorplanStatus,
} from '../../src/lib/floorplan.js';
import type { RunResult } from '../../src/lib/run.js';

const HEAD = '8204637bd25234d5a7f599812806882eeb0a049c';
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

function project(graph: unknown | string | null, withPage = true): string {
  const cwd = mkdtempSync(join(tmpdir(), 'sbl-floorplan-'));
  dirs.push(cwd);
  if (graph === null && !withPage) return cwd;
  mkdirSync(join(cwd, 'floorplan'));
  if (graph !== null) {
    writeFileSync(join(cwd, 'floorplan', 'graph.json'), typeof graph === 'string' ? graph : JSON.stringify(graph));
  }
  if (withPage) writeFileSync(join(cwd, 'floorplan', 'index.html'), '<!doctype html><title>map</title>');
  return cwd;
}

function graph(meta: Record<string, unknown> = {}, nodes: unknown = [{}, {}, {}]): Record<string, unknown> {
  return {
    schema: 1,
    meta: {
      generatedAt: '2026-11-28T13:46:30.507Z',
      counts: { files: 165, loc: 25741 },
      repos: [{ path: '.', name: 'demo', head: HEAD }],
      ...meta,
    },
    nodes,
  };
}

const git = (stdout: string, status = 0) => {
  const calls: string[][] = [];
  const runCapture = (cmd: string, args: string[]): RunResult => {
    calls.push([cmd, ...args]);
    return { status, stdout, stderr: '' };
  };
  return { calls, runCapture };
};

describe('readFloorplanStatus', () => {
  it('is missing without a floorplan directory', () => {
    expect(readFloorplanStatus(project(null, false))).toEqual({ state: 'missing' });
  });

  it('is missing when graph.json or index.html is absent', () => {
    expect(readFloorplanStatus(project(null, true))).toEqual({ state: 'missing' });
    expect(readFloorplanStatus(project(graph(), false))).toEqual({ state: 'missing' });
  });

  it('reads build date, file count, part count and commits since the mapped head', () => {
    const g = git('2\n');
    expect(readFloorplanStatus(project(graph()), g)).toEqual({
      state: 'map',
      builtAt: '2026-11-28T13:46:30.507Z',
      files: 165,
      nodes: 3,
      commitsSince: 2,
    });
    expect(g.calls).toEqual([['git', 'rev-list', '--count', `${HEAD}..HEAD`]]);
  });

  it('falls back to 0 files and 0 parts when the counts are absent or malformed', () => {
    const status = readFloorplanStatus(project(graph({ counts: { files: 'many' } }, 'nope')), git('0\n'));
    expect(status).toMatchObject({ state: 'map', files: 0, nodes: 0, commitsSince: 0 });
  });

  it.each([
    ['no repos entry', { repos: undefined }],
    ['no entry with path "."', { repos: [{ path: 'packages/a', head: HEAD }] }],
    ['a short head', { repos: [{ path: '.', head: '8204637' }] }],
    ['a head that looks like an option', { repos: [{ path: '.', head: '--output=/tmp/x'.padEnd(40, 'a') }] }],
    ['a non-string head', { repos: [{ path: '.', head: 42 }] }],
  ])('never calls git with %s', (_name, meta) => {
    const g = git('5\n');
    expect(readFloorplanStatus(project(graph(meta)), g)).toMatchObject({ state: 'map', commitsSince: null });
    expect(g.calls).toEqual([]);
  });

  it('has commitsSince null when git fails, prints garbage or throws', () => {
    expect(readFloorplanStatus(project(graph()), git('', 128))).toMatchObject({ commitsSince: null });
    expect(readFloorplanStatus(project(graph()), git('abc\n'))).toMatchObject({ commitsSince: null });
    const throwing = { runCapture: (): RunResult => { throw new Error('spawn failed'); } };
    expect(readFloorplanStatus(project(graph()), throwing)).toMatchObject({ state: 'map', commitsSince: null });
  });

  it('is invalid for broken JSON, a non-object, or a missing or unparsable build date', () => {
    expect(readFloorplanStatus(project('{ not json'))).toEqual({ state: 'invalid', reason: 'not valid JSON' });
    expect(readFloorplanStatus(project('[]'))).toEqual({ state: 'invalid', reason: 'no build date (meta.generatedAt)' });
    expect(readFloorplanStatus(project(graph({ generatedAt: 'yesterday' })))).toEqual({
      state: 'invalid',
      reason: 'no build date (meta.generatedAt)',
    });
    expect(readFloorplanStatus(project(graph({ generatedAt: 1764337590507 })))).toMatchObject({ state: 'invalid' });
  });

  it('is invalid for a graph.json above 10 MB and does not parse it', () => {
    const cwd = project('x'.repeat(10 * 1024 * 1024 + 1));
    expect(readFloorplanStatus(cwd)).toEqual({ state: 'invalid', reason: 'graph.json is larger than 10 MB' });
  });

  it('never throws when graph.json is a directory', () => {
    const cwd = project(null, true);
    mkdirSync(join(cwd, 'floorplan', 'graph.json'));
    expect(readFloorplanStatus(cwd).state).toBe('invalid');
  });
});

describe('floorplanStatusLine', () => {
  const map = (over: Partial<Extract<FloorplanStatus, { state: 'map' }>> = {}): FloorplanStatus => ({
    state: 'map',
    builtAt: '2026-11-28T13:46:30.507Z',
    files: 165,
    nodes: 11,
    commitsSince: 0,
    ...over,
  });

  it('covers every row of the check 5 table', () => {
    expect(floorplanStatusLine({ state: 'missing' })).toBe(
      'no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)',
    );
    expect(floorplanStatusLine({ state: 'invalid', reason: 'not valid JSON' })).toBe(
      'floorplan/graph.json unreadable (not valid JSON)',
    );
    expect(floorplanStatusLine(map())).toBe('floorplan map current (built 2026-11-28, 165 files, 11 parts)');
    expect(floorplanStatusLine(map({ commitsSince: 3 }))).toBe(
      'floorplan map built 2026-11-28, 3 commits behind HEAD (165 files, 11 parts)',
    );
    expect(floorplanStatusLine(map({ commitsSince: null }))).toBe('floorplan map built 2026-11-28 (165 files, 11 parts)');
  });

  it('uses singular nouns for counts of one', () => {
    expect(floorplanStatusLine(map({ files: 1, nodes: 1, commitsSince: 1 }))).toBe(
      'floorplan map built 2026-11-28, 1 commit behind HEAD (1 file, 1 part)',
    );
  });
});

describe('helpers', () => {
  it('floorplanBuiltDate is the UTC day', () => {
    expect(floorplanBuiltDate('2026-11-28T23:59:59.000-05:00')).toBe('2026-11-29');
  });

  it('floorplanPagePath points at floorplan/index.html', () => {
    expect(floorplanPagePath(join('a', 'b'))).toBe(join('a', 'b', 'floorplan', 'index.html'));
  });

  it('floorplanStamp is 0 without a map and the graph mtime with one', () => {
    expect(floorplanStamp(project(null, false))).toBe(0);
    expect(floorplanStamp(project(graph()))).toBeGreaterThan(0);
  });

  it('lists the two install commands', () => {
    expect(FLOORPLAN_INSTALL_COMMANDS).toEqual([
      'claude plugin marketplace add haydenschmitty/floorplan',
      'claude plugin install floorplan@floorplan',
    ]);
  });
});
