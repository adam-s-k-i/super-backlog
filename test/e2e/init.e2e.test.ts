// test/e2e/init.e2e.test.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'cli.js'); // built by pretest step below

interface InitResult {
  out: string;
  err: string;
  status: number;
}

function runInit(dir: string, args: string[], extraEnv: Record<string, string> = {}): InitResult {
  try {
    const out = execFileSync(process.execPath, [CLI, 'init', ...args], {
      cwd: dir,
      env: { ...process.env, SBL_SKIP_INSTALL: '1', ...extraEnv },
      encoding: 'utf8',
    });
    return { out, err: '', status: 0 };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string | Buffer; stderr?: string | Buffer };
    const stdout = e.stdout ?? '';
    const stderr = e.stderr ?? '';
    return {
      out: typeof stdout === 'string' ? stdout : stdout.toString('utf8'),
      err: typeof stderr === 'string' ? stderr : stderr.toString('utf8'),
      status: e.status ?? -1,
    };
  }
}

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
    const first = runInit(dir, ['--pm', 'npm', '--guard', '--no-dashboard']);
    expect(first.status).toBe(4); // success with warnings: manual claude plugin step
    expect(first.out).toContain('Claude Code: run /plugin install superpowers@claude-plugins-official inside Claude Code to enable the Superpowers plugin.');
    expect(first.out).toContain('warning: claude plugin install must be run manually');
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

    // re-run: no duplication; instruction still printed for the claude harness
    const second = runInit(dir, ['--pm', 'npm', '--guard', '--no-dashboard']);
    expect(second.out).toContain('/plugin install superpowers@claude-plugins-official');
    const oc2 = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect(oc2.plugin.filter(e => e.includes('superpowers'))).toHaveLength(1);
  });

  it('leaves the guard hook uninstalled unless --guard is passed', () => {
    const { out } = runInit(dir, ['--no-dashboard']);
    expect(out).toContain('/plugin install superpowers@claude-plugins-official');
    expect(existsSync(join(dir, '.git', 'hooks', 'pre-commit'))).toBe(false);
  });

  it('--dry-run changes nothing', () => {
    execFileSync(process.execPath, [CLI, 'init', '--dry-run', '--no-dashboard'], {
      cwd: dir, env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    });
    expect(existsSync(join(dir, 'opencode.json'))).toBe(false);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
  });

  it('exits 1 when package.json is malformed', () => {
    writeFileSync(join(dir, 'package.json'), '{ bad');

    const { err, status } = runInit(dir, ['--pm', 'npm', '--no-dashboard']);

    expect(status).toBe(1);
    expect(err).toContain('package.json');
    expect(err).toMatch(/not valid JSON/i);
  });

  it('surfaces a blocking PowerShell policy via the verification pass (exit 4)', () => {
    const { out, status } = runInit(dir, ['--pm', 'npm', '--no-dashboard', '--harness', 'opencode'], {
      SBL_FAKE_POLICY: 'Restricted',
    });
    expect(status).toBe(4);
    expect(out).toContain('PowerShell execution policy "Restricted"');
    expect(out).toContain('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  });

  it('shows the policy warning in dry-run mode too', () => {
    const { out, status } = runInit(
      dir,
      ['--pm', 'npm', '--no-dashboard', '--harness', 'opencode', '--dry-run'],
      { SBL_FAKE_POLICY: 'Restricted' },
    );
    expect(status).toBe(0);
    expect(out).toContain('PowerShell execution policy "Restricted"');
  });
});
