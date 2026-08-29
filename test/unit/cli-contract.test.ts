// test/unit/cli-contract.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/version-check.js', () => ({
  applyVersionHint: vi.fn(async (_installed: string, deps: { log: (line: string) => void }) => {
    await new Promise((r) => setTimeout(r, 5));
    deps.log('HINT-MARKER');
  }),
  defaultFetchLatest: vi.fn(async () => null),
}));

import { HELP, runCli } from '../../src/cli.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HELP', () => {
  it('lists kept commands and dashboard flags only', () => {
    for (const cmd of ['init', 'uninstall', 'update', 'dashboard', 'models', 'doctor']) {
      expect(HELP).toContain(cmd);
    }
    expect(HELP).toContain('--port');
    expect(HELP).toContain('--no-open');
    expect(HELP).not.toMatch(/^\s+serve\s/m);
    expect(HELP).not.toMatch(/^\s+browser\s/m);
    expect(HELP).not.toMatch(/^\s+board\s/m);
    expect(HELP).not.toContain('--serve');
    expect(HELP).not.toContain('Backlog browser');
  });
});

describe('runCli', () => {
  it('prints version for --version and -v', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runCli(['--version'])).toBe(0);
    expect(await runCli(['-v'])).toBe(0);
    expect(log.mock.calls.length).toBeGreaterThan(0);
  });

  it('prints HELP for help, --help, -h, and no args', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const argv of [[], ['help'], ['--help'], ['-h']]) {
      expect(await runCli(argv)).toBe(0);
    }
    expect(log.mock.calls.some((c) => String(c[0]).includes('Usage: sbl'))).toBe(true);
  });

  it('does not print version hint for --version or help', async () => {
    delete process.env.SBL_SKIP_UPDATE_CHECK;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runCli(['--version'])).toBe(0);
    expect(await runCli(['help'])).toBe(0);
    const all = [...log.mock.calls, ...err.mock.calls].flat().map(String).join('\n');
    expect(all).not.toContain('npm i -g super-backlog');
  });

  it('awaits the version hint so it prints before command output', async () => {
    process.env.SBL_SKIP_UPDATE_CHECK = '1';
    const order: string[] = [];
    const err = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
      if (String(line) === 'HINT-MARKER') order.push('hint');
    });
    const log = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      if (typeof line === 'string' && line.includes('[')) order.push('doctor');
    });
    expect(await runCli(['doctor'])).toBeDefined();
    expect(order[0]).toBe('hint');
    expect(order).toContain('doctor');
    delete process.env.SBL_SKIP_UPDATE_CHECK;
    err.mockRestore();
    log.mockRestore();
  });

  it.each(['serve', 'browser', 'board'])('rejects removed command %s', async (cmd) => {
    process.env.SBL_SKIP_UPDATE_CHECK = '1';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runCli([cmd])).toBe(1);
    expect(err.mock.calls.map(String).join('\n')).toContain(`"sbl ${cmd}" was removed`);
    expect(err.mock.calls.map(String).join('\n')).toContain('sbl dashboard');
    delete process.env.SBL_SKIP_UPDATE_CHECK;
  });
});
