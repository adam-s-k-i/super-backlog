// test/unit/dashboard-data.test.ts
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';

import { collectDashboardData, parseTasksJson } from '../../src/dashboard/data.js';

let dirs: string[] = [];

function freshDir(prefix = 'sbl-data-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

const HAPPY_JSON =
  '{"tasks":[' +
  '{"id":"B-1","title":"First","status":"Done","priority":"high","assignee":"adam",' +
  '"updated_at":"2026-08-01","milestone":"M1","description":"d1",' +
  '"acceptance_criteria":[{"text":"ac one","checked":true},{"text":"ac two","checked":false}]},' +
  '{"id":"B-2","title":"Second","status":"To Do","milestone":"M1","extra_junk":{"nested":1},' +
  '"acceptance_criteria":["plain ac"]},' +
  '{"id":"B-3","title":"Third","status":"Done","updated":"2026-08-05"}]}';

function fabricateBacklogBin(dir: string, stdout: string): void {
  const binDir = join(dir, 'node_modules', '.bin');
  mkdirSync(binDir, { recursive: true });
  if (process.platform === 'win32') {
    writeFileSync(join(binDir, 'backlog.cmd'), `@echo off\r\necho ${stdout}\r\n`);
  } else {
    const bin = join(binDir, 'backlog');
    writeFileSync(bin, `#!/bin/sh\ncat <<'SBL_EOF'\n${stdout}\nSBL_EOF\n`);
    chmodSync(bin, 0o755);
  }
}

function writeBacklogConfig(dir: string, contents: string): void {
  mkdirSync(join(dir, 'backlog'), { recursive: true });
  writeFileSync(join(dir, 'backlog', 'config.yml'), contents);
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe('parseTasksJson', () => {
  it('accepts the {tasks:[...]} wrapper shape', () => {
    const raw = parseTasksJson(HAPPY_JSON);
    expect(raw).toHaveLength(3);
    expect((raw[0] as Record<string, unknown>)['id']).toBe('B-1');
  });

  it('accepts a bare array shape', () => {
    const raw = parseTasksJson('[{"id":"X-1","title":"Solo"}]');
    expect(raw).toHaveLength(1);
  });

  it('treats empty stdout as a failure', () => {
    expect(() => parseTasksJson('   \n')).toThrow();
  });

  it('throws on malformed JSON (caller decides degradation)', () => {
    expect(() => parseTasksJson('not-json{{{')).toThrow();
  });

  it('throws on non-task JSON objects', () => {
    expect(() => parseTasksJson('{"foo":42}')).toThrow();
  });
});

describe('collectDashboardData', () => {
  it('collects tasks, statuses and milestones from a local backlog bin', () => {
    const dir = freshDir();
    writeBacklogConfig(dir, 'project_name: demo-project\ndescription: A demo project\n');
    fabricateBacklogBin(dir, HAPPY_JSON);

    const data = collectDashboardData(dir, { kitVersion: '0.0.0-test' });

    expect(data.source).toBe('backlog-json');
    expect(data.project).toEqual({ name: 'demo-project', description: 'A demo project' });
    expect(data.kitVersion).toBe('0.0.0-test');
    expect(data.generatedAt).toBeTruthy();

    expect(data.statuses).toEqual([
      { status: 'Done', count: 2 },
      { status: 'To Do', count: 1 },
    ]);

    expect(data.milestones).toEqual([{ name: 'M1', done: 1, total: 2 }]);

    expect(data.tasks).toHaveLength(3);
    const [t1, t2, t3] = data.tasks;
    expect(t1).toMatchObject({
      id: 'B-1', title: 'First', status: 'Done', priority: 'high', assignee: 'adam',
      updated: '2026-08-01', milestone: 'M1', description: 'd1',
    });
    expect(t1.acs).toEqual([
      { text: 'ac one', checked: true },
      { text: 'ac two', checked: false },
    ]);
    expect(t2.priority).toBeUndefined();
    expect(t2.assignee).toBeUndefined();
    expect(t2.updated).toBeUndefined();
    expect(t2.acs).toEqual([{ text: 'plain ac', checked: false }]);
    expect(t3.updated).toBe('2026-08-05');
    expect(t3.milestone).toBeUndefined();
    expect(t3.acs).toEqual([]);
    expect(t2).not.toHaveProperty('extra_junk');
  });

  it('degrades to fallback-empty on malformed bin output without crashing', () => {
    const dir = freshDir();
    writeBacklogConfig(dir, 'project_name: broken-output\n');
    fabricateBacklogBin(dir, 'not-json{{{');

    const data = collectDashboardData(dir, { kitVersion: '0.0.0-test' });

    expect(data.source).toBe('fallback-empty');
    expect(data.tasks).toEqual([]);
    expect(data.statuses).toEqual([]);
    expect(data.milestones).toEqual([]);
    expect(data.project.name).toBe('broken-output');
  });

  it('degrades to fallback-empty when the bin exits non-zero', () => {
    const dir = freshDir();
    fabricateBacklogBin(dir, '{"tasks":[]}');
    // overwrite with a failing bin
    const binDir = join(dir, 'node_modules', '.bin');
    if (process.platform === 'win32') {
      writeFileSync(join(binDir, 'backlog.cmd'), '@echo off\r\nexit /b 3\r\n');
    } else {
      const bin = join(binDir, 'backlog');
      writeFileSync(bin, '#!/bin/sh\nexit 3\n');
      chmodSync(bin, 0o755);
    }

    const data = collectDashboardData(dir, { kitVersion: '0.0.0-test' });

    expect(data.source).toBe('fallback-empty');
    expect(data.tasks).toEqual([]);
  });

  it('degrades to fallback-empty when no backlog bin exists', () => {
    const dir = freshDir();

    const data = collectDashboardData(dir, { kitVersion: '0.0.0-test' });

    expect(data.source).toBe('fallback-empty');
    expect(data.statuses).toEqual([]);
  });

  it('prefers project_name from backlog config, falling back to package.json identity', () => {
    const dir = freshDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'pkg-name', description: 'pkg description' }),
    );
    writeBacklogConfig(dir, 'project_name: cfg-project-name\n');

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    expect(data.project.name).toBe('cfg-project-name');
    expect(data.project.description).toBe('pkg description');
  });

  it('falls back to config name:, then package.json name', () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'pkg-name' }));
    writeBacklogConfig(dir, 'name: cfg-name-fallback\n');

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    expect(data.project.name).toBe('cfg-name-fallback');

    const dir2 = freshDir();
    writeFileSync(join(dir2, 'package.json'), JSON.stringify({ name: 'pkg-name-2' }));

    const data2 = collectDashboardData(dir2, { kitVersion: 'v' });

    expect(data2.project.name).toBe('pkg-name-2');
    expect(data2.project.description).toBe('');
  });
});
