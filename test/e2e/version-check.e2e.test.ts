// test/e2e/version-check.e2e.test.ts
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { fakeNpmEnv } from './helpers.js';

// Unit tests inject fetchLatest, so only a real child process shows whether
// fetchLatestVersion keeps the event loop alive while it is awaited (TASK-77).
const MODULE_URL = pathToFileURL(join(__dirname, '..', '..', 'dist', 'lib', 'version-check.js')).href;

interface ChildResult {
  out: string;
  status: number | null;
  ms: number;
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
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
    const r = runChild("console.log('result:' + (await fetchLatestVersion(500, { background: false })));", 15000);
    expect(r.out).toContain('result:null');
    expect(r.status).toBe(0);
    expect(r.ms).toBeLessThan(10000);
  });

  it('background mode never holds the process open for a slow npm', () => {
    const r = runChild(
      "void fetchLatestVersion(10000, { background: true }).then((v) => console.log('late:' + v));\nconsole.log('started');",
      15000,
    );
    expect(r.out).toContain('started');
    expect(r.out).not.toContain('late:');
    expect(r.status).toBe(0);
    expect(r.ms).toBeLessThan(10000);
  });
});
