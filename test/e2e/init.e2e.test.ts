// test/e2e/init.e2e.test.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'cli.js'); // built by pretest step below

function scaffoldProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-e2e-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo', version: '0.0.1' }));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

describe('sbl init (SBL_SKIP_INSTALL)', () => {
  let dir = '';
  beforeEach(() => { dir = scaffoldProject(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes manifest artifacts and is idempotent', () => {
    execFileSync(process.execPath, [CLI, 'init', '--pm', 'npm', '--guard', '--no-dashboard'], {
      cwd: dir, env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    });
    const oc = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect(oc.plugin).toContain('superpowers@git+https://github.com/obra/superpowers.git');
    const agents = readFileSync(join(dir, 'agents.md').replace('agents', 'AGENTS'), 'utf8');
    expect(agents).toMatch(/SUPER-BACKLOG:\d+\.\d+\.\d+ START/);
    expect(existsSync(join(dir, '.opencode', 'skill', 'spec-to-backlog', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dir, '.claude', 'skills', 'spec-to-backlog', 'SKILL.md'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts.board).toBe('backlog board');
    expect(pkg.devDependencies['backlog.md']).toBe('latest');
    const cfg = readFileSync(join(dir, 'backlog', 'config.yml'), 'utf8');
    expect(cfg).toMatch(/^project_name: /m); // fabricated flat-YAML stub
    const hook = readFileSync(join(dir, '.git', 'hooks', 'pre-commit'), 'utf8');
    expect(hook).toContain('super-backlog guard');

    // re-run: no duplication
    execFileSync(process.execPath, [CLI, 'init', '--pm', 'npm', '--guard', '--no-dashboard'], {
      cwd: dir, env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    });
    const oc2 = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect(oc2.plugin.filter(e => e.includes('superpowers'))).toHaveLength(1);
  });

  it('leaves the guard hook uninstalled unless --guard is passed', () => {
    execFileSync(process.execPath, [CLI, 'init', '--no-dashboard'], {
      cwd: dir, env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    });
    expect(existsSync(join(dir, '.git', 'hooks', 'pre-commit'))).toBe(false);
  });

  it('--dry-run changes nothing', () => {
    execFileSync(process.execPath, [CLI, 'init', '--dry-run', '--no-dashboard'], {
      cwd: dir, env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    });
    expect(existsSync(join(dir, 'opencode.json'))).toBe(false);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
  });
});
