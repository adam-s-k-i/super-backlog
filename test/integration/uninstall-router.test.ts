// test/integration/uninstall-router.test.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, win32 } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyRouter } from '../../src/models/apply.js';
import { uninstallModelRouter } from '../../src/models/uninstall.js';

const dirs: string[] = [];
type Line = { verdict: 'removed' | 'kept' | 'skipped' | 'error'; label: string };

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-uninstall-'));
  dirs.push(dir);
  return dir;
}

function put(cwd: string, rel: string, text: string): void {
  mkdirSync(dirname(join(cwd, rel)), { recursive: true });
  writeFileSync(join(cwd, rel), text);
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

const SBL_HOOK = { matcher: '*', hooks: [{ type: 'command', command: 'node', args: ['node_modules/super-backlog/dist/templates/cc-session-hook.js'] }] };
const OWN_HOOK = { matcher: '*', hooks: [{ type: 'command', command: 'node', args: ['some-other-script.js'] }] };

const V1_FILES = [
  '.opencode/plugins/sbl-model-router.js',
  '.opencode/agents/sbl-worker.md',
  '.opencode/agents/sbl-worker-cheap.md',
  '.claude/agents/sbl-worker.md',
  '.claude/agents/sbl-worker-cheap.md',
];
const V2_FILES = ['.claude', '.opencode'].flatMap((h) => ['light', 'standard', 'strong', 'top'].map((t) => `${h}/agents/sbl-${t}.md`));

describe('uninstall model router', () => {
  it('removes both router generations and the config dir', () => {
    const cwd = freshDir();
    put(cwd, '.super-backlog/models.json', JSON.stringify({ version: 2, enabled: true, tiers: {} }));
    applyRouter(cwd, { install: true, block: false, version: '9.9.9' });
    for (const rel of V1_FILES) put(cwd, rel, 'x');
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    for (const rel of ['.super-backlog/models.json', ...V1_FILES, ...V2_FILES]) {
      expect(existsSync(join(cwd, rel)), rel).toBe(false);
      expect(report).toContainEqual({ verdict: 'removed', label: rel });
    }
    expect(report).toContainEqual({ verdict: 'removed', label: '.super-backlog/' });
  });

  it('removes the sbl SessionStart hook and keeps foreign hooks', () => {
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [SBL_HOOK, OWN_HOOK] } }, null, 2));
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
    expect(settings.hooks.SessionStart).toEqual([OWN_HOOK]);
    expect(report).toContainEqual({ verdict: 'removed', label: '.claude/settings.json SessionStart hook' });
  });

  it('drops the hooks key when the sbl hook was the only one', () => {
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [SBL_HOOK] } }, null, 2));
    uninstallModelRouter(cwd, []);
    expect(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'))).toEqual({});
  });

  it('reports none owned for unrelated hooks', () => {
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [OWN_HOOK] } }, null, 2));
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    expect(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).hooks.SessionStart).toHaveLength(1);
    expect(report).toContainEqual({ verdict: 'skipped', label: '.claude/settings.json SessionStart hook (none owned)' });
  });

  it('keeps a foreign hook that shares an entry with the sbl hook', () => {
    const cwd = freshDir();
    const shared = { matcher: '*', hooks: [...SBL_HOOK.hooks, { type: 'command', command: './my-start.sh' }] };
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [shared], PreToolUse: [OWN_HOOK] } }, null, 2));
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    expect(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'))).toEqual({
      hooks: { SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: './my-start.sh' }] }], PreToolUse: [OWN_HOOK] },
    });
    expect(report).toContainEqual({ verdict: 'removed', label: '.claude/settings.json SessionStart hook' });
  });

  it('recognises backslash and absolute-path variants of the sbl hook', () => {
    const tail = ['node_modules', 'super-backlog', 'dist', 'templates', 'cc-session-hook.js'];
    const variants = [win32.join(...tail), win32.join('C:', 'proj', ...tail), `/home/u/proj/${tail.join('/')}`];
    expect(variants[0]).toContain(win32.sep);
    const entries = variants.map((arg) => ({ matcher: '*', hooks: [{ type: 'command', command: 'node', args: [arg] }] }));
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [...entries, OWN_HOOK] } }, null, 2));
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    expect(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).hooks.SessionStart).toEqual([OWN_HOOK]);
    expect(report).toContainEqual({ verdict: 'removed', label: '.claude/settings.json SessionStart hook' });
  });

  it('recognises the sbl hook in single-string command form', () => {
    const rel = 'node_modules/super-backlog/dist/templates/cc-session-hook.js';
    const commands = [
      `node ${rel}`,
      `node.exe "C:\\proj\\${rel.split('/').join('\\')}"`,
      `  node  '$CLAUDE_PROJECT_DIR/${rel}'  `,
      `node "$CLAUDE_PROJECT_DIR"/${rel}`,
      `/usr/bin/node ${rel}`,
      `"C:\\Program Files\\nodejs\\node.exe" "C:\\proj\\${rel.split('/').join('\\')}"`,
    ];
    const entries = commands.map((command) => ({ matcher: '*', hooks: [{ type: 'command', command }] }));
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [...entries, OWN_HOOK] } }, null, 2));
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    expect(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).hooks.SessionStart).toEqual([OWN_HOOK]);
    expect(report).toContainEqual({ verdict: 'removed', label: '.claude/settings.json SessionStart hook' });
  });

  it('keeps single-string commands that only resemble the sbl hook', () => {
    const rel = 'node_modules/super-backlog/dist/templates/cc-session-hook.js';
    const commands = [
      `node ${rel} --extra`,
      `bash ${rel}`,
      `mynode ${rel}`,
      `node "${rel}" "${rel}"`,
      'node scripts/my-cc-session-hook.js',
      `node "${rel}'`,
      rel,
    ];
    const entries = commands.map((command) => ({ matcher: '*', hooks: [{ type: 'command', command }] }));
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: entries } }, null, 2));
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    expect(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).hooks.SessionStart).toEqual(entries);
    expect(report).toContainEqual({ verdict: 'skipped', label: '.claude/settings.json SessionStart hook (none owned)' });
  });

  it('matches the args form only for node with exactly our script', () => {
    const rel = 'node_modules/super-backlog/dist/templates/cc-session-hook.js';
    const foreign = [
      { type: 'command', command: 'bash', args: [rel] },
      { type: 'command', command: 'node', args: [rel, '--x'] },
    ].map((hook) => ({ matcher: '*', hooks: [hook] }));
    const ours = [
      { type: 'command', command: 'node.exe', args: [rel] },
      { type: 'command', command: `node ${rel}`, args: [] },
    ].map((hook) => ({ matcher: '*', hooks: [hook] }));
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [...foreign, ...ours] } }, null, 2));
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    expect(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).hooks.SessionStart).toEqual(foreign);
    expect(report).toContainEqual({ verdict: 'removed', label: '.claude/settings.json SessionStart hook' });
  });

  it('does not treat a similarly named user script as the sbl hook', () => {
    const cwd = freshDir();
    const lookalike = { matcher: '*', hooks: [{ type: 'command', command: 'node', args: ['scripts/my-cc-session-hook.js'] }] };
    put(cwd, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [lookalike] } }, null, 2));
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    expect(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).hooks.SessionStart).toEqual([lookalike]);
    expect(report).toContainEqual({ verdict: 'skipped', label: '.claude/settings.json SessionStart hook (none owned)' });
  });

  it('skips an unparsable settings.json', () => {
    const cwd = freshDir();
    put(cwd, '.claude/settings.json', '{ broken');
    const report: Line[] = [];
    uninstallModelRouter(cwd, report);
    expect(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).toBe('{ broken');
    expect(report).toContainEqual({ verdict: 'skipped', label: '.claude/settings.json (not valid JSON)' });
  });
});
