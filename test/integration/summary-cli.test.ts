// test/integration/summary-cli.test.ts
// E2E: dist/bin.js summary in a temp git repo (isolated HOME/USERPROFILE, no hub).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'bin.js'); // built by the pretest step

let root: string;
let repo: string;
let env: NodeJS.ProcessEnv;

function git(args: string[]): void {
  execFileSync('git', args, { cwd: repo, env, stdio: 'ignore', timeout: 30000 });
}

function summary(args: string[] = [], cwd = repo): { out: string; status: number } {
  try {
    const out = execFileSync(process.execPath, [CLI, 'summary', ...args], { cwd, env, encoding: 'utf8', timeout: 30000 });
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
  git(['init', '-q']);
  git(['add', '-A']);
  git(['-c', 'user.name=sbl-test', '-c', 'user.email=sbl-test@example.com', 'commit', '-q', '-m', 'init']);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const DEPRECATION =
  'sbl summary no longer checks backlog/docs/architecture.yml: the curated architecture file was replaced by Floorplan (https://github.com/haydenschmitty/floorplan).';
const NO_MAP =
  'map status: no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)';

describe('sbl summary (deprecation stub)', () => {
  it('prints the deprecation line and the map status inside a project, exit 0', () => {
    const { out, status } = summary();
    expect(status).toBe(0);
    expect(out.trimEnd().split(/\r?\n/)).toEqual([DEPRECATION, NO_MAP]);
  });

  it('reports a built map with its distance to HEAD', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, env, encoding: 'utf8' }).trim();
    mkdirSync(join(repo, 'floorplan'));
    writeFileSync(join(repo, 'floorplan', 'index.html'), '<!doctype html>');
    writeFileSync(
      join(repo, 'floorplan', 'graph.json'),
      JSON.stringify({
        meta: { generatedAt: '2026-11-28T13:46:30.507Z', counts: { files: 3 }, repos: [{ path: '.', head }] },
        nodes: [{}, {}],
      }),
    );
    const { out, status } = summary();
    expect(status).toBe(0);
    expect(out).toContain('map status: floorplan map current (built 2026-11-28, 3 files, 2 parts)');
  });

  it.each([['--check'], ['--json'], ['--check', '--json', 'extra'], ['--no-such-flag=1']])(
    'accepts and ignores old arguments (%s)',
    (...args) => {
      const { out, status } = summary(args);
      expect(status).toBe(0);
      expect(out.trimEnd().split(/\r?\n/)).toEqual([DEPRECATION, NO_MAP]);
    },
  );

  it('prints only the deprecation line outside a project, exit 0', () => {
    const outside = join(root, 'outside');
    mkdirSync(outside);
    const { out, status } = summary([], outside);
    expect(status).toBe(0);
    expect(out.trimEnd()).toBe(DEPRECATION);
  });
});
