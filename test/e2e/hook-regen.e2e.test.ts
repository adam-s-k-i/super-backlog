// test/e2e/hook-regen.e2e.test.ts
// Post-commit dashboard freshness hook + regen entry, exercised against real
// git commits in a temp repo. The hook resolves the regen script at
// `$root/node_modules/super-backlog/dist/dashboard/regen.js`; because these
// runs set SBL_SKIP_INSTALL=1 (no dependency install), the suite fabricates a
// minimal regen shim at exactly that path. The shim appends a marker line with
// every backlog task title to dashboard.html, mirroring what the real regen
// entry does (rewrite dashboard.html) while staying deterministic offline.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'cli.js');
const REGEN = join(__dirname, '..', '..', 'dist', 'dashboard', 'regen.js');

interface RunResult {
  out: string;
  err: string;
  status: number;
}

function run(dir: string, cmd: string, args: string[]): RunResult {
  // spawnSync keeps both streams capturable even when the exit code is 0,
  // which the swallowed-failure assertions below rely on.
  const r = spawnSync(cmd, args, {
    cwd: dir,
    env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    encoding: 'utf8',
  });
  return {
    out: typeof r.stdout === 'string' ? r.stdout : '',
    err: typeof r.stderr === 'string' ? r.stderr : '',
    status: r.status ?? -1,
  };
}

const cli = (dir: string, args: string[]) => run(dir, process.execPath, [CLI, ...args]);
const node = (dir: string, args: string[]) => run(dir, process.execPath, args);
const git = (dir: string, args: string[]) => {
  const res = run(dir, 'git', args);
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed (${res.status}):\n${res.out}\n${res.err}`);
  return res;
};

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sbl-hookregen-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'hookregen', version: '0.0.1' }));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'e2e@example.com']);
  git(dir, ['config', 'user.name', 'e2e']);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Minimal CommonJS shim standing in for dist/dashboard/regen.js under SBL_SKIP_INSTALL. */
function fabricateRegenShim(): void {
  const shimDir = join(dir, 'node_modules', 'super-backlog', 'dist', 'dashboard');
  mkdirSync(shimDir, { recursive: true });
  writeFileSync(
    join(shimDir, 'regen.js'),
    [
      "const fs = require('fs');",
      "const path = require('path');",
      'const root = process.cwd();',
      'const titles = [];',
      "const tasksDir = path.join(root, 'backlog', 'tasks');",
      'if (fs.existsSync(tasksDir)) {',
      "  for (const f of fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'))) {",
      "    const m = /^title:\\s*(.+)$/m.exec(fs.readFileSync(path.join(tasksDir, f), 'utf8'));",
      '    if (m) titles.push(m[1].trim());',
      '  }',
      '}',
      "const file = path.join(root, 'dashboard.html');",
      "const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';",
      "fs.writeFileSync(file, prev + '<!-- sbl-regen-shim:' + titles.join(' | ') + ' -->\\n');",
    ].join('\n'),
  );
}

describe('post-commit freshness hook (init)', () => {
  it('installs the refresh block into post-commit by default', () => {
    const res = cli(dir, ['init', '--no-dashboard']);
    expect([0, 4]).toContain(res.status);
    const post = join(dir, '.git', 'hooks', 'post-commit');
    expect(existsSync(post)).toBe(true);
    const content = readFileSync(post, 'utf8');
    expect(content).toContain('# >>> super-backlog dashboard-refresh ');
    expect(content).toContain('# <<< super-backlog dashboard-refresh <<<');
    expect(content).toContain('git rev-parse --show-toplevel');
    expect(content).toContain("git diff --name-only HEAD~1 HEAD -- 'backlog/*'");
  });

  it('--no-refresh-hook leaves no post-commit hook behind', () => {
    const res = cli(dir, ['init', '--no-dashboard', '--no-refresh-hook']);
    expect([0, 4]).toContain(res.status);
    expect(existsSync(join(dir, '.git', 'hooks', 'post-commit'))).toBe(false);
  });
});

describe('post-commit freshness hook (regeneration behavior)', () => {
  beforeEach(fabricateRegenShim);

  it('regenerates on backlog-touching commits and skips unrelated ones', () => {
    const initRes = cli(dir, ['init', '--no-dashboard']);
    expect([0, 4]).toContain(initRes.status);

    mkdirSync(join(dir, 'backlog', 'tasks'), { recursive: true });
    writeFileSync(
      join(dir, 'backlog', 'tasks', 'TASK-99.md'),
      '---\nid: TASK-99\ntitle: E2E freshness probe\n---\n\nProbe task body.\n',
    );
    git(dir, ['add', 'backlog']);
    // initial commit: HEAD~1 does not exist -> hook must regenerate anyway
    git(dir, ['commit', '-q', '-m', 'task: add TASK-99']);
    expect(readFileSync(join(dir, 'dashboard.html'), 'utf8')).toContain('sbl-regen-shim:E2E freshness probe');

    // README-only commit: no backlog/ paths in HEAD~1..HEAD -> dashboard untouched
    const before = readFileSync(join(dir, 'dashboard.html'), 'utf8');
    writeFileSync(join(dir, 'README.md'), 'readme\n');
    git(dir, ['add', 'README.md']);
    git(dir, ['commit', '-q', '-m', 'docs: readme only']);
    expect(readFileSync(join(dir, 'dashboard.html'), 'utf8')).toBe(before);

    // second backlog commit goes through the HEAD~1 diff branch
    writeFileSync(
      join(dir, 'backlog', 'tasks', 'TASK-100.md'),
      '---\nid: TASK-100\ntitle: Second probe\n---\n',
    );
    git(dir, ['add', 'backlog']);
    git(dir, ['commit', '-q', '-m', 'task: add TASK-100']);
    const after = readFileSync(join(dir, 'dashboard.html'), 'utf8');
    expect(after).toContain('Second probe');
    expect(after.length).toBeGreaterThan(before.length);
  });

  it('sh-level regen failure never blocks the commit - note lands on stderr', () => {
    const initRes = cli(dir, ['init', '--no-dashboard']);
    expect([0, 4]).toContain(initRes.status);

    mkdirSync(join(dir, 'backlog', 'tasks'), { recursive: true });
    writeFileSync(
      join(dir, 'backlog', 'tasks', 'TASK-101.md'),
      '---\nid: TASK-101\ntitle: Healthy probe\n---\n',
    );
    git(dir, ['add', 'backlog']);
    git(dir, ['commit', '-q', '-m', 'task: add TASK-101']);
    expect(readFileSync(join(dir, 'dashboard.html'), 'utf8')).toContain('sbl-regen-shim:Healthy probe');

    // sabotage the fabricated shim so the hook's regen invocation exits 3
    writeFileSync(join(dir, 'node_modules', 'super-backlog', 'dist', 'dashboard', 'regen.js'), 'process.exit(3);\n');

    writeFileSync(
      join(dir, 'backlog', 'tasks', 'TASK-102.md'),
      '---\nid: TASK-102\ntitle: Sabotaged probe\n---\n',
    );
    git(dir, ['add', 'backlog']);
    // raw run (not the throwing git() helper): both the commit status and the
    // hook's stderr note are part of the contract under test
    const res = run(dir, 'git', ['commit', '-q', '-m', 'task: add TASK-102']);
    expect(res.status).toBe(0); // hook NEVER blocks a commit
    expect(res.err).toContain('super-backlog: dashboard regeneration failed');
  });

  it('uninstall removes the refresh block but keeps foreign post-commit content', () => {
    const post = join(dir, '.git', 'hooks', 'post-commit');
    mkdirSync(dirname(post), { recursive: true });
    writeFileSync(post, '#!/bin/sh\necho foreign-run\n');
    const initRes = cli(dir, ['init', '--no-dashboard']);
    expect([0, 4]).toContain(initRes.status);
    let content = readFileSync(post, 'utf8');
    expect(content).toContain('echo foreign-run');
    expect(content).toContain('super-backlog dashboard-refresh');

    const un = cli(dir, ['uninstall']);
    expect(un.status).toBe(0);
    expect(un.out).toMatch(/removed: git post-commit dashboard-refresh hook/);
    content = readFileSync(post, 'utf8');
    expect(content).toContain('echo foreign-run');
    expect(content).not.toContain('dashboard-refresh');
  });
});

describe('regen entry (dist/dashboard/regen.js)', () => {
  it('writes dashboard.html and exits 0 on a plain project (fallback-empty data)', () => {
    const res = node(dir, [REGEN]);
    expect(res.status).toBe(0);
    const html = readFileSync(join(dir, 'dashboard.html'), 'utf8');
    expect(html).toContain('id="sbl-data"');
    expect(html).toContain('super-backlog');
  });

  it('swallows output failures: exit stays 0 with a stderr note', () => {
    // occupy the output path with a directory so atomicWrite must fail
    mkdirSync(join(dir, 'dashboard.html'));
    const res = node(dir, [REGEN]);
    expect(res.status).toBe(0);
    expect(res.err.trim()).not.toBe('');
  });
});
