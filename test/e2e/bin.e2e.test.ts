// test/e2e/bin.e2e.test.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const BIN = join(__dirname, '..', '..', 'dist', 'bin.js'); // built by pretest step below

interface RunResult {
  out: string;
  status: number;
}

function run(args: string[]): RunResult {
  try {
    const out = execFileSync(process.execPath, [BIN, ...args], {
      env: { ...process.env, SBL_SKIP_UPDATE_CHECK: '1' },
      encoding: 'utf8',
    });
    return { out, status: 0 };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string | Buffer };
    const stdout = e.stdout ?? '';
    return {
      out: typeof stdout === 'string' ? stdout : stdout.toString('utf8'),
      status: e.status ?? -1,
    };
  }
}

describe('dist/bin.js', () => {
  it('prints help and exits 0 when run directly', () => {
    const { out, status } = run(['--help']);
    expect(status).toBe(0);
    expect(out).toContain('super-backlog (sbl)');
  });

  describe('via a symlink (simulates the npm global-install bin shim)', () => {
    const dirs: string[] = [];
    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it('still runs correctly when invoked through argv[1] pointing at a symlink', () => {
      const dir = mkdtempSync(join(tmpdir(), 'sbl-bin-symlink-'));
      dirs.push(dir);
      const link = join(dir, 'sbl-link.js');
      try {
        symlinkSync(BIN, link, 'file');
      } catch (err) {
        // No permission to create symlinks on this platform (common on Windows
        // without Developer Mode / admin). Skip: this is a platform capability
        // gap, not a test failure.
        console.warn(`skipping symlink test: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      const out = execFileSync(process.execPath, [link, '--help'], {
        env: { ...process.env, SBL_SKIP_UPDATE_CHECK: '1' },
        encoding: 'utf8',
      });
      expect(out).toContain('super-backlog (sbl)');
    });
  });
});
