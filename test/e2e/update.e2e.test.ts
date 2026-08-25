// test/e2e/update.e2e.test.ts
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';

import { CLI_PATH, scaffoldAndInit } from './helpers.js';

interface UpdateResult {
  out: string;
  status: number;
}

function runUpdate(dir: string): UpdateResult {
  try {
    const out = execFileSync(process.execPath, [CLI_PATH, 'update'], {
      cwd: dir,
      env: { ...process.env, SBL_SKIP_INSTALL: '1', SBL_FORCE_OFFLINE: '1' },
      encoding: 'utf8',
    });
    return { out, status: 0 };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string | Buffer };
    const stdout = e.stdout ?? '';
    return {
      out: typeof stdout === 'string' ? stdout : stdout.toString('utf8'),
      status: e.status ?? -1,
    };
  }
}

function fabricateLocalBacklogBin(dir: string): void {
  const binDir = join(dir, 'node_modules', '.bin');
  mkdirSync(binDir, { recursive: true });
  if (process.platform === 'win32') {
    writeFileSync(join(binDir, 'backlog.cmd'), '@echo off\r\necho 9.9.9-e2e\r\n');
  } else {
    const bin = join(binDir, 'backlog');
    writeFileSync(bin, '#!/bin/sh\necho 9.9.9-e2e\n');
    chmodSync(bin, 0o755);
  }
}

describe('sbl update (SBL_SKIP_INSTALL + SBL_FORCE_OFFLINE)', () => {
  let dir = '';
  function freshScaffold(): string {
    dir = scaffoldAndInit();
    fabricateLocalBacklogBin(dir);
    return dir;
  }
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('refreshes glue offline, prints local version line and offline warning, exits 4', () => {
    freshScaffold();

    const { out, status } = runUpdate(dir);

    expect(status).toBe(4); // success with warnings
    expect(out).toContain('upstream versions:');
    expect(out).toContain('backlog.md (local):'); // local-version attempt reported
    expect(out).toContain('9.9.9-e2e'); // fake local bin answered via spawn
    expect(out).toMatch(/could not query the npm registry \(offline\?\)/);
    expect(existsSync(join(dir, '.git', 'hooks', 'pre-commit'))).toBe(true);

    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    expect(agents).toMatch(/SUPER-BACKLOG:\d+\.\d+\.\d+ START/); // block still present
    expect(
      readFileSync(join(dir, 'backlog', 'config.yml'), 'utf8'),
    ).toMatch(/^project_name: /m); // task data untouched
  });

  it('is idempotent: second run exits 4 again and never duplicates the marker block', () => {
    freshScaffold();

    runUpdate(dir);
    const second = runUpdate(dir);

    expect(second.status).toBe(4);
    expect(second.out).toMatch(/could not query the npm registry \(offline\?\)/);
    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    expect(agents.match(/SUPER-BACKLOG:\d+\.\d+\.\d+ START/g)).toHaveLength(1);
    expect(existsSync(join(dir, 'backlog', 'config.yml'))).toBe(true);
  });
});
