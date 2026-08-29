// test/unit/cli-contract.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it.each(['serve', 'browser', 'board'])('rejects removed command %s', async (cmd) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runCli([cmd])).toBe(1);
    expect(err.mock.calls.map(String).join('\n')).toContain(`"sbl ${cmd}" was removed`);
    expect(err.mock.calls.map(String).join('\n')).toContain('sbl dashboard');
  });
});
