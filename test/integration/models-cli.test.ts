// test/integration/models-cli.test.ts
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInit, type ParsedArgs } from '../../src/commands/init.js';
import { runModels } from '../../src/commands/models.js';
import * as runModule from '../../src/lib/run.js';
import { injectBlock } from '../../src/lib/markers.js';

const dirs: string[] = [];
const NOTICE = 'router is disabled; run sbl models enable to use these tiers';

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-models-'));
  dirs.push(dir);
  return dir;
}

function emptyArgs(values: Record<string, unknown> = {}): ParsedArgs {
  return { values: values as Record<string, string | boolean | undefined>, positionals: [] };
}

function models(cwd: string, ...positionals: string[]): Promise<number> {
  return runModels(cwd, { values: {}, positionals });
}

function config(cwd: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(cwd, '.super-backlog', 'models.json'), 'utf8')) as Record<string, unknown>;
}

function capture(): { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    out.push(a.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    err.push(a.map(String).join(' '));
  });
  return { out, err };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('sbl models CLI', () => {
  it('enables router via init --models and writes config', async () => {
    const cwd = freshDir();
    capture();
    await runInit(cwd, emptyArgs({ pm: 'skip', models: true }));
    expect(config(cwd).enabled).toBe(true);
  });

  it('enable/disable subcommands toggle the config and rewrite the agents', async () => {
    const cwd = freshDir();
    const { out } = capture();
    expect(await models(cwd, 'enable')).toBe(0);
    expect(config(cwd).enabled).toBe(true);
    expect(out[0]).toBe('model router enabled');
    for (const t of ['light', 'standard', 'strong', 'top']) {
      expect(existsSync(join(cwd, `.claude/agents/sbl-${t}.md`))).toBe(true);
      expect(existsSync(join(cwd, `.opencode/agents/sbl-${t}.md`))).toBe(true);
    }
    expect(readFileSync(join(cwd, '.claude/agents/sbl-top.md'), 'utf8')).toContain('\nmodel: fable\n');

    expect(await models(cwd, 'disable')).toBe(0);
    expect(config(cwd).enabled).toBe(false);
    expect(out).toContain('model router disabled');
    expect(readFileSync(join(cwd, '.claude/agents/sbl-top.md'), 'utf8')).toContain('\nmodel: inherit\n');
  });

  it('show prints the normalized config', async () => {
    const cwd = freshDir();
    const { out } = capture();
    expect(await models(cwd)).toBe(0);
    expect(out.join('\n')).toBe('{\n  "version": 2,\n  "enabled": false,\n  "tiers": {}\n}');
  });

  it('set writes the tier, refreshes the agents and re-renders the block', async () => {
    const cwd = freshDir();
    writeFileSync(join(cwd, 'AGENTS.md'), injectBlock('', '0.0.1', 'old body').content);
    const { out } = capture();
    await models(cwd, 'enable');
    out.length = 0;
    expect(await models(cwd, 'set', 'opencode', 'light', 'o/light')).toBe(0);
    expect(config(cwd)).toEqual({ version: 2, enabled: true, tiers: { opencode: { light: 'o/light' } } });
    expect(out).toEqual(['opencode light = o/light', 'updated .opencode/agents/sbl-light.md', 'updated AGENTS.md']);
    expect(readFileSync(join(cwd, '.opencode/agents/sbl-light.md'), 'utf8')).toContain('\nmodel: o/light\n');
    expect(readFileSync(join(cwd, 'AGENTS.md'), 'utf8')).toContain('`o/light`');
  });

  it('set "-" removes the entry', async () => {
    const cwd = freshDir();
    const { out } = capture();
    await models(cwd, 'set', 'claude', 'top', 'mythos');
    expect(await models(cwd, 'set', 'claude', 'top', '-')).toBe(0);
    expect(config(cwd)).toEqual({ version: 2, enabled: false, tiers: {} });
    expect(out).toContain('claude top removed');
  });

  it('set without a config creates it disabled and prints the notice', async () => {
    const cwd = freshDir();
    const { out } = capture();
    expect(await models(cwd, 'set', 'claude', 'top', 'mythos')).toBe(0);
    expect(config(cwd)).toEqual({ version: 2, enabled: false, tiers: { claude: { top: 'mythos' } } });
    expect(out).toEqual(['claude top = mythos', NOTICE]);
    expect(existsSync(join(cwd, '.claude'))).toBe(false);
  });

  it('set validates harness, tier and model id without writing', async () => {
    const cwd = freshDir();
    const { err } = capture();
    expect(await models(cwd, 'set', 'gemini', 'light', 'x/y')).toBe(1);
    expect(await models(cwd, 'set', 'claude', 'huge', 'x/y')).toBe(1);
    expect(await models(cwd, 'set', 'claude', 'light', 'has space')).toBe(1);
    expect(await models(cwd, 'set', 'claude', 'light')).toBe(1);
    expect(err).toEqual([
      'invalid harness: gemini (allowed: claude, opencode)',
      'invalid tier: huge (allowed: light, standard, strong, top)',
      'invalid model id: "has space" (allowed: letters, digits and . _ : / @ + -, starting with a letter or digit, not ending with ":", at most 100 characters; "-" removes the entry)',
      'usage: sbl models set <harness> <tier> <model>',
    ]);
    expect(existsSync(join(cwd, '.super-backlog'))).toBe(false);
  });

  it('discover persists the OpenCode tiers and prints them', async () => {
    const cwd = freshDir();
    vi.spyOn(runModule, 'runCapture').mockReturnValue({
      status: 0,
      stdout: 'opencode/claude-haiku-4-5\nopencode/claude-sonnet-4-6\n',
      stderr: '',
    });
    const { out } = capture();
    expect(await models(cwd, 'discover')).toBe(0);
    const cfg = config(cwd);
    expect(cfg.tiers).toEqual({ opencode: { light: 'opencode/claude-haiku-4-5', standard: 'opencode/claude-sonnet-4-6' } });
    expect(typeof cfg.discoveredAt).toBe('string');
    expect(cfg.enabled).toBe(false);
    expect(out).toEqual([
      'opencode light: opencode/claude-haiku-4-5',
      'opencode standard: opencode/claude-sonnet-4-6',
      'opencode strong: (session model)',
      'opencode top: (session model)',
      NOTICE,
    ]);
  });

  it('discover failure exits 1 without writing', async () => {
    const cwd = freshDir();
    vi.spyOn(runModule, 'runCapture').mockReturnValue({ status: 1, stdout: '', stderr: 'not found' });
    const { err } = capture();
    expect(await models(cwd, 'discover')).toBe(1);
    expect(err).toEqual(['discovery failed (is the OpenCode CLI available?)']);
    expect(existsSync(join(cwd, '.super-backlog'))).toBe(false);
  });

  it('rejects unknown subcommands', async () => {
    const cwd = freshDir();
    const { err } = capture();
    expect(await models(cwd, 'frobnicate')).toBe(1);
    expect(err).toEqual(['unknown models subcommand: frobnicate']);
  });
});
