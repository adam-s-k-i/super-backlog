// test/unit/dashboard-command.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/dashboard/server.js', () => ({
  DASHBOARD_PORT: 6428,
  startServeServer: vi.fn(),
}));

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/lib/run.js', () => ({
  resolveBacklogBin: vi.fn(),
}));

import spawn from 'cross-spawn';
import { startServeServer } from '../../src/dashboard/server.js';
import { resolveBacklogBin } from '../../src/lib/run.js';
import { runDashboard } from '../../src/commands/dashboard.js';

describe('runDashboard', () => {
  beforeEach(() => {
    vi.mocked(startServeServer).mockResolvedValue({
      server: { close: vi.fn() },
      port: 6428,
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof startServeServer>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the dashboard server using a temp file and returns 0', async () => {
    const code = await runDashboard('/tmp', { values: {}, positionals: [] });
    expect(code).toBe(0);
    expect(startServeServer).toHaveBeenCalledWith(
      '/tmp',
      expect.objectContaining({ port: 6428, openBrowser: true, file: expect.stringMatching(/\.html$/) }),
    );
  });

  it('respects --no-open and a custom --port', async () => {
    const code = await runDashboard('/tmp', { values: { port: '9000', 'no-open': true }, positionals: [] });
    expect(code).toBe(0);
    expect(startServeServer).toHaveBeenCalledWith(
      '/tmp',
      expect.objectContaining({ port: 9000, openBrowser: false }),
    );
  });

  it('warns and continues when the backlog binary is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(resolveBacklogBin).mockReturnValue(null);
    vi.mocked(spawn).mockImplementation(() => ({ on: vi.fn(), unref: vi.fn() }) as unknown as ReturnType<typeof spawn>);
    const code = await runDashboard('/tmp', { values: {}, positionals: [] });
    expect(code).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('backlog CLI not found'));
  });

  it('spawns the Backlog browser when the binary is available', async () => {
    vi.mocked(resolveBacklogBin).mockReturnValue('/usr/local/bin/backlog');
    vi.mocked(spawn).mockImplementation(() => ({ on: vi.fn(), unref: vi.fn() }) as unknown as ReturnType<typeof spawn>);
    const code = await runDashboard('/tmp', { values: {}, positionals: [] });
    expect(code).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      '/usr/local/bin/backlog',
      ['browser', '--no-open', '--non-interactive'],
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    );
  });

  it('writes no dashboard.html in the project directory', async () => {
    const code = await runDashboard('/tmp', { values: {}, positionals: [] });
    expect(code).toBe(0);
    const [, opts] = vi.mocked(startServeServer).mock.calls[0] as [string, { file?: string }];
    expect(opts.file).not.toBe('/tmp/dashboard.html');
    expect(opts.file).toMatch(/\.html$/);
  });
});
