// test/unit/backlog-alias.test.ts
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';

import { runBacklogSubcommand } from '../../src/commands/backlog-alias.js';

let dirs: string[] = [];

function freshDir(prefix = 'sbl-alias-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function fabricateBacklogBin(dir: string, script: string): void {
  const binDir = join(dir, 'node_modules', '.bin');
  mkdirSync(binDir, { recursive: true });
  if (process.platform === 'win32') {
    writeFileSync(join(binDir, 'backlog.cmd'), `@echo off\r\n${script}\r\n`);
  } else {
    const bin = join(binDir, 'backlog');
    writeFileSync(bin, `#!/bin/sh\n${script}\n`);
    chmodSync(bin, 0o755);
  }
}

afterEach(() => {
  for (const d of dirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {}
  }
  dirs = [];
});

describe('runBacklogSubcommand', () => {
  it('returns 1 when backlog binary is not found', async () => {
    const dir = freshDir();
    const code = await runBacklogSubcommand(dir, 'browser', []);
    expect(code).toBe(1);
  });

  it('delegates browser subcommand to the resolved backlog binary', async () => {
    const dir = freshDir();
    fabricateBacklogBin(dir, 'echo browser-called %1 %2 > output.txt');
    const code = await runBacklogSubcommand(dir, 'browser', ['--no-open']);
    expect(code).toBe(0);
    const output = readFileSync(join(dir, 'output.txt'), 'utf8').trim();
    expect(output).toContain('browser-called');
    expect(output).toContain('--no-open');
  });

  it('delegates board subcommand to the resolved backlog binary', async () => {
    const dir = freshDir();
    fabricateBacklogBin(dir, 'echo board-called %1 > output.txt');
    const code = await runBacklogSubcommand(dir, 'board', []);
    expect(code).toBe(0);
    const output = readFileSync(join(dir, 'output.txt'), 'utf8').trim();
    expect(output).toContain('board-called');
  });

  it('forwards the exit code from the backlog binary', async () => {
    const dir = freshDir();
    fabricateBacklogBin(dir, 'exit /b 7');
    const code = await runBacklogSubcommand(dir, 'browser', []);
    expect(code).toBe(7);
  });
});
