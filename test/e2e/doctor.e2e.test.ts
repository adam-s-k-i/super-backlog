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

describe('sbl doctor', () => {
  it('exits 4 and prints the fix when policy is blocking', () => {
    const { out, status } = runDoctor({ SBL_FAKE_POLICY: 'Restricted' });
    expect(status).toBe(4);
    expect(out).toContain('[warn]');
    expect(out).toContain('Restricted');
    expect(out).toContain('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  });

  it('exits 0 when policy is permissive', () => {
    const { out, status } = runDoctor({ SBL_FAKE_POLICY: 'RemoteSigned' });
    expect(status).toBe(0);
    expect(out).toContain('[ok]');
    expect(out).not.toContain('[warn]');
  });

  it('exits 0 for an Undefined policy on Windows', () => {
    const { out, status } = runDoctor({ SBL_FAKE_POLICY: 'Undefined' });
    expect(status).toBe(0);
    expect(out).toContain('[ok]');
    expect(out).not.toContain('[warn]');
  });
});
