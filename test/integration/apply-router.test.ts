// test/integration/apply-router.test.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeActions } from '../../src/init/execute.js';
import { injectBlock } from '../../src/lib/markers.js';
import { applyRouter, type ApplyOptions } from '../../src/models/apply.js';

const dirs: string[] = [];
const TIERS = ['light', 'standard', 'strong', 'top'];
const CONFIG = '.super-backlog/models.json';

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-apply-'));
  dirs.push(dir);
  return dir;
}

function put(cwd: string, rel: string, text: string): void {
  mkdirSync(dirname(join(cwd, rel)), { recursive: true });
  writeFileSync(join(cwd, rel), text);
}

function read(cwd: string, rel: string): string {
  return readFileSync(join(cwd, rel), 'utf8');
}

function opts(over: Partial<ApplyOptions> = {}): ApplyOptions {
  return { install: false, block: false, version: '9.9.9', ...over };
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('applyRouter', () => {
  it('renders configured examples into the managed block', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, pretty({ version: 2, enabled: true, tiers: { claude: { top: 'mythos' } } }));
    put(cwd, 'AGENTS.md', injectBlock('', '9.9.9', 'old body').content);
    expect(applyRouter(cwd, opts({ block: true }))).toEqual(['updated AGENTS.md']);
    const agents = read(cwd, 'AGENTS.md');
    expect(agents).toContain('Examples (from `.super-backlog/models.json`; change them with');
    expect(agents).toContain('top `mythos`');
  });

  it('install writes four agents per harness with concrete models', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, pretty({ version: 2, enabled: true, tiers: { opencode: { light: 'o/light' } } }));
    expect(applyRouter(cwd, opts({ install: true }))).toEqual([
      ...TIERS.map((t) => `created .claude/agents/sbl-${t}.md`),
      ...TIERS.map((t) => `created .opencode/agents/sbl-${t}.md`),
    ]);
    expect(read(cwd, '.claude/agents/sbl-top.md')).toContain('\nmodel: fable\n');
    expect(read(cwd, '.opencode/agents/sbl-light.md')).toContain('\nmodel: o/light\n');
    expect(read(cwd, '.opencode/agents/sbl-strong.md')).not.toMatch(/^model:/m);
    for (const harness of ['.claude', '.opencode']) {
      for (const t of TIERS) expect(read(cwd, `${harness}/agents/sbl-${t}.md`)).not.toContain('TIER_PLACEHOLDER');
    }
  });

  it('is idempotent', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, pretty({ version: 2, enabled: true, tiers: {} }));
    applyRouter(cwd, opts({ install: true }));
    expect(applyRouter(cwd, opts({ install: true }))).toEqual([]);
    expect(applyRouter(cwd, opts())).toEqual([]);
  });

  it('does nothing without install and without router files', () => {
    const cwd = freshDir();
    expect(applyRouter(cwd, opts())).toEqual([]);
    expect(existsSync(join(cwd, '.claude'))).toBe(false);
    expect(existsSync(join(cwd, '.opencode'))).toBe(false);
  });

  it('only refreshes harnesses that are router-installed', () => {
    const cwd = freshDir();
    put(cwd, '.opencode/agents/sbl-worker.md', '---\nmodel: TIER_PLACEHOLDER\n---\n');
    expect(applyRouter(cwd, opts())).toEqual([
      ...TIERS.map((t) => `created .opencode/agents/sbl-${t}.md`),
      'removed legacy .opencode/agents/sbl-worker.md',
    ]);
    expect(existsSync(join(cwd, '.claude'))).toBe(false);
  });

  it('migrates a v1 file once and reports it', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, JSON.stringify({ version: 1, enabled: true, mode: 'family', individual: { workhorse: 'i/w' } }));
    expect(applyRouter(cwd, opts())).toEqual(['migrated .super-backlog/models.json to version 2']);
    expect(read(cwd, CONFIG)).toBe(pretty({ version: 2, enabled: true, tiers: { opencode: { standard: 'i/w' } } }));
    expect(applyRouter(cwd, opts())).toEqual([]);
  });

  it('normalizes a v2 file with invalid entries', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, JSON.stringify({ version: 2, enabled: true, tiers: { claude: { light: 'bad id' } } }));
    expect(applyRouter(cwd, opts())).toEqual(['normalized .super-backlog/models.json']);
    expect(read(cwd, CONFIG)).toBe(pretty({ version: 2, enabled: true, tiers: {} }));
  });

  it('does not rewrite a file that differs only by CRLF', () => {
    const cwd = freshDir();
    const crlf = pretty({ version: 2, enabled: false, tiers: {} }).replace(/\n/g, '\r\n');
    put(cwd, CONFIG, crlf);
    expect(applyRouter(cwd, opts())).toEqual([]);
    expect(read(cwd, CONFIG)).toBe(crlf);
  });

  it('does not rewrite a normalized file that only differs by a UTF-8 BOM', () => {
    const cwd = freshDir();
    const bom = `\uFEFF${pretty({ version: 2, enabled: true, tiers: {} })}`;
    put(cwd, CONFIG, bom);
    expect(applyRouter(cwd, opts())).toEqual([]);
    expect(read(cwd, CONFIG)).toBe(bom);
  });

  it('migrates a v1 file with a UTF-8 BOM instead of calling it invalid', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, `\uFEFF${JSON.stringify({ version: 1, enabled: true, individual: { workhorse: 'i/w' } })}`);
    expect(applyRouter(cwd, opts())).toEqual(['migrated .super-backlog/models.json to version 2']);
    expect(read(cwd, CONFIG)).toBe(pretty({ version: 2, enabled: true, tiers: { opencode: { standard: 'i/w' } } }));
  });

  it('leaves installed agents alone while models.json has a newer version', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, JSON.stringify({ version: 3, enabled: true, tiers: { claude: { top: 'future' } } }));
    const agent = '---\nname: sbl-top\nmodel: future\n---\nbody\n';
    put(cwd, '.claude/agents/sbl-top.md', agent);
    expect(applyRouter(cwd, opts())).toEqual([
      'warning: .super-backlog/models.json has version 3, which this super-backlog does not support - left unchanged; upgrade super-backlog or delete it',
    ]);
    expect(read(cwd, '.claude/agents/sbl-top.md')).toBe(agent);
    expect(existsSync(join(cwd, '.claude/agents/sbl-light.md'))).toBe(false);
  });

  it('never rewrites a file with a newer version and warns instead', () => {
    const cwd = freshDir();
    const v3 = JSON.stringify({ version: 3, enabled: true, tiers: { claude: { top: 'future' } } });
    put(cwd, CONFIG, v3);
    expect(applyRouter(cwd, opts())).toEqual([
      'warning: .super-backlog/models.json has version 3, which this super-backlog does not support - left unchanged; upgrade super-backlog or delete it',
    ]);
    expect(read(cwd, CONFIG)).toBe(v3);
  });

  it('leaves an unparsable models.json alone with a warning and treats the router as disabled', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, '{ broken');
    put(cwd, '.claude/agents/sbl-light.md', '---\nname: sbl-light\nmodel: haiku\n---\nbody\n');
    expect(applyRouter(cwd, opts())).toEqual([
      'warning: .super-backlog/models.json is not valid JSON - left unchanged; fix or delete it',
      'updated .claude/agents/sbl-light.md',
      ...['standard', 'strong', 'top'].map((t) => `created .claude/agents/sbl-${t}.md`),
    ]);
    expect(read(cwd, CONFIG)).toBe('{ broken');
    expect(read(cwd, '.claude/agents/sbl-light.md')).toBe('---\nname: sbl-light\nmodel: inherit\n---\nbody\n');
  });

  it('preserves user edits and only rewrites the model line', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, pretty({ version: 2, enabled: true, tiers: { opencode: { strong: 'o/strong' } } }));
    put(cwd, '.opencode/agents/sbl-strong.md', '---\nname: sbl-strong\ndescription: my words\nmode: subagent\n---\nmy body\n');
    applyRouter(cwd, opts());
    expect(read(cwd, '.opencode/agents/sbl-strong.md')).toBe('---\nmodel: o/strong\nname: sbl-strong\ndescription: my words\nmode: subagent\n---\nmy body\n');
  });

  it('writes inherit for Claude and no model line for OpenCode when disabled', () => {
    const cwd = freshDir();
    put(cwd, CONFIG, pretty({ version: 2, enabled: false, tiers: { claude: { top: 'mythos' }, opencode: { top: 'o/top' } } }));
    applyRouter(cwd, opts({ install: true }));
    expect(read(cwd, '.claude/agents/sbl-top.md')).toContain('\nmodel: inherit\n');
    expect(read(cwd, '.opencode/agents/sbl-top.md')).not.toMatch(/^model:/m);
  });

  it('re-injects the managed block when block is true', () => {
    const cwd = freshDir();
    put(cwd, 'AGENTS.md', `# Project\n\n${injectBlock('', '0.0.1', 'old body').content}\n`);
    expect(applyRouter(cwd, opts({ block: true }))).toEqual(['updated AGENTS.md']);
    const agents = read(cwd, 'AGENTS.md');
    expect(agents).toContain('<!-- SUPER-BACKLOG:9.9.9 START -->');
    expect(agents).not.toContain('old body');
    expect(agents.startsWith('# Project\n\n')).toBe(true);
  });

  it('leaves AGENTS.md without a managed block alone', () => {
    const cwd = freshDir();
    put(cwd, 'AGENTS.md', '# Project\n');
    expect(applyRouter(cwd, opts({ block: true }))).toEqual([]);
    expect(read(cwd, 'AGENTS.md')).toBe('# Project\n');
  });
});

const CTX = { version: '0.4.0', projectName: 'test', hasBacklogConfig: false };

describe('install-model-router action', () => {
  it('enables the config and installs both harnesses', async () => {
    const cwd = freshDir();
    const result = await executeActions(cwd, [{ kind: 'install-model-router', enabled: true }], {
      version: '0.4.0',
      projectName: 'test',
      hasBacklogConfig: false,
    });
    expect(result.applied).toBe(1);
    expect(JSON.parse(read(cwd, CONFIG)).enabled).toBe(true);
    for (const t of TIERS) {
      expect(existsSync(join(cwd, `.claude/agents/sbl-${t}.md`))).toBe(true);
      expect(existsSync(join(cwd, `.opencode/agents/sbl-${t}.md`))).toBe(true);
    }
    expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(false);
    expect(existsSync(join(cwd, '.claude/settings.json'))).toBe(false);
  });

  it('warns and skips on an unparsable models.json, leaving it byte-unchanged', async () => {
    const cwd = freshDir();
    put(cwd, CONFIG, '{ broken');
    const result = await executeActions(cwd, [{ kind: 'install-model-router', enabled: true }], CTX);
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.warnings).toEqual([
      '.super-backlog/models.json is not valid JSON - left unchanged; fix or delete it (model router not installed)',
    ]);
    expect(read(cwd, CONFIG)).toBe('{ broken');
    expect(existsSync(join(cwd, '.claude/agents'))).toBe(false);
  });
});

describe('refresh-model-router action', () => {
  it('counts router warnings as execute warnings', async () => {
    const cwd = freshDir();
    put(cwd, CONFIG, '{ broken');
    put(cwd, '.claude/agents/sbl-top.md', '---\nname: sbl-top\nmodel: opus\n---\nbody\n');
    const result = await executeActions(cwd, [{ kind: 'refresh-model-router' }], CTX);
    expect(result.warnings).toEqual(['.super-backlog/models.json is not valid JSON - left unchanged; fix or delete it']);
    expect(read(cwd, CONFIG)).toBe('{ broken');
  });

  it('turns a router failure into a warning and runs the remaining actions', async () => {
    const cwd = freshDir();
    mkdirSync(join(cwd, CONFIG), { recursive: true }); // models.json as a directory makes the read throw
    const result = await executeActions(
      cwd,
      [{ kind: 'refresh-model-router' }, { kind: 'write', path: 'after.txt', contents: 'ok\n' }],
      CTX,
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/^model router refresh failed: /);
    expect(read(cwd, 'after.txt')).toBe('ok\n');
  });
});
