// src/models/uninstall.ts
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../lib/atomic.js';

/** Both router generations: v1 (plugin + sbl-worker*) and v2 (sbl-<tier>). Literal on purpose — uninstall must not depend on agents.ts. */
const ROUTER_FILES = [
  '.super-backlog/models.json',
  '.opencode/plugins/sbl-model-router.js',
  '.opencode/agents/sbl-worker.md',
  '.opencode/agents/sbl-worker-cheap.md',
  '.opencode/agents/sbl-light.md',
  '.opencode/agents/sbl-standard.md',
  '.opencode/agents/sbl-strong.md',
  '.opencode/agents/sbl-top.md',
  '.claude/agents/sbl-worker.md',
  '.claude/agents/sbl-worker-cheap.md',
  '.claude/agents/sbl-light.md',
  '.claude/agents/sbl-standard.md',
  '.claude/agents/sbl-strong.md',
  '.claude/agents/sbl-top.md',
];

type ReportLine = { verdict: 'removed' | 'kept' | 'skipped' | 'error'; label: string };

export type HookStripResult = 'missing' | 'invalid' | 'none' | 'none-owned' | 'removed';

const HOOK_REPORT: Record<HookStripResult, ReportLine> = {
  missing: { verdict: 'skipped', label: '.claude/settings.json model-router hook (not found)' },
  invalid: { verdict: 'skipped', label: '.claude/settings.json (not valid JSON)' },
  none: { verdict: 'skipped', label: '.claude/settings.json SessionStart hook (none)' },
  'none-owned': { verdict: 'skipped', label: '.claude/settings.json SessionStart hook (none owned)' },
  removed: { verdict: 'removed', label: '.claude/settings.json SessionStart hook' },
};

/** Router v1 registered exactly `node node_modules/super-backlog/dist/templates/cc-session-hook.js`. */
const OWNED_HOOK_RE = /(^|\/)super-backlog\/dist\/templates\/cc-session-hook\.js$/;

/**
 * Path characters that carry no shell meaning. Anything else (`; | & $( ) \` % < >`, newlines) makes a
 * command someone else's, so uninstall never removes it. The only expansion allowed is the project dir.
 */
const SAFE = String.raw`[\w.~:/\\+@-]`;
const PROJECT_DIR = String.raw`\$CLAUDE_PROJECT_DIR|\$\{CLAUDE_PROJECT_DIR\}`;

/** `node` or `node.exe`, optionally with a path in front, optionally quoted as a whole. */
const NODE = String.raw`(?:"(?:(?:${SAFE}| )*[\\/])?node(?:\.exe)?"|(?:${SAFE}*[\\/])?node(?:\.exe)?)`;
const NODE_COMMAND_RE = new RegExp(String.raw`^[ \t]*${NODE}[ \t]*$`, 'i');

/** One shell word built from unquoted, double-quoted and single-quoted parts. */
const WORD = String.raw`(?:"(?:${SAFE}| |${PROJECT_DIR})*"|'(?:${SAFE}| |${PROJECT_DIR})*'|${SAFE}|${PROJECT_DIR})+`;

/** Single-string form `node <script>`: exactly one word after the interpreter. */
const STRING_HOOK_RE = new RegExp(String.raw`^[ \t]*${NODE}[ \t]+(${WORD})[ \t]*$`, 'i');

function unquote(word: string): string {
  return word.replace(/"([^"]*)"|'([^']*)'/g, (_, double?: string, single?: string) => double ?? single ?? '');
}

function isOwnedScript(script: string): boolean {
  return OWNED_HOOK_RE.test(script.split('\\').join('/'));
}

/**
 * A single hook is ours when it is a command hook that runs the shipped cc-session-hook.js with node and
 * nothing else: either `command: "node"` with the script as the only `args` entry (what v1 wrote), or a
 * single-string `command`.
 */
function isOwnedHook(hook: unknown): boolean {
  if (hook === null || typeof hook !== 'object') return false;
  const { type, command, args } = hook as { type?: unknown; command?: unknown; args?: unknown };
  if (type !== 'command' || typeof command !== 'string') return false;
  if (Array.isArray(args) && args.length > 0) {
    return args.length === 1 && typeof args[0] === 'string' && NODE_COMMAND_RE.test(command) && isOwnedScript(args[0]);
  }
  const word = STRING_HOOK_RE.exec(command)?.[1];
  return word !== undefined && isOwnedScript(unquote(word));
}

/** Marks an entry whose hooks were all ours; a literal null entry in the user file stays as it is. */
const DROP = Symbol('drop');

/**
 * Drops only our hooks from one SessionStart entry. Returns the entry unchanged when it holds none of
 * ours, a copy without them when foreign hooks share the entry, and DROP when nothing else is left.
 */
function stripEntry(entry: unknown): unknown | typeof DROP {
  if (entry === null || typeof entry !== 'object') return entry;
  const hooks = (entry as { hooks?: unknown }).hooks;
  if (!Array.isArray(hooks)) return entry;
  const kept = hooks.filter((h) => !isOwnedHook(h));
  if (kept.length === hooks.length) return entry;
  if (kept.length === 0) return DROP;
  return { ...(entry as Record<string, unknown>), hooks: kept };
}

/** Removes the router v1 SessionStart hook from .claude/settings.json; other hooks and keys stay. Never throws on bad JSON. */
export function stripSessionHook(cwd: string): HookStripResult {
  const path = join(cwd, '.claude', 'settings.json');
  if (!existsSync(path)) return 'missing';
  let settings: { hooks?: unknown };
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return 'invalid';
    settings = parsed as { hooks?: unknown };
  } catch {
    return 'invalid';
  }
  const hooks = settings.hooks;
  if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) return 'none';
  const hookMap = hooks as Record<string, unknown>;
  const sessionStart = hookMap['SessionStart'];
  if (!Array.isArray(sessionStart) || sessionStart.length === 0) return 'none';
  const stripped = sessionStart.map(stripEntry);
  if (stripped.every((entry, i) => entry === sessionStart[i])) return 'none-owned';
  const filtered = stripped.filter((entry) => entry !== DROP);
  if (filtered.length === 0) {
    delete hookMap['SessionStart'];
    if (Object.keys(hookMap).length === 0) delete settings.hooks;
  } else {
    hookMap['SessionStart'] = filtered;
  }
  atomicWrite(path, `${JSON.stringify(settings, null, 2)}\n`);
  return 'removed';
}

export function uninstallModelRouter(cwd: string, report: ReportLine[]): void {
  for (const rel of ROUTER_FILES) {
    const abs = join(cwd, rel);
    if (!existsSync(abs)) {
      report.push({ verdict: 'skipped', label: `${rel} (not found)` });
      continue;
    }
    rmSync(abs, { force: true });
    report.push({ verdict: 'removed', label: rel });
  }

  // Remove .super-backlog directory if it is now empty
  const dir = join(cwd, '.super-backlog');
  if (existsSync(dir)) {
    try {
      const remaining = readdirSync(dir);
      if (remaining.length === 0) {
        rmSync(dir, { recursive: true, force: true });
        report.push({ verdict: 'removed', label: '.super-backlog/' });
      } else {
        report.push({ verdict: 'kept', label: '.super-backlog/ (contains other files)' });
      }
    } catch {
      // ignore race conditions
    }
  }

  report.push({ ...HOOK_REPORT[stripSessionHook(cwd)] });
}
