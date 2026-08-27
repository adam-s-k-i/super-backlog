// test/integration/uninstall-hardening.test.ts
import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runInit, type ParsedArgs } from '../../src/commands/init.js';
import { runUninstall } from '../../src/commands/uninstall.js';

function args(values: Record<string, unknown> = {}): ParsedArgs {
  return { values: values as Record<string, string | boolean | undefined>, positionals: [] };
}

function tempCwd(name: string): string {
  return join(tmpdir(), `sbl-uninstall-hard-${name}-${Date.now()}`);
}

async function scaffold(cwd: string): Promise<void> {
  mkdirSync(cwd, { recursive: true });
  await runInit(
    cwd,
    args({
      pm: 'skip',
      'no-dashboard': true,
      harness: 'opencode',
      'no-refresh-hook': true,
    }),
    { doctor: () => 0 },
  );
}

describe('sbl uninstall hardening', () => {
  it('collects a failing step as an error, continues, and exits 1', async () => {
    const cwd = tempCwd('collect');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await scaffold(cwd);
      // replace AGENTS.md with a directory so its managed-block removal fails
      rmSync(join(cwd, 'AGENTS.md'));
      mkdirSync(join(cwd, 'AGENTS.md'));

      const code = runUninstall(cwd, args(), { confirm: () => false });
      const out = spy.mock.calls.map((c) => String(c[0])).join('\n');

      expect(code).toBe(1);
      expect(out).toContain('error: AGENTS.md managed block');
      // later steps still ran despite the failure
      expect(existsSync(join(cwd, '.opencode/skill/spec-to-backlog'))).toBe(false);
      // verification pass reports the remnant instead of claiming clean
      expect(out).toContain('verification: leftover kit artifacts');
      expect(out).toContain('AGENTS.md');
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('reports a clean verification when nothing is left behind', async () => {
    const cwd = tempCwd('clean');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await scaffold(cwd);
      const code = runUninstall(cwd, args(), { confirm: () => false });
      const out = spy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(code).toBe(0);
      expect(out).toContain('verification: clean');
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('removes the global package automatically with --fix-all', async () => {
    const cwd = tempCwd('fixall');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let removed = 0;
    try {
      await scaffold(cwd);
      const code = runUninstall(cwd, args({ 'fix-all': true }), {
        removeGlobal: () => {
          removed += 1;
          return 0;
        },
        confirm: () => false, // must not be consulted under --fix-all
      });
      expect(code).toBe(0);
      expect(removed).toBe(1);
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('prints the manual removal command when consent is declined', async () => {
    const cwd = tempCwd('declined');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let removed = 0;
    try {
      await scaffold(cwd);
      const code = runUninstall(cwd, args(), {
        removeGlobal: () => {
          removed += 1;
          return 0;
        },
        confirm: () => false,
      });
      const out = spy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(code).toBe(0);
      expect(removed).toBe(0);
      expect(out).toContain('npm uninstall -g super-backlog');
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('reports the manual command when global removal fails', async () => {
    const cwd = tempCwd('removalfails');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await scaffold(cwd);
      const code = runUninstall(cwd, args({ 'fix-all': true }), {
        removeGlobal: () => 1,
      });
      const out = spy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(code).toBe(1);
      expect(out).toContain('npm uninstall -g super-backlog');
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('keeps the fail-fast JSON validation ahead of any mutation', () => {
    const cwd = tempCwd('badjson');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, 'package.json'), '{ bad');
      writeFileSync(join(cwd, 'AGENTS.md'), '<!-- SUPER-BACKLOG:0.1.0 START -->\nx\n<!-- SUPER-BACKLOG END -->\n');
      const code = runUninstall(cwd, args(), { confirm: () => false });
      expect(code).toBe(1);
      // AGENTS.md untouched: fail-fast happened before any mutation
      expect(readFileSync(join(cwd, 'AGENTS.md'), 'utf8')).toContain('SUPER-BACKLOG:0.1.0 START');
    } finally {
      errSpy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
