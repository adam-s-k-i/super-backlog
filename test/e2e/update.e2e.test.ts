// test/e2e/update.e2e.test.ts
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';

import { CLI_PATH, fakeNpmEnv, runCli, scaffoldAndInit } from './helpers.js';

interface UpdateResult {
  out: string;
  err: string;
  status: number;
}

function runUpdate(dir: string): UpdateResult {
  try {
    const out = execFileSync(process.execPath, [CLI_PATH, 'update'], {
      cwd: dir,
      env: { ...process.env, SBL_SKIP_INSTALL: '1', SBL_FORCE_OFFLINE: '1', SBL_SKIP_UPDATE_CHECK: '1' },
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

const OLD_POINTER = [
  '## Workflow system (managed by super-backlog)',
  '',
  'This project uses the combined Backlog.md + Superpowers workflow. Read the',
  'integration block in AGENTS.md (section between SUPER-BACKLOG markers) and follow',
  'it. Tasks are managed exclusively through the `backlog` CLI.',
  '',
].join('\n');

/** Rewinds CLAUDE.md and AGENTS.md to the pre-routing-rule glue, with user content around the pointer. */
function ageGlue(dir: string): void {
  writeFileSync(
    join(dir, 'CLAUDE.md'),
    `# Project notes\n\nkeep me above\n\n${OLD_POINTER}\n## Local rules\n\nkeep me below\n`,
  );
  const agentsPath = join(dir, 'AGENTS.md');
  const aged = readFileSync(agentsPath, 'utf8')
    .replace(/### Model routing for subagents[\s\S]*?(?=Project-specific human gates)/, '')
    .replace(/^6\. Delegate by tier.*\r?\n/m, '');
  writeFileSync(agentsPath, aged);
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

  it('refreshes a stale CLAUDE.md pointer and AGENTS.md block, then stays stable', () => {
    freshScaffold();
    ageGlue(dir);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).not.toContain('Model routing for subagents');

    expect(runUpdate(dir).status).toBe(4);

    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(claude).toContain('"Model routing for subagents"');
    expect(claude).toContain('keep me above');
    expect(claude).toContain('## Local rules');
    expect(claude).toContain('keep me below');
    expect(claude.match(/^## Workflow system \(managed by super-backlog\)/gm)).toHaveLength(1);
    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('### Model routing for subagents');
    expect(agents).toMatch(/^6\. Delegate by tier/m);

    // second run: nothing left to change
    expect(runUpdate(dir).status).toBe(4);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toBe(claude);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toBe(agents);
  });

  it('keeps CRLF line endings in AGENTS.md and CLAUDE.md and is byte-stable on the second run', () => {
    freshScaffold();
    ageGlue(dir);
    for (const name of ['AGENTS.md', 'CLAUDE.md']) {
      const p = join(dir, name);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
    }
    // re-create the shape the pre-fix code wrote into CRLF files: LF block + LF terminator, lone-LF pointer separator
    const agentsPath = join(dir, 'AGENTS.md');
    writeFileSync(
      agentsPath,
      // user content above the block keeps the file CRLF (the scaffolded AGENTS.md holds only the block)
      '# Project agents\r\n\r\n' +
        readFileSync(agentsPath, 'utf8').replace(
          /<!-- SUPER-BACKLOG:[\s\S]*?<!-- SUPER-BACKLOG END -->\r?\n/,
          (span) => span.replace(/\r\n/g, '\n'),
        ),
    );
    const claudePath = join(dir, 'CLAUDE.md');
    writeFileSync(
      claudePath,
      readFileSync(claudePath, 'utf8').replace('\r\n\r\n## Workflow system', '\r\n\n## Workflow system'),
    );
    expect(readFileSync(agentsPath, 'utf8')).toMatch(/(?<!\r)\n/);
    expect(readFileSync(claudePath, 'utf8')).toMatch(/(?<!\r)\n/);

    expect(runUpdate(dir).status).toBe(4);

    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(agents).toContain('### Model routing for subagents');
    expect(claude).toContain('"Model routing for subagents"');
    expect(agents).not.toMatch(/(?<!\r)\n/);
    expect(claude).not.toMatch(/(?<!\r)\n/);

    expect(runUpdate(dir).status).toBe(4);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toBe(agents);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toBe(claude);
  });

  it('uninstall after a pointer refresh removes pointer and block cleanly', () => {
    freshScaffold();
    ageGlue(dir);
    runUpdate(dir);

    const out = runCli(dir, ['uninstall']);

    expect(out).toContain('removed: CLAUDE.md pointer section');
    expect(out).toContain('removed: AGENTS.md managed block');
    expect(out).not.toMatch(/^\s+- (CLAUDE\.md pointer section|AGENTS\.md managed block)$/m);
    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(claude).not.toMatch(/Workflow system \(managed by super-backlog\)/);
    expect(claude).toContain('keep me above');
    expect(claude).toContain('## Local rules');
    expect(claude).toContain('keep me below');
  });

  it('exits 1 naming opencode.json when it is malformed', () => {
    freshScaffold();
    writeFileSync(join(dir, 'opencode.json'), '{ not json');

    const { err, status } = runUpdate(dir);

    expect(status).toBe(1);
    expect(err).toContain('opencode.json');
    expect(err).toMatch(/not valid JSON/i);
  });

  it('exits 1 naming package.json when it is malformed', () => {
    freshScaffold();
    writeFileSync(join(dir, 'package.json'), '{ bad');

    const { err, status } = runUpdate(dir);

    expect(status).toBe(1);
    expect(err).toContain('package.json');
    expect(err).toMatch(/not valid JSON/i);
  });
});

describe('sbl update self-update check (fake npm on PATH)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  // TASK-77: the awaited registry check used to unref every handle, so Node
  // exited 0 mid-await and `sbl update` silently did nothing.
  it('awaits the registry check, then refreshes without installing when already current', () => {
    const dir = scaffoldAndInit();
    dirs.push(dir);
    fabricateLocalBacklogBin(dir);
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const installed = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }).version;
    const fake = fakeNpmEnv({ FAKE_NPM_VERSION: installed, FAKE_NPM_DELAY_MS: '300', SBL_SKIP_INSTALL: '1' });
    dirs.push(fake.dir);
    const log = join(fake.dir, 'calls.log');
    // isolate the startup hint's cache from the real home directory
    const env = { ...fake.env, FAKE_NPM_LOG: log, HOME: fake.dir, USERPROFILE: fake.dir };
    delete env.SBL_SKIP_UPDATE_CHECK;
    delete env.SBL_FORCE_OFFLINE;

    const r = spawnSync(process.execPath, [CLI_PATH, 'update'], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });

    expect(r.stdout).toContain('super-backlog update complete');
    expect(r.stdout).toContain('backlog.md (latest):   9.9.9-fake');
    const calls = readFileSync(log, 'utf8').split(/\r?\n/);
    expect(calls).toContain('view super-backlog version');
    expect(calls.some((c) => /^(i|install)\b/.test(c))).toBe(false);
  });
});
