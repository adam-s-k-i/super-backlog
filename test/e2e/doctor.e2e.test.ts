// test/e2e/doctor.e2e.test.ts
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'bin.js'); // built by pretest step below
const ROOT = join(__dirname, '..', '..');

interface DoctorResult {
  out: string;
  err: string;
  status: number;
}

function runDoctor(env: Record<string, string> = {}): DoctorResult {
  try {
    const out = execFileSync(process.execPath, [CLI, 'doctor'], {
      cwd: ROOT,
      env: { ...process.env, SBL_SKIP_UPDATE_CHECK: '1', ...env },
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

/** Check 5 drift line; its `–` is an en dash (U+2013). */
const DRIFT_LINE = /^\[warn\] architecture\.yml valid, \d+ drift findings? – run sbl summary for details$/;

/**
 * Doctor runs at the repo root, so check 5 sees the repo's live drift (Done
 * tasks, renamed files, commit count). Accept exactly that one warning with
 * exit 4; any other warning, or any other exit code, still fails.
 */
function expectCleanExceptDrift({ out, status }: DoctorResult): void {
  const lines = out.split(/\r?\n/);
  const driftLines = lines.filter((l) => DRIFT_LINE.test(l));
  const rest = lines.filter((l) => !DRIFT_LINE.test(l)).join('\n');
  expect(rest).toContain('[ok]');
  expect(rest).not.toContain('[warn]');
  if (driftLines.length === 0) {
    expect(status).toBe(0);
  } else {
    expect(driftLines).toHaveLength(1);
    expect(status).toBe(4);
  }
}

describe('sbl doctor', () => {
  it('exits 4 and prints the fix when policy is blocking', () => {
    const { out, status } = runDoctor({ SBL_FAKE_POLICY: 'Restricted' });
    expect(status).toBe(4);
    expect(out).toContain('[warn]');
    expect(out).toContain('Restricted');
    expect(out).toContain('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  });

  it('exits 0 when policy is permissive (4 only for live check-5 drift)', () => {
    expectCleanExceptDrift(runDoctor({ SBL_FAKE_POLICY: 'RemoteSigned' }));
  });

  it('exits 0 for an Undefined policy on Windows (4 only for live check-5 drift)', () => {
    expectCleanExceptDrift(runDoctor({ SBL_FAKE_POLICY: 'Undefined' }));
  });
});
