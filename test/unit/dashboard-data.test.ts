// test/unit/dashboard-data.test.ts
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';

import {
  BUILT_IN_GLOSSARY,
  collectDashboardData,
  computeActivity,
  enrichTasksFromFiles,
  normalizeTasks,
  parseGlossaryMarkdown,
  parseTasksJson,
  readDrafts,
} from '../../src/dashboard/data.js';

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

describe('normalizeTasks schemaVersion 1 shape', () => {
  it('maps updatedAt, assignees[] and acceptanceCriteria from the current CLI output', () => {
    const [task] = normalizeTasks([
      {
        id: 'TASK-9',
        title: 'Modern shape',
        status: 'Done',
        assignees: ['adam', 'kim'],
        updatedAt: '2026-08-29T16:30:00Z',
        acceptanceCriteria: [{ text: 'works', checked: true }],
      },
    ]);
    expect(task?.assignee).toBe('adam');
    expect(task?.updated).toBe('2026-08-29T16:30:00Z');
    expect(task?.acs).toEqual([{ text: 'works', checked: true }]);
  });

  it('still accepts the legacy updated_at/assignee/acceptance_criteria fields', () => {
    const [task] = normalizeTasks([
      { id: 'B-1', title: 'Legacy', status: 'Done', assignee: 'kim', updated_at: '2026-08-01', acceptance_criteria: ['plain'] },
    ]);
    expect(task?.assignee).toBe('kim');
    expect(task?.updated).toBe('2026-08-01');
    expect(task?.acs).toEqual([{ text: 'plain', checked: false }]);
  });

  it('maps labels and derives the pipeline phase', () => {
    const [task] = normalizeTasks([
      {
        id: 'TASK-1',
        title: 'T',
        status: 'In Progress',
        labels: ['feature', 'phase/plan'],
      },
    ]);
    expect(task?.labels).toEqual(['feature', 'phase/plan']);
    expect(task?.phase).toBe('plan');
  });

  it('defaults labels to [] and phase to null', () => {
    const [task] = normalizeTasks([{ id: 'TASK-2', title: 'T', status: 'To Do' }]);
    expect(task?.labels).toEqual([]);
    expect(task?.phase).toBeNull();
  });

  it('is lenient on duplicate phase labels (doctor flags them)', () => {
    const [task] = normalizeTasks([
      { id: 'TASK-3', title: 'T', status: 'To Do', labels: ['phase/spec', 'phase/impl'] },
    ]);
    expect(task?.phase).toBe('spec');
  });
});

function writeTaskFile(cwd: string, filename: string, contents: string): void {
  mkdirSync(join(cwd, 'backlog', 'tasks'), { recursive: true });
  writeFileSync(join(cwd, 'backlog', 'tasks', filename), contents);
}

const TASK_FILE = `---
id: TASK-7
title: 'Something'
status: To Do
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First paragraph.

Second paragraph.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 one done
- [ ] #2 two open
<!-- AC:END -->
`;

describe('enrichTasksFromFiles', () => {
  it('fills description and acs from the task file markers', () => {
    const cwd = freshDir('sbl-enrich-');
    writeTaskFile(cwd, 'task-7 - Something.md', TASK_FILE);
    const [task] = enrichTasksFromFiles(cwd, normalizeTasks([{ id: 'TASK-7', title: 'Something', status: 'To Do' }]));
    expect(task?.description).toBe('First paragraph.\n\nSecond paragraph.');
    expect(task?.acs).toEqual([
      { text: 'one done', checked: true },
      { text: 'two open', checked: false },
    ]);
  });

  it('keeps fields the CLI already provided', () => {
    const cwd = freshDir('sbl-enrich-keep-');
    writeTaskFile(cwd, 'task-7 - Something.md', TASK_FILE);
    const [task] = enrichTasksFromFiles(
      cwd,
      normalizeTasks([
        { id: 'TASK-7', title: 'Something', status: 'To Do', description: 'from cli', acceptance_criteria: ['cli ac'] },
      ]),
    );
    expect(task?.description).toBe('from cli');
    expect(task?.acs).toEqual([{ text: 'cli ac', checked: false }]);
  });

  it('returns tasks unchanged when the tasks dir is missing or files are malformed', () => {
    const empty = freshDir('sbl-enrich-none-');
    const tasks = normalizeTasks([{ id: 'TASK-9', title: 'X', status: 'Done' }]);
    expect(enrichTasksFromFiles(empty, tasks)).toEqual(tasks);
    const bad = freshDir('sbl-enrich-bad-');
    writeTaskFile(bad, 'task-9 - X.md', 'no frontmatter, no markers');
    expect(enrichTasksFromFiles(bad, tasks)).toEqual(tasks);
  });
});

function homeWithVersionCache(latest: string): string {
  const home = freshDir('sbl-home-');
  mkdirSync(join(home, '.super-backlog'), { recursive: true });
  writeFileSync(
    join(home, '.super-backlog', 'version-check.json'),
    JSON.stringify({ checkedAt: '2026-08-29T00:00:00.000Z', latest }),
  );
  return home;
}

describe('collectDashboardData latestVersion', () => {
  it('exposes the cached latest version when it is newer than the kit version', () => {
    const cwd = freshDir();
    const data = collectDashboardData(cwd, { kitVersion: '1.0.0', home: homeWithVersionCache('9.9.9') });
    expect(data.latestVersion).toBe('9.9.9');
  });

  it('is null when the cached version is not newer', () => {
    const cwd = freshDir();
    const data = collectDashboardData(cwd, { kitVersion: '1.0.0', home: homeWithVersionCache('1.0.0') });
    expect(data.latestVersion).toBeNull();
  });

  it('is null when no cache file exists', () => {
    const cwd = freshDir();
    const data = collectDashboardData(cwd, { kitVersion: '1.0.0', home: freshDir('sbl-home-empty-') });
    expect(data.latestVersion).toBeNull();
  });

  it('is null when the cache has a wrong shape', () => {
    const cwd = freshDir();
    const home = freshDir('sbl-home-shape-');
    mkdirSync(join(home, '.super-backlog'), { recursive: true });
    writeFileSync(join(home, '.super-backlog', 'version-check.json'), JSON.stringify({ latest: 123 }));
    const data = collectDashboardData(cwd, { kitVersion: '1.0.0', home });
    expect(data.latestVersion).toBeNull();
  });

  it('is null when the cache file is invalid JSON', () => {
    const cwd = freshDir();
    const home = freshDir('sbl-home-bad-');
    mkdirSync(join(home, '.super-backlog'), { recursive: true });
    writeFileSync(join(home, '.super-backlog', 'version-check.json'), 'not json');
    const data = collectDashboardData(cwd, { kitVersion: '1.0.0', home });
    expect(data.latestVersion).toBeNull();
  });
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

  it('falls back to the directory name when config and package.json yield nothing', () => {
    const parent = freshDir();
    const dir = join(parent, 'mein-konkretes-projekt');
    mkdirSync(dir, { recursive: true });

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    expect(data.project.name).toBe('mein-konkretes-projekt');
  });

  it('keeps Untitled project only as the last resort', () => {
    const dir = freshDir();

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    // temp dirs always have a basename, so the generic placeholder only
    // appears when the basename itself is unusable (filesystem root)
    expect(data.project.name.length).toBeGreaterThan(0);
    expect(data.project.name).not.toBe('');
  });
});

const DEPS_JSON =
  '{"tasks":[' +
  '{"id":"A","title":"Alpha","status":"To Do"},' +
  '{"id":"B","title":"Beta","status":"To Do","dependsOn":["A"]},' +
  '{"id":"C","title":"Gamma","status":"To Do","deps":["A","B",42,{"id":"X"}]},' +
  '{"id":"D","title":"Delta","status":"Done","deps":["Zzz"]},' +
  '{"id":"E","title":"Epsilon","status":"To Do","dependsOn":"B"},' +
  '{"id":"F","title":"Zeta","status":"To Do","dependsOn":["A"],"deps":["B"]},' +
  '{"title":"NoId","status":"To Do","deps":["A"]}' +
  ']}';

const ACTIVITY_JSON =
  '{"tasks":[' +
  '{"id":"T1","title":"a","status":"Done","updated_at":"2026-08-26"},' +
  '{"id":"T2","title":"b","status":"To Do","updated_at":"2026-08-01"},' +
  '{"id":"T3","title":"c","status":"Done","created_at":"2026-07-28"},' +
  '{"id":"T4","title":"d","status":"To Do"},' +
  '{"id":"T5","title":"e","status":"In Progress","updated_at":"2026-08-26"},' +
  '{"id":"T6","title":"f","status":"To Do","updated":"2026-08-02"}' +
  ']}';

describe('collector v2: deps', () => {
  it('parses dependsOn/deps array-of-ids, drops malformed entries, keeps dangling refs', () => {
    const dir = freshDir();
    writeBacklogConfig(dir, 'project_name: deps-demo\n');
    fabricateBacklogBin(dir, DEPS_JSON);

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    expect(data.source).toBe('backlog-json');
    expect(data.deps).toEqual([
      { from: 'B', to: 'A' },
      { from: 'C', to: 'A' },
      { from: 'C', to: 'B' },
      { from: 'D', to: 'Zzz' },
      { from: 'F', to: 'A' },
    ]);
  });

  it('yields no deps for tasks without dependency fields or unknown shapes', () => {
    const dir = freshDir();
    writeBacklogConfig(dir, 'project_name: deps-empty\n');
    fabricateBacklogBin(dir, HAPPY_JSON);

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    expect(data.deps).toEqual([]);
  });
});

describe('collector v2: activity', () => {
  it('builds exactly 182 UTC daily buckets oldest→newest ending at the injected today', () => {
    const dir = freshDir();
    writeBacklogConfig(dir, 'project_name: activity-demo\n');
    fabricateBacklogBin(dir, ACTIVITY_JSON);

    const data = collectDashboardData(dir, { kitVersion: 'v', today: '2026-08-26' });

    expect(data.activity).toHaveLength(182);
    const lastBucket = data.activity[data.activity.length - 1]!;
    expect(lastBucket.date).toBe('2026-08-26');
    expect(lastBucket.count).toBe(3);
    expect(lastBucket.ids).toEqual(['T1', 'T4', 'T5']);
    for (let i = 1; i < data.activity.length; i++) {
      expect(data.activity[i]?.date).not.toBe(data.activity[i - 1]?.date);
    }
    // every non-event day sums to zero; total counts match task count
    const total = data.activity.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(6);
    // ids must be present on all buckets
    expect(data.activity.every((b) => b.ids.length === b.count)).toBe(true);
  });

  it('defaults today to the real current date when not injected', () => {
    const dir = freshDir();
    writeBacklogConfig(dir, 'project_name: activity-now\n');
    fabricateBacklogBin(dir, ACTIVITY_JSON);

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    expect(data.activity).toHaveLength(182);
    const today = new Date().toISOString().slice(0, 10);
    expect(data.activity[data.activity.length - 1]?.date).toBe(today);
    expect(typeof data.activity[data.activity.length - 1]?.count).toBe('number');
    expect(Array.isArray(data.activity[data.activity.length - 1]?.ids)).toBe(true);
  });

  it('still emits 182 zero buckets in fallback-empty mode', () => {
    const dir = freshDir();

    const data = collectDashboardData(dir, { kitVersion: 'v', today: '2026-08-26' });

    expect(data.source).toBe('fallback-empty');
    expect(data.activity).toHaveLength(182);
    expect(data.activity.every((b) => b.count === 0)).toBe(true);
    expect(data.activity[data.activity.length - 1]).toMatchObject({ date: '2026-08-26', count: 0, ids: [] });
    expect(data.deps).toEqual([]);
  });
});

describe('computeActivity v2', () => {
  it('produces 182 daily buckets carrying the touched task ids', () => {
    const out = computeActivity(
      [
        { id: 't-1', updated_at: '2026-08-29' },
        { id: 't-2', updated_at: '2026-08-29' },
        { id: 't-3', created_at: '2026-08-01' },
        { id: 'old', updated_at: '2020-01-01' },
      ],
      '2026-08-30',
    );
    expect(out).toHaveLength(182);
    expect(out[out.length - 1]!.date).toBe('2026-08-30');
    const aug29 = out.find((b) => b.date === '2026-08-29')!;
    expect(aug29.count).toBe(2);
    expect(aug29.ids).toEqual(['t-1', 't-2']);
    expect(out.every((b) => b.ids.length === b.count)).toBe(true);
  });
});

describe('collector v2: glossary', () => {
  it('ships built-in kit terms even without a project glossary file', () => {
    const dir = freshDir();

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    const terms = data.glossary.map((g) => g.term);
    for (const t of ['AC', 'DoD', 'Milestone', 'Review Gate', 'TDD']) {
      expect(terms).toContain(t);
    }
    expect(data.glossary.length).toBeGreaterThanOrEqual(BUILT_IN_GLOSSARY.length);
    expect(BUILT_IN_GLOSSARY.length).toBeGreaterThanOrEqual(15);
    expect(data.glossary.every((g) => g.term && g.definition)).toBe(true);
  });

  it('lets backlog/docs/glossary.md override terms case-insensitively and add new ones', () => {
    const dir = freshDir();
    mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
    writeFileSync(
      join(dir, 'backlog', 'docs', 'glossary.md'),
      [
        '# Project Glossary',
        '',
        '## ac',
        'Project-specific acceptance criterion rules.',
        '',
        '## Custom Term',
        'A brand new concept introduced by this project.',
        '',
        '## Empty Heading',
        '## Another',
        'Second term body.',
        '',
      ].join('\n'),
    );

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    const ac = data.glossary.find((g) => g.term === 'AC');
    expect(ac?.definition).toBe('Project-specific acceptance criterion rules.');
    expect(data.glossary.filter((g) => g.term.toLowerCase() === 'ac')).toHaveLength(1);

    const custom = data.glossary.find((g) => g.term === 'Custom Term');
    expect(custom?.definition).toBe('A brand new concept introduced by this project.');

    const another = data.glossary.find((g) => g.term === 'Another');
    expect(another?.definition).toBe('Second term body.');
    expect(data.glossary.find((g) => g.term === 'Empty Heading')).toBeUndefined();

    // built-in order preserved first, project-only terms appended after
    const tddIdx = data.glossary.findIndex((g) => g.term === 'TDD');
    const customIdx = data.glossary.findIndex((g) => g.term === 'Custom Term');
    expect(customIdx).toBeGreaterThan(tddIdx);
  });

  it('falls back to built-in only when the glossary path is corrupt', () => {
    const dir = freshDir();
    mkdirSync(join(dir, 'backlog', 'docs', 'glossary.md'), { recursive: true });

    const data = collectDashboardData(dir, { kitVersion: 'v' });

    expect(data.glossary).toEqual([...BUILT_IN_GLOSSARY]);
  });
});

describe('parseGlossaryMarkdown', () => {
  it('splits ## headings into term/definition pairs, skipping empty sections', () => {
    const entries = parseGlossaryMarkdown(
      '# Title\n\n## Alpha\nFirst body.\n\n## Beta\nLine one.\nLine two.\n\n## Gamma\n',
    );
    expect(entries).toEqual([
      { term: 'Alpha', definition: 'First body.' },
      { term: 'Beta', definition: 'Line one.\nLine two.' },
    ]);
  });
});

describe('normalizeTasks created mapping', () => {
  it('maps createdAt / created_at / created', () => {
    const tasks = normalizeTasks([
      { id: 't-1', title: 'a', status: 'To Do', createdAt: '2026-08-01' },
      { id: 't-2', title: 'b', status: 'To Do', created_at: '2026-08-02' },
      { id: 't-3', title: 'c', status: 'To Do', created: '2026-08-03' },
      { id: 't-4', title: 'd', status: 'To Do' },
    ]);
    expect(tasks.map((t) => t.created)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', undefined]);
  });
});

describe('readDrafts enrichment', () => {
  it('parses description, ACs and meta from the draft file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbl-drafts-'));
    mkdirSync(join(dir, 'backlog', 'drafts'), { recursive: true });
    writeFileSync(
      join(dir, 'backlog', 'drafts', 'task-9 - idea.md'),
      [
        '---',
        'id: task-9',
        'title: Offline mode',
        'status: Draft',
        'priority: low',
        'assignee: adam',
        'created_date: 2026-08-10',
        'updated_date: 2026-08-12',
        '---',
        '<!-- SECTION:DESCRIPTION:BEGIN -->',
        'Cache the board locally.',
        '<!-- SECTION:DESCRIPTION:END -->',
        '<!-- AC:BEGIN -->',
        '- [ ] #1 works without network',
        '- [x] #2 syncs on reconnect',
        '<!-- AC:END -->',
      ].join('\n'),
      'utf8',
    );
    const drafts = readDrafts(dir);
    expect(drafts).toHaveLength(1);
    const d = drafts[0]!;
    expect(d.description).toBe('Cache the board locally.');
    expect(d.priority).toBe('low');
    expect(d.assignee).toBe('adam');
    expect(d.created).toBe('2026-08-10');
    expect(d.updated).toBe('2026-08-12');
    expect(d.acs).toEqual([
      { text: 'works without network', checked: false },
      { text: 'syncs on reconnect', checked: true },
    ]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('readDrafts', () => {
  it('returns an empty array when the drafts directory does not exist', () => {
    const dir = freshDir();
    expect(readDrafts(dir)).toEqual([]);
  });

  it('reads draft frontmatter and sorts by id', () => {
    const dir = freshDir();
    const draftsDir = join(dir, 'backlog', 'drafts');
    mkdirSync(draftsDir, { recursive: true });
    writeFileSync(
      join(draftsDir, 'draft-2.md'),
      `---\nid: DRAFT-2\ntitle: 'Second idea'\nstatus: Draft\n---\n`,
    );
    writeFileSync(
      join(draftsDir, 'draft-1.md'),
      `---\nid: DRAFT-1\ntitle: 'First idea'\nstatus: Draft\n---\n`,
    );
    expect(readDrafts(dir)).toEqual([
      { id: 'DRAFT-1', title: 'First idea', status: 'Draft', acs: [] },
      { id: 'DRAFT-2', title: 'Second idea', status: 'Draft', acs: [] },
    ]);
  });

  it('ignores files that are missing required frontmatter', () => {
    const dir = freshDir();
    const draftsDir = join(dir, 'backlog', 'drafts');
    mkdirSync(draftsDir, { recursive: true });
    writeFileSync(join(draftsDir, 'empty.md'), '# Empty\n');
    expect(readDrafts(dir)).toEqual([]);
  });
});

describe('collectDashboardData drafts', () => {
  it('includes drafts even when the backlog bin is missing', () => {
    const dir = freshDir();
    const draftsDir = join(dir, 'backlog', 'drafts');
    mkdirSync(draftsDir, { recursive: true });
    writeFileSync(
      join(draftsDir, 'draft-1.md'),
      `---\nid: DRAFT-1\ntitle: 'First idea'\nstatus: Draft\n---\n`,
    );
    const data = collectDashboardData(dir, { kitVersion: '0.1.0' });
    expect(data.drafts).toEqual([{ id: 'DRAFT-1', title: 'First idea', status: 'Draft', acs: [] }]);
  });
});

describe('collectDashboardData task count alignment', () => {
  it('matches the raw backlog task list count and status totals', () => {
    const dir = freshDir();
    fabricateBacklogBin(dir, HAPPY_JSON);
    const data = collectDashboardData(dir, { kitVersion: 'v' });
    expect(data.tasks).toHaveLength(3);
    const totalFromStatuses = data.statuses.reduce((sum, s) => sum + s.count, 0);
    expect(totalFromStatuses).toBe(3);
  });

  it('includes tasks regardless of status casing and missing fields', () => {
    const dir = freshDir();
    fabricateBacklogBin(dir, '{"tasks":[{"id":"X-1","title":"A","status":"In Progress"},{"id":"X-2","title":"B","status":"in progress"},{"id":"X-3","title":"C","status":"Done"}]}');
    const data = collectDashboardData(dir, { kitVersion: 'v' });
    expect(data.tasks).toHaveLength(3);
    expect(data.statuses).toEqual([
      { status: 'Done', count: 1 },
      { status: 'in progress', count: 1 },
      { status: 'In Progress', count: 1 },
    ]);
  });
});
