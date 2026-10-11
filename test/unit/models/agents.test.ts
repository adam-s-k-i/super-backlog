// test/unit/models/agents.test.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  agentModel,
  agentPath,
  cleanLegacy,
  isRouterInstalled,
  renderAgentFile,
  setModelLine,
  writeAgentFile,
} from '../../../src/models/agents.js';
import { normalizeConfig } from '../../../src/models/config.js';

const dirs: string[] = [];

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-agents-'));
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

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

const SBL_HOOK = { matcher: '*', hooks: [{ type: 'command', command: 'node', args: ['node_modules/super-backlog/dist/templates/cc-session-hook.js'] }] };
const OWN_HOOK = { matcher: '*', hooks: [{ type: 'command', command: 'node', args: ['scripts/my-own-hook.js'] }] };

describe('renderAgentFile', () => {
  it('renders the Claude file from the spec', () => {
    expect(renderAgentFile('claude', 'standard', 'sonnet')).toBe(
      [
        '---',
        'name: sbl-standard',
        'description: Standard tier — clearly specified routine work such as research, summaries, routine code, tests and documentation.',
        'model: sonnet',
        '---',
        'Work on the delegated task exactly as briefed. Return the result with evidence (paths, sources, numbers), no raw logs.',
        '',
      ].join('\n'),
    );
  });

  it('adds mode: subagent for OpenCode and omits a missing model', () => {
    const text = renderAgentFile('opencode', 'top', null);
    expect(text.split('\n').slice(0, 5)).toEqual([
      '---',
      'name: sbl-top',
      'description: Top tier — analysis, design, architecture and every decision where a mistake is costly; everything backlog/docs/critical-areas.md lists as critical.',
      'mode: subagent',
      '---',
    ]);
    expect(text).not.toMatch(/^model:/m);
    expect(renderAgentFile('opencode', 'light', 'o/l').split('\n').slice(3, 5)).toEqual(['mode: subagent', 'model: o/l']);
  });

  it('describes light and strong as in the spec', () => {
    expect(renderAgentFile('claude', 'light', 'haiku')).toContain(
      'description: Light tier — purely mechanical work such as searching, listing, extracting and reformatting.\n',
    );
    expect(renderAgentFile('claude', 'strong', 'opus')).toContain(
      'description: Strong tier — demanding work with clear boundaries such as complex implementation, debugging and reviews.\n',
    );
  });
});

describe('agentModel', () => {
  const enabled = normalizeConfig({ version: 2, enabled: true, tiers: { claude: { top: 'mythos' }, opencode: { light: 'o/l' } } });
  const disabled = { ...enabled, enabled: false };

  it('uses the configured value or the Claude default when enabled', () => {
    expect(agentModel(enabled, 'claude', 'top')).toBe('mythos');
    expect(agentModel(enabled, 'claude', 'light')).toBe('haiku');
    expect(agentModel(enabled, 'opencode', 'light')).toBe('o/l');
    expect(agentModel(enabled, 'opencode', 'strong')).toBeNull();
  });

  it('writes inherit for Claude and nothing for OpenCode when disabled', () => {
    expect(agentModel(disabled, 'claude', 'top')).toBe('inherit');
    expect(agentModel(disabled, 'opencode', 'light')).toBeNull();
  });
});

describe('setModelLine', () => {
  it('replaces an existing model line', () => {
    expect(setModelLine('---\nname: x\nmodel: TIER_PLACEHOLDER\n---\nbody\n', 'haiku')).toBe('---\nname: x\nmodel: haiku\n---\nbody\n');
  });

  it('inserts a missing model line after the opening ---', () => {
    expect(setModelLine('---\nname: x\n---\nbody\n', 'haiku')).toBe('---\nmodel: haiku\nname: x\n---\nbody\n');
  });

  it('removes the model line for null', () => {
    expect(setModelLine('---\nname: x\nmodel: o/l\n---\nbody\n', null)).toBe('---\nname: x\n---\nbody\n');
  });

  it('keeps CRLF line endings', () => {
    expect(setModelLine('---\r\nname: x\r\nmodel: a\r\n---\r\nbody\r\n', 'b')).toBe('---\r\nname: x\r\nmodel: b\r\n---\r\nbody\r\n');
  });

  it('only touches the frontmatter', () => {
    expect(setModelLine('---\nname: x\n---\nmodel: in the body\n', 'm')).toBe('---\nmodel: m\nname: x\n---\nmodel: in the body\n');
  });

  it('keeps a UTF-8 BOM in front of the existing frontmatter', () => {
    expect(setModelLine('\uFEFF---\nname: x\nmodel: a\n---\nbody\n', 'b')).toBe('\uFEFF---\nname: x\nmodel: b\n---\nbody\n');
  });

  it('leaves a file with unclosed frontmatter unchanged, so repeated applies are idempotent', () => {
    const unclosed = '---\nname: x\nmodel: a\nbody\n';
    expect(setModelLine(unclosed, 'b')).toBe(unclosed);
    expect(setModelLine(unclosed, null)).toBe(unclosed);
    expect(setModelLine(setModelLine(unclosed, 'b'), 'b')).toBe(unclosed);
  });

  it('accepts a closing --- with trailing whitespace', () => {
    expect(setModelLine('---\nname: x\nmodel: a\n---  \nbody\n', 'b')).toBe('---\nname: x\nmodel: b\n---  \nbody\n');
    const once = setModelLine('---\nname: x\n--- \t\nbody\n', 'b');
    expect(once).toBe('---\nmodel: b\nname: x\n--- \t\nbody\n');
    expect(setModelLine(once, 'b')).toBe(once);
  });

  it('accepts an opening --- with trailing whitespace instead of prepending a second frontmatter', () => {
    const once = setModelLine('--- \nname: x\n---\nbody\n', 'b');
    expect(once).toBe('--- \nmodel: b\nname: x\n---\nbody\n');
    expect(setModelLine(once, 'b')).toBe(once);
    expect(setModelLine('---\t\r\nname: x\r\nmodel: a\r\n---\r\nbody\r\n', null)).toBe('---\t\r\nname: x\r\n---\r\nbody\r\n');
  });

  it('prepends frontmatter to a file without one, and leaves it alone for null', () => {
    expect(setModelLine('just a body\n', 'm')).toBe('---\nmodel: m\n---\njust a body\n');
    expect(setModelLine('just a body\n', null)).toBe('just a body\n');
  });
});

describe('writeAgentFile', () => {
  it('creates, then updates only the model line, then reports unchanged', () => {
    const cwd = freshDir();
    expect(writeAgentFile(cwd, 'claude', 'light', 'haiku')).toBe('created');
    const rel = agentPath('claude', 'light');
    expect(rel).toBe('.claude/agents/sbl-light.md');
    put(cwd, rel, read(cwd, rel).replace('purely mechanical work', 'my own words'));
    expect(writeAgentFile(cwd, 'claude', 'light', 'inherit')).toBe('updated');
    expect(read(cwd, rel)).toContain('my own words');
    expect(read(cwd, rel)).toContain('\nmodel: inherit\n');
    expect(writeAgentFile(cwd, 'claude', 'light', 'inherit')).toBe('unchanged');
  });

  it('reports unchanged on every apply for a file with unclosed frontmatter', () => {
    const cwd = freshDir();
    const rel = agentPath('claude', 'top');
    put(cwd, rel, '---\nname: sbl-top\nbody without a closing line\n');
    expect(writeAgentFile(cwd, 'claude', 'top', 'opus')).toBe('unchanged');
    expect(writeAgentFile(cwd, 'claude', 'top', 'opus')).toBe('unchanged');
    expect(read(cwd, rel)).toBe('---\nname: sbl-top\nbody without a closing line\n');
  });
});

describe('isRouterInstalled', () => {
  it('detects v2 agents, v1 agents and the v1 plugin', () => {
    const cwd = freshDir();
    expect(isRouterInstalled(cwd, 'claude')).toBe(false);
    expect(isRouterInstalled(cwd, 'opencode')).toBe(false);
    put(cwd, '.claude/agents/sbl-worker-cheap.md', 'x');
    expect(isRouterInstalled(cwd, 'claude')).toBe(true);
    put(cwd, '.opencode/plugins/sbl-model-router.js', 'x');
    expect(isRouterInstalled(cwd, 'opencode')).toBe(true);
    const other = freshDir();
    put(other, '.opencode/agents/sbl-top.md', 'x');
    expect(isRouterInstalled(other, 'opencode')).toBe(true);
    expect(isRouterInstalled(other, 'claude')).toBe(false);
  });
});

describe('cleanLegacy', () => {
  it('removes v1 OpenCode agents and the plugin', () => {
    const cwd = freshDir();
    put(cwd, '.opencode/agents/sbl-worker.md', 'x');
    put(cwd, '.opencode/plugins/sbl-model-router.js', 'x');
    expect(cleanLegacy(cwd, 'opencode')).toEqual([
      'removed legacy .opencode/agents/sbl-worker.md',
      'removed legacy .opencode/plugins/sbl-model-router.js',
    ]);
    expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(false);
  });

  it('removes v1 Claude agents and the sbl SessionStart hook, keeping foreign hooks and keys', () => {
    const cwd = freshDir();
    put(cwd, '.claude/agents/sbl-worker.md', 'x');
    put(cwd, '.claude/agents/sbl-worker-cheap.md', 'x');
    put(cwd, '.claude/settings.json', JSON.stringify({ permissions: { allow: [] }, hooks: { SessionStart: [SBL_HOOK, OWN_HOOK] } }, null, 2));
    expect(cleanLegacy(cwd, 'claude')).toEqual([
      'removed legacy .claude/agents/sbl-worker.md',
      'removed legacy .claude/agents/sbl-worker-cheap.md',
      'removed legacy .claude/settings.json SessionStart hook',
    ]);
    expect(JSON.parse(read(cwd, '.claude/settings.json'))).toEqual({ permissions: { allow: [] }, hooks: { SessionStart: [OWN_HOOK] } });
  });

  it('removes the sbl SessionStart hook in single-string command form', () => {
    const cwd = freshDir();
    const stringHook = { matcher: '*', hooks: [{ type: 'command', command: 'node node_modules/super-backlog/dist/templates/cc-session-hook.js' }] };
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [stringHook, OWN_HOOK] } }, null, 2));
    expect(cleanLegacy(cwd, 'claude')).toEqual(['removed legacy .claude/settings.json SessionStart hook']);
    expect(JSON.parse(read(cwd, '.claude/settings.json'))).toEqual({ hooks: { SessionStart: [OWN_HOOK] } });
  });

  it('warns instead of throwing on an unparsable settings.json', () => {
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', '{ broken');
    expect(cleanLegacy(cwd, 'claude')).toEqual([
      'warning: .claude/settings.json is not valid JSON - legacy SessionStart hook left in place',
    ]);
    expect(read(cwd, '.claude/settings.json')).toBe('{ broken');
  });

  it('prints nothing when there is nothing to clean', () => {
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [OWN_HOOK] } }));
    expect(cleanLegacy(cwd, 'claude')).toEqual([]);
    expect(cleanLegacy(cwd, 'opencode')).toEqual([]);
  });
});
