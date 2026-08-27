// test/integration/init-preflight.test.ts
import { describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runInit, type ParsedArgs } from '../../src/commands/init.js';
import type { PreflightDeps, PreflightResult, UnitReport } from '../../src/lib/preflight.js';

function args(values: Record<string, unknown> = {}): ParsedArgs {
  return {
    values: {
      pm: 'skip',
      'no-dashboard': true,
      harness: 'opencode',
      'no-refresh-hook': true,
      ...values,
    } as Record<string, string | boolean | undefined>,
    positionals: [],
  };
}

function tempCwd(name: string): string {
  return join(tmpdir(), `sbl-init-preflight-${name}-${Date.now()}`);
}

function okResult(): PreflightResult {
  return { reports: [], ok: true };
}

describe('sbl init preflight integration', () => {
  it('passes fixAll and the init unit filter to preflight when --fix-all is set', async () => {
    const cwd = tempCwd('fixall');
    let seen: PreflightDeps | undefined;
    try {
      const code = await runInit(cwd, args({ 'fix-all': true }), {
        preflight: (_cwd, deps) => {
          seen = deps;
          return okResult();
        },
        doctor: () => 0,
      });
      expect(code).toBe(0);
      expect(seen?.fixAll).toBe(true);
      expect(seen?.units).toEqual(['node-version', 'execution-policy', 'npm-command']);
      expect(existsSync(join(cwd, 'AGENTS.md'))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('provides an interactive confirm callback and no fixAll without --fix-all', async () => {
    const cwd = tempCwd('consent');
    let seen: PreflightDeps | undefined;
    try {
      const code = await runInit(cwd, args(), {
        preflight: (_cwd, deps) => {
          seen = deps;
          return okResult();
        },
        doctor: () => 0,
        confirm: () => true,
      });
      expect(code).toBe(0);
      expect(seen?.fixAll).toBe(false);
      expect(typeof seen?.confirm).toBe('function');
      expect(seen?.confirm?.('any question')).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('aborts with exit 1 and the manual command when a preflight fix failed', async () => {
    const cwd = tempCwd('failed');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failedReport: UnitReport = {
      id: 'execution-policy',
      status: 'failed',
      detail: 'Set-ExecutionPolicy failed: access denied',
      manualCommand: 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned',
    };
    try {
      const code = await runInit(cwd, args(), {
        preflight: () => ({ reports: [failedReport], ok: false }),
        doctor: () => 0,
      });
      expect(code).toBe(1);
      const out = [...spy.mock.calls, ...errSpy.mock.calls]
        .map((c) => String(c[0]))
        .join('\n');
      expect(out).toContain('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
      expect(existsSync(join(cwd, 'AGENTS.md'))).toBe(false);
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('continues without changing the exit code when the user declines a system-changing fix', async () => {
    const cwd = tempCwd('declined');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const declined: UnitReport = {
      id: 'execution-policy',
      status: 'needs-manual',
      detail: 'PowerShell execution policy "Restricted" blocks .ps1 shims',
      manualCommand: 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned',
    };
    try {
      const code = await runInit(cwd, args(), {
        preflight: (_cwd, deps) => {
          deps.log?.(`[${declined.status}] ${declined.id}: ${declined.detail}`);
          deps.log?.(`       manual: ${declined.manualCommand}`);
          return { reports: [declined], ok: false };
        },
        doctor: () => 0,
      });
      expect(existsSync(join(cwd, 'AGENTS.md'))).toBe(true);
      const out = spy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(out).toContain('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
      expect(code).toBe(0);
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('runs a doctor verification pass after init and reports success only at 0 warnings', async () => {
    const cwd = tempCwd('verify');
    let doctorRan = 0;
    try {
      const code = await runInit(cwd, args(), {
        preflight: () => okResult(),
        doctor: () => {
          doctorRan += 1;
          return 4;
        },
      });
      expect(doctorRan).toBe(1);
      expect(code).toBe(4);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('skips preflight and doctor verification on --dry-run', async () => {
    const cwd = tempCwd('dryrun');
    let preflightRan = 0;
    let doctorRan = 0;
    try {
      await runInit(cwd, args({ 'dry-run': true }), {
        preflight: () => {
          preflightRan += 1;
          return okResult();
        },
        doctor: () => {
          doctorRan += 1;
          return 0;
        },
      });
      expect(preflightRan).toBe(0);
      expect(doctorRan).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
