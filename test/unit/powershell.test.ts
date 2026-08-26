import { describe, expect, it } from 'vitest';

import {
  getEffectiveExecutionPolicy,
  isBlockingExecutionPolicy,
  policyWarningLines,
  type Executor,
} from '../../src/lib/powershell.js';

const okExecutor = (stdout: string): Executor => () => ({ status: 0, stdout, stderr: '' });

describe('getEffectiveExecutionPolicy', () => {
  it('returns the trimmed policy name on success', () => {
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const executor: Executor = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: 'RemoteSigned\r\n', stderr: '' };
    };
    const policy = getEffectiveExecutionPolicy({ platform: 'win32', executor });
    expect(policy).toBe('RemoteSigned');
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe('powershell.exe');
    expect(calls[0].args).toEqual(['-NoProfile', '-NonInteractive', '-Command', 'Get-ExecutionPolicy']);
  });

  it('returns null off win32 without spawning anything', () => {
    let spawned = false;
    const executor: Executor = () => {
      spawned = true;
      return { status: 0, stdout: 'Restricted', stderr: '' };
    };
    const policy = getEffectiveExecutionPolicy({ platform: 'linux', executor });
    expect(policy).toBeNull();
    expect(spawned).toBe(false);
  });

  it('returns null when the spawn fails (nonzero status)', () => {
    const executor: Executor = () => ({ status: 1, stdout: '', stderr: 'boom' });
    expect(getEffectiveExecutionPolicy({ platform: 'win32', executor })).toBeNull();
  });

  it('returns null when the spawn cannot start (null status)', () => {
    const executor: Executor = () => ({ status: null, stdout: '', stderr: 'not found' });
    expect(getEffectiveExecutionPolicy({ platform: 'win32', executor })).toBeNull();
  });

  it('returns null on empty stdout', () => {
    expect(getEffectiveExecutionPolicy({ platform: 'win32', executor: okExecutor('') })).toBeNull();
    expect(getEffectiveExecutionPolicy({ platform: 'win32', executor: okExecutor('   \r\n') })).toBeNull();
  });

  describe('SBL_FAKE_POLICY seam', () => {
    it('overrides detection on any platform when set to a non-empty value', () => {
      let spawned = false;
      const executor: Executor = () => {
        spawned = true;
        return { status: 0, stdout: 'RemoteSigned', stderr: '' };
      };
      const policy = getEffectiveExecutionPolicy({
        platform: 'linux',
        executor,
        fakePolicy: process.env.SBL_FAKE_POLICY ?? 'Restricted',
      });
      expect(policy).toBe('Restricted');
      expect(spawned).toBe(false);
    });

    it('ignores an empty or whitespace-only fake value', () => {
      expect(
        getEffectiveExecutionPolicy({ platform: 'linux', executor: okExecutor('x'), fakePolicy: '  ' }),
      ).toBeNull();
    });
  });
});

describe('policyWarningLines', () => {
  it('names the policy, the one-time fix, and the alternatives', () => {
    const lines = policyWarningLines('Restricted').join('\n');
    expect(lines).toContain('warning:');
    expect(lines).toContain('"Restricted"');
    expect(lines).toContain('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
    expect(lines).toContain('npx.cmd');
    expect(lines).toContain('npm run');
  });
});

describe('isBlockingExecutionPolicy', () => {
  it.each(['Restricted', 'AllSigned'])('flags %s as blocking', (policy) => {
    expect(isBlockingExecutionPolicy(policy)).toBe(true);
  });

  it.each(['RemoteSigned', 'Unrestricted', 'Bypass', 'Default'])('accepts %s', (policy) => {
    expect(isBlockingExecutionPolicy(policy)).toBe(false);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isBlockingExecutionPolicy('  restricted\r\n')).toBe(true);
    expect(isBlockingExecutionPolicy('ALLSIGNED')).toBe(true);
  });

  it('treats missing detection results as non-blocking', () => {
    expect(isBlockingExecutionPolicy(null)).toBe(false);
    expect(isBlockingExecutionPolicy(undefined)).toBe(false);
  });
});
