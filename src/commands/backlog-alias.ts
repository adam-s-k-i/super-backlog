// src/commands/backlog-alias.ts
import process from 'node:process';
import spawn from 'cross-spawn';

import { resolveBacklogBin } from '../lib/run.js';

/** Run a backlog.md subcommand by delegating to the resolved backlog binary. */
export function runBacklogSubcommand(cwd: string, subcommand: string, args: string[] = []): Promise<number> {
  const bin = resolveBacklogBin(cwd);
  if (!bin) {
    console.error('error: backlog CLI not found; is backlog.md installed?');
    return Promise.resolve(1);
  }
  return new Promise<number>((resolve) => {
    const child = spawn(bin, [subcommand, ...args], {
      cwd,
      stdio: 'inherit',
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
}
