// test/integration/summary-cli.test.ts
// E2E: dist/bin.js summary in a temp git repo (isolated HOME/USERPROFILE, no hub).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'bin.js'); // built by the pretest step

function arch(files: string): string {
  return [
    'schema: 1',
    'pitch: A **small** demo.',
    'grid: { cols: 3, rows: 2 }',
    'nodes:',
    '  - id: a',
    '    label: Alpha',
    '    kind: core',
    '    cell: [0, 0]',
    `    files: [${files}]`,
    '  - id: b',
    '    label: Beta',
    '    kind: output',
    '    cell: [2, 0]',
    '  - id: c',
    '    label: Gamma',
    '    kind: external',
    '    cell: [2, 1]',
    'edges:',
    '  - { from: a, to: b, label: calls }',
    '  - { from: b, to: c, label: writes }',
    '',
  ].join('\n');
}

let root: string;
let repo: string;
let env: NodeJS.ProcessEnv;

function git(args: string[]): void {
  execFileSync('git', args, { cwd: repo, env, stdio: 'ignore' });
}

function summary(args: string[] = [], cwd = repo): { out: string; status: number } {
  try {
    const out = execFileSync(process.execPath, [CLI, 'summary', ...args], { cwd, env, encoding: 'utf8' });
    return { out, status: 0 };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string | Buffer };
    const stdout = e.stdout ?? '';
    return { out: typeof stdout === 'string' ? stdout : stdout.toString('utf8'), status: e.status ?? -1 };
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sbl-summary-cli-'));
  const home = join(root, 'home');
  repo = join(root, 'repo');
  mkdirSync(home, { recursive: true });
  mkdirSync(join(repo, 'backlog', 'docs'), { recursive: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  env = { ...process.env, HOME: home, USERPROFILE: home, SBL_SKIP_UPDATE_CHECK: '1', SBL_SKIP_INSTALL: '1' };
  writeFileSync(join(repo, 'backlog', 'config.yml'), 'project_name: "demo"\n');
  writeFileSync(join(repo, 'src', 'main.ts'), 'export const main = 1;\n');
  writeFileSync(join(repo, 'src', 'old.ts'), 'export const old = 1;\n');
  writeFileSync(join(repo, 'backlog', 'docs', 'architecture.yml'), arch('src/main.ts, src/old.ts'));
  git(['init', '-q']);
  git(['add', '-A']);
  git(['-c', 'user.name=sbl-test', '-c', 'user.email=sbl-test@example.com', 'commit', '-q', '-m', 'init']);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('sbl summary (E2E)', () => {
  it('reports a deleted documented path as drift (exit 4), then exits 0 once the file is fixed', () => {
    unlinkSync(join(repo, 'src', 'old.ts'));

    const drift = summary();
    expect(drift.status).toBe(4);
    expect(drift.out).toContain('[warn] architecture.yml valid, 1 drift finding');
    expect(drift.out).toMatch(/missing-path {2}nodes\.a\.files +src\/old\.ts does not exist/);
    expect(drift.out).toContain('next step: ask your agent: "Run the architecture-summary skill to refresh');

    const checked = summary(['--check']);
    expect(checked.status).toBe(4);
    expect(checked.out).toContain('missing-path');
    expect(checked.out).not.toContain('next step');

    writeFileSync(join(repo, 'backlog', 'docs', 'architecture.yml'), arch('src/main.ts'));
    const clean = summary();
    expect(clean.status).toBe(0);
    expect(clean.out).toContain('[ok]   architecture.yml valid, no drift');
  });

  it('exits 1 outside a project', () => {
    const outside = join(root, 'outside');
    mkdirSync(outside);
    expect(summary([], outside).status).toBe(1);
  });
});
