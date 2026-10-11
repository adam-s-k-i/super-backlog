// test/e2e/version-check.e2e.test.ts
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { CLI_PATH, fakeNpmEnv } from './helpers.js';

// Unit tests inject fetchLatest, so only a real child process shows whether
// fetchLatestVersion keeps the event loop alive while it is awaited (TASK-77).
const MODULE_URL = pathToFileURL(join(__dirname, '..', '..', 'dist', 'lib', 'version-check.js')).href;

interface ChildResult {
  out: string;
  status: number | null;
  ms: number;
}

const dirs: string[] = [];
// Background mode deliberately leaves the fake npm (cmd.exe -> node) starting up
// after the child exits; on Windows its open files block an immediate delete
// (EBUSY/EPERM). Only the async rm retries those: Node's native rmSync gives up.
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function runChild(body: string, delayMs: number): ChildResult {
  const { dir, env } = fakeNpmEnv({ FAKE_NPM_VERSION: '7.7.7', FAKE_NPM_DELAY_MS: String(delayMs) });
  dirs.push(dir);
  const code = `const { fetchLatestVersion } = await import(${JSON.stringify(MODULE_URL)});\n${body}`;
  const started = Date.now();
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    env,
    encoding: 'utf8',
    timeout: 20000,
  });
  return { out: r.stdout, status: r.status, ms: Date.now() - started };
}

describe('fetchLatestVersion in a real process', () => {
  it('foreground (default) keeps the process alive until npm answers', () => {
    const r = runChild("console.log('result:' + (await fetchLatestVersion(10000)));", 500);
    expect(r.out).toContain('result:7.7.7');
    expect(r.status).toBe(0);
  });

  it('foreground timeout resolves null and lets the process exit despite a hung npm', () => {
    const r = runChild("console.log('result:' + (await fetchLatestVersion(500)));", 15000);
    expect(r.out).toContain('result:null');
    expect(r.status).toBe(0);
    expect(r.ms).toBeLessThan(10000);
  });
});

// TASK-78: the startup hint fetched in-process with every handle unref'd, so a
// short command exited before npm answered and the cache was never refreshed.
describe('startup version hint refreshes a stale cache (real CLI)', () => {
  const STALE = { checkedAt: '2026-08-30T12:19:45.119Z', latest: '1.3.2' };

  function setup(cache: object, extra: NodeJS.ProcessEnv = {}, skipCheck = false) {
    const fake = fakeNpmEnv({ FAKE_NPM_VERSION: '7.7.7', ...extra });
    dirs.push(fake.dir);
    const log = join(fake.dir, 'calls.log');
    const env: NodeJS.ProcessEnv = { ...fake.env, FAKE_NPM_LOG: log, HOME: fake.dir, USERPROFILE: fake.dir };
    if (skipCheck) env.SBL_SKIP_UPDATE_CHECK = '1';
    else delete env.SBL_SKIP_UPDATE_CHECK;
    mkdirSync(join(fake.dir, '.super-backlog'));
    const cachePath = join(fake.dir, '.super-backlog', 'version-check.json');
    writeFileSync(cachePath, JSON.stringify(cache));
    // `sbl phase` with no args prints usage and exits 1, after the hint ran
    const run = () => {
      const started = Date.now();
      const r = spawnSync(process.execPath, [CLI_PATH, 'phase'], { cwd: fake.dir, env, encoding: 'utf8', timeout: 20000 });
      return { ...r, ms: Date.now() - started };
    };
    return { run, cachePath, log };
  }

  async function waitFor(check: () => boolean, ms: number): Promise<boolean> {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (check()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return check();
  }

  it('exits without waiting for npm, then refreshes the cache and shows the hint next run', async () => {
    const { run, cachePath } = setup(STALE, { FAKE_NPM_DELAY_MS: '1500' });

    const first = run();
    expect(first.status).toBe(1);
    // npm answers only after 1.5s, so a cache still stale on exit proves the CLI did not wait
    expect(JSON.parse(readFileSync(cachePath, 'utf8'))).toEqual(STALE);

    const refreshed = await waitFor(() => readFileSync(cachePath, 'utf8').includes('7.7.7'), 15000);
    expect(refreshed).toBe(true);
    const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as { checkedAt: string; latest: string };
    expect(cache.latest).toBe('7.7.7');
    expect(Date.now() - Date.parse(cache.checkedAt)).toBeLessThan(60000);

    expect(run().stderr).toContain('super-backlog 7.7.7 is available');
  });

  it('does not spawn npm when the cache is fresh', async () => {
    const { run, log } = setup({ checkedAt: new Date().toISOString(), latest: '1.0.0' });
    expect(run().status).toBe(1);
    await new Promise((r) => setTimeout(r, 1500));
    expect(existsSync(log)).toBe(false);
  });

  it('does not spawn npm when SBL_SKIP_UPDATE_CHECK is set', async () => {
    const { run, log } = setup(STALE, {}, true);
    expect(run().status).toBe(1);
    await new Promise((r) => setTimeout(r, 1500));
    expect(existsSync(log)).toBe(false);
  });
});
