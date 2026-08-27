// test/unit/serve-command.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/dashboard/server.js', () => ({
  DASHBOARD_PORT: 6428,
  startServeServer: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('../../src/lib/run.js', () => ({
  resolveBacklogBin: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { startServeServer } from '../../src/dashboard/server.js';
import { resolveBacklogBin } from '../../src/lib/run.js';
import { runServe } from '../../src/commands/serve.js';

describe('runServe', () => {
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

  it('starts the dashboard server and returns 0', async () => {
    const code = await runServe('/tmp', { values: {}, positionals: [] });
    expect(code).toBe(0);
    expect(startServeServer).toHaveBeenCalledWith('/tmp', expect.objectContaining({ port: 6428, openBrowser: true }));
  });

  it('respects --no-open and a custom --port', async () => {
    const code = await runServe('/tmp', { values: { port: '9000', 'no-open': true }, positionals: [] });
    expect(code).toBe(0);
    expect(startServeServer).toHaveBeenCalledWith('/tmp', expect.objectContaining({ port: 9000, openBrowser: false }));
  });

  it('warns and continues when the backlog binary is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(resolveBacklogBin).mockReturnValue(null);
    vi.mocked(spawn).mockImplementation(() => ({ on: vi.fn(), unref: vi.fn() }) as unknown as ReturnType<typeof spawn>);
    const code = await runServe('/tmp', { values: {}, positionals: [] });
    expect(code).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('backlog CLI not found'));
  });
});
