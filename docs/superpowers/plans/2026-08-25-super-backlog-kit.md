# super-backlog v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `super-backlog` — a zero-runtime-dependency Node CLI (`sbl`) that equips new or existing projects with Backlog.md + Superpowers (OpenCode + Claude Code), a marker-scoped workflow block, a `spec-to-backlog` glue skill, an opt-in integrity guard hook, and a static Project Dashboard (`dashboard.html` + `--serve`).

**Architecture:** Glue orchestrator (spec §4): delegate upstream installs to package managers and the `backlog` CLI; own only templates + merge/inject logic, all idempotent and ownership-attributed (markers / fingerprints). Init = pure planner producing an explicit ChangeSet, plus a dumb executor — so logic is unit-testable without touching real projects.

**Tech Stack:** Node ≥ 20, TypeScript 5 (strict, ESM), vitest, `node:util.parseArgs`, zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-25-super-backlog-kit-design.md`

## Global Constraints

- Zero runtime dependencies; devDeps only: `typescript`, `vitest`, `@types/node`.
- `"engines": { "node": ">=20" }`; bins: `"sbl"` and `"super-backlog"`.
- TypeScript strict mode, ESM (`"type": "module"`), always import from `node:path` / `node:url` (Windows-safe).
- Plugin spec string, byte-exact: `superpowers@git+https://github.com/obra/superpowers.git`
- Markers, byte-exact: start `<!-- SUPER-BACKLOG:<version> START -->`, end `<!-- SUPER-BACKLOG END -->`.
- Skill fingerprint line, byte-exact pattern: `<!-- managed-by: super-backlog <version> -->`.
- npm scripts merged into target projects (add-only-if-absent): `tasks`→`backlog task list`, `board`→`backlog board`, `browser`→`backlog browser`, `dashboard`→`super-backlog dashboard`.
- Dashboard serve default port **6428**.
- Exit codes: `0` ok · `1` detection failure · `2` ownership/merge refusal · `3` upstream command failure · `4` success-with-warnings.
- Tests never touch the network or install packages: env `SBL_SKIP_INSTALL=1` makes init fabricate a minimal `backlog/config.yml` instead of invoking upstream.
- All user-facing CLI strings in English.
- Amendment to spec §4.1 recorded here: init also installs **itself** (`super-backlog@latest`) as a devDependency of the target project, because the merged `dashboard` script and guard hook require the local binary.

---

### Task 1: Package scaffold + version/markers library

**Files:**
- Modify: `package.json` (rewrite: name, type module, bins, scripts, engines, devDeps)
- Create: `tsconfig.json`, `vitest.config.ts`
- Create: `src/lib/version.ts`
- Create: `src/lib/markers.ts`
- Create: `test/unit/markers.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `KIT_VERSION: string` (read from own package.json)
  - `markerStart(version: string): string`
  - `MARKER_END = '<!-- SUPER-BACKLOG END -->'`
  - `injectBlock(content: string, version: string, block: string): { content: string; action: 'created' | 'replaced' | 'unchanged' }`
  - `stripOwned(content: string): { content: string; removed: boolean }`

- [ ] **Step 1: Rewrite package.json**

```json
{
  "name": "super-backlog",
  "version": "0.1.0",
  "private": true,
  "description": "One command to equip any project with Backlog.md + Superpowers, plus a Project Dashboard.",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "sbl": "dist/cli.js", "super-backlog": "dist/cli.js" },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

Then run `npm.cmd install`.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": false,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

Note: vitest runs TS directly; `npm run build` is exercised separately in Task 17.

- [ ] **Step 4: Write failing test for markers**

```ts
// test/unit/markers.test.ts
import { describe, expect, it } from 'vitest';
import { MARKER_END, injectBlock, markerStart, stripOwned } from '../../src/lib/markers.js';

const BLOCK = '## Workflow\n\nrules here';

describe('injectBlock', () => {
  it('creates block in empty content', () => {
    const r = injectBlock('', '1.2.3', BLOCK);
    expect(r.action).toBe('created');
    expect(r.content).toBe(`${markerStart('1.2.3')}\n${BLOCK}\n${MARKER_END}\n`);
  });

  it('preserves surrounding content byte-exactly', () => {
    const before = '# My Project\n\nintro text\n';
    const after = '\n## Setup\n\nnpm i\n';
    const first = injectBlock(before, '1.0.0', BLOCK).content;
    const second = injectBlock(first, '1.1.0', BLOCK).content;
    expect(second.startsWith(before)).toBe(true);
    expect(second.endsWith(after)).toBe(true);
  });

  it('replaces existing owned block on re-inject', () => {
    const once = injectBlock('# T\n', '1.0.0', BLOCK).content;
    const twice = injectBlock(once, '2.0.0', BLOCK);
    expect(twice.action).toBe('replaced');
    expect(twice.content).toContain(markerStart('2.0.0'));
    expect(twice.content).not.toContain(markerStart('1.0.0'));
  });

  it('is unchanged when identical block+version present', () => {
    const once = injectBlock('# T\n', '1.0.0', BLOCK).content;
    const again = injectBlock(once, '1.0.0', BLOCK);
    expect(again.action).toBe('unchanged');
  });

  it('never touches foreign markers-like content outside block', () => {
    const content = '<!-- SUPER-BACKLOG:something else -->\nkeep me';
    const r = injectBlock(content, '1.0.0', BLOCK);
    expect(r.content).toContain('<!-- SUPER-BACKLOG:something else -->');
    expect(r.content).toContain('keep me');
  });
});

describe('stripOwned', () => {
  it('removes owned block including markers', () => {
    const doc = injectBlock('# H\n', '1.0.0', BLOCK).content;
    const r = stripOwned(doc);
    expect(r.removed).toBe(true);
    expect(r.content).not.toContain(BLOCK);
    expect(r.content).not.toContain(MARKER_END);
    expect(r.content).toContain('# H\n');
  });
  it('reports removed=false when absent', () => {
    expect(stripOwned('# plain\n').removed).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests to verify failure**

Run: `npx.cmd vitest run test/unit/markers.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/markers.js`.

- [ ] **Step 6: Implement src/lib/version.ts and src/lib/markers.ts**

```ts
// src/lib/version.ts
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
export const KIT_VERSION: string =
  (require('../package.json') as { version?: string }).version ?? '0.0.0';

export function assertNode20(): void {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    console.error(`super-backlog requires Node >= 20 (found ${process.versions.node}).`);
    process.exit(1);
  }
}
```

```ts
// src/lib/markers.ts
const START_RE = /<!--\s*SUPER-BACKLOG:(\d+\.\d+\.\d+)\s*START\s*-->/;

export function markerStart(version: string): string {
  return `<!-- SUPER-BACKLOG:${version} START -->`;
}

export const MARKER_END = '<!-- SUPER-BACKLOG END -->';

export interface InjectResult {
  content: string;
  action: 'created' | 'replaced' | 'unchanged';
}

function ownedSpan(content: string): { start: number; end: number } | null {
  const m = START_RE.exec(content);
  if (!m || m.index === -1) return null;
  const start = m.index;
  const endIdx = content.indexOf(MARKER_END, start);
  if (endIdx === -1) return null;
  return { start, end: endIdx + MARKER_END.length };
}

export function injectBlock(content: string, version: string, block: string): InjectResult {
  const fresh = `${markerStart(version)}\n${block}\n${MARKER_END}`;
  const span = ownedSpan(content);
  if (!span) {
    const sep = content.length === 0 ? '' : content.endsWith('\n') ? '' : '\n';
    return { content: content + sep + fresh + '\n', action: 'created' };
  }
  const existing = content.slice(span.start, span.end);
  if (existing === fresh) return { content, action: 'unchanged' };
  return {
    content: content.slice(0, span.start) + fresh + content.slice(span.end),
    action: 'replaced',
  };
}

export function stripOwned(content: string): { content: string; removed: boolean } {
  const span = ownedSpan(content);
  if (!span) return { content, removed: false };
  let out = content.slice(0, span.start) + content.slice(span.end);
  out = out.replace(/\n{3,}/g, '\n\n'); // collapse gaps left by removal
  return { content: out, removed: true };
}
```

Wait — `START_RE` must not match arbitrary comments like `<!-- SUPER-BACKLOG:something else -->`. The regex requires `:<semver> START -->`; the foreign example lacks ` START`, so `ownedSpan` returns null → untouched. Consistent with the test.

- [ ] **Step 7: Run tests until green**

Run: `npx.cmd vitest run test/unit/markers.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/lib/version.ts src/lib/markers.ts test/unit/markers.test.ts
git commit -m "feat(lib): scaffold kit and add marker-block injection"
```

---

### Task 2: Atomic write

**Files:**
- Create: `src/lib/atomic.ts`
- Test: `test/unit/atomic.test.ts`

**Interfaces:**
- Produces: `atomicWrite(filePath: string, contents: string): void` — writes via sibling temp file + rename; creates parent dirs.

- [ ] **Step 1: Failing test**

```ts
// test/unit/atomic.test.ts
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWrite } from '../../src/lib/atomic.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sbl-atomic-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('atomicWrite', () => {
  it('creates nested dirs and writes content', () => {
    const p = join(dir, 'a/b/c.txt');
    atomicWrite(p, 'hello');
    expect(readFileSync(p, 'utf8')).toBe('hello');
  });
  it('overwrites atomically and leaves no temp files', () => {
    const p = join(dir, 'x.md');
    atomicWrite(p, 'one');
    atomicWrite(p, 'two');
    expect(readFileSync(p, 'utf8')).toBe('two');
    const leftovers = existsSync(p + '.tmp');
    expect(leftovers).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx.cmd vitest run test/unit/atomic.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/atomic.ts
import { mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export function atomicWrite(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, contents, 'utf8');
  try {
    renameSync(tmp, filePath);
  } catch (err) {
    // Windows rename over an existing file can fail on some filesystems.
    rmSync(filePath, { force: true });
    renameSync(tmp, filePath);
  }
}
```

- [ ] **Step 4: Run until green** — same command → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/atomic.ts test/unit/atomic.test.ts
git commit -m "feat(lib): atomic file writer"
```

---

### Task 3: Package manager detection

**Files:**
- Create: `src/lib/pm.ts`
- Test: `test/unit/pm.test.ts`

**Interfaces:**
- Produces: `type PM = 'npm' | 'pnpm' | 'bun';` and `detectPackageManager(cwd: string): PM | null` — lockfile wins (pnpm > bun > npm); no lockfile but `package.json` present → `'npm'`; neither → `null`.

- [ ] **Step 1: Failing test**

```ts
// test/unit/pm.test.ts
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectPackageManager } from '../../src/lib/pm.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sbl-pm-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('detectPackageManager', () => {
  it('returns null in empty dir', () => {
    expect(detectPackageManager(dir)).toBeNull();
  });
  it('defaults to npm when only package.json exists', () => {
    writeFileSync(join(dir, 'package.json'), '{}');
    expect(detectPackageManager(dir)).toBe('npm');
  });
  it('detects each lockfile', () => {
    for (const [lock, pm] of [
      ['pnpm-lock.yaml', 'pnpm'],
      ['bun.lockb', 'bun'],
      ['bun.lock', 'bun'],
      ['package-lock.json', 'npm'],
    ] as const) {
      writeFileSync(join(dir, 'package.json'), '{}');
      writeFileSync(join(dir, lock), '');
      expect(detectPackageManager(dir)).toBe(pm);
      rmSync(join(dir, lock));
    }
  });
});
```

- [ ] **Step 2: Verify failure** — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/pm.ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type PM = 'npm' | 'pnpm' | 'bun';

export function detectPackageManager(cwd: string): PM | null {
  const has = (f: string) => existsSync(join(cwd, f));
  if (!has('package.json')) return null;
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('bun.lockb') || has('bun.lock')) return 'bun';
  return 'npm';
}

export function installCmdsFor(pm: PM, pkgs: string[]): { cmd: string; args: string[] } {
  switch (pm) {
    case 'pnpm': return { cmd: 'pnpm', args: ['add', '-D', ...pkgs] };
    case 'bun': return { cmd: 'bun', args: ['add', '-d', ...pkgs] };
    default: return { cmd: 'npm', args: ['install', '--save-dev', ...pkgs] };
  }
}
```

- [ ] **Step 4: Green** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pm.ts test/unit/pm.test.ts
git commit -m "feat(lib): package manager detection"
```

---

### Task 4: npm scripts + devDependencies merge

**Files:**
- Create: `src/lib/pkgjson.ts`
- Test: `test/unit/pkgjson.test.ts`

**Interfaces:**
- Produces:
  - `type PkgJson = Record<string, unknown> & { scripts?: Record<string,string>; devDependencies?: Record<string,string> }`
  - `readPkgJson(cwd: string): PkgJson | null`
  - `mergeScripts(pkg: PkgJson, wanted: Record<string, string>): { pkg: PkgJson; added: string[] }` — add-only-if-absent.
  - `addDevDependencies(pkg: PkgJson, deps: Record<string,string>): { pkg: PkgJson; added: string[] }` — sets exact `latest` spec entries below.

Constants exported for reuse (Global Constraints):
- `WANTED_SCRIPTS = { tasks: 'backlog task list', board: 'backlog board', browser: 'backlog browser', dashboard: 'super-backlog dashboard' }`
- `WANTED_DEVS = { 'backlog.md': 'latest', 'super-backlog': 'latest' }`

- [ ] **Step 1: Failing test**

```ts
// test/unit/pkgjson.test.ts
import { describe, expect, it } from 'vitest';
import { WANTED_DEVS, WANTED_SCRIPTS, addDevDependencies, mergeScripts, readPkgJson, type PkgJson } from '../../src/lib/pkgjson.js';

describe('mergeScripts', () => {
  it('adds missing scripts', () => {
    const pkg: PkgJson = {};
    const r = mergeScripts(pkg, WANTED_SCRIPTS);
    expect(r.added.sort()).toEqual(['board', 'browser', 'dashboard', 'tasks']);
    expect(r.pkg.scripts?.board).toBe('backlog board');
  });
  it('never overwrites existing values', () => {
    const pkg: PkgJson = { scripts: { board: 'my-custom-board' } };
    const r = mergeScripts(pkg, WANTED_SCRIPTS);
    expect(r.added).toEqual(['tasks', 'browser', 'dashboard']);
    expect(r.pkg.scripts?.board).toBe('my-custom-board');
  });
  it('is idempotent', () => {
    let pkg: PkgJson = {};
    pkg = mergeScripts(pkg, WANTED_SCRIPTS).pkg;
    const again = mergeScripts(pkg, WANTED_SCRIPTS);
    expect(again.added).toEqual([]);
  });
});

describe('addDevDependencies', () => {
  it('adds wanted deps with latest spec', () => {
    const r = addDevDependencies({}, WANTED_DEVS);
    expect(r.added.sort()).toEqual(['backlog.md', 'super-backlog']);
    expect(r.pkg.devDependencies?.['backlog.md']).toBe('latest');
  });
  it('keeps pinned versions of the user', () => {
    const r = addDevDependencies({ devDependencies: { 'backlog.md': '^1.50.1' } }, WANTED_DEVS);
    expect(r.added).toEqual(['super-backlog']);
    expect(r.pkg.devDependencies?.['backlog.md']).toBe('^1.50.1');
  });
});

describe('readPkgJson', () => {
  it('returns null when absent', () => {
    expect(readPkgJson('/definitely/not/here')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

```ts
// src/lib/pkgjson.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PkgJson = Record<string, unknown> & {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export const WANTED_SCRIPTS: Record<string, string> = {
  tasks: 'backlog task list',
  board: 'backlog board',
  browser: 'backlog browser',
  dashboard: 'super-backlog dashboard',
};

export const WANTED_DEVS: Record<string, string> = {
  'backlog.md': 'latest',
  'super-backlog': 'latest',
};

export function readPkgJson(cwd: string): PkgJson | null {
  const p = join(cwd, 'package.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as PkgJson;
}

export function mergeScripts(pkg: PkgJson, wanted: Record<string, string>): { pkg: PkgJson; added: string[] } {
  const scripts = { ...(pkg.scripts ?? {}) };
  const added: string[] = [];
  for (const [name, cmd] of Object.entries(wanted)) {
    if (!(name in scripts)) { scripts[name] = cmd; added.push(name); }
  }
  return { pkg: { ...pkg, ...(added.length ? { scripts } : {}) }, added };
}

export function addDevDependencies(pkg: PkgJson, deps: Record<string, string>): { pkg: PkgJson; added: string[] } {
  const devDependencies = { ...(pkg.devDependencies ?? {}) };
  const added: string[] = [];
  for (const [name, spec] of Object.entries(deps)) {
    if (!(name in devDependencies)) { devDependencies[name] = spec; added.push(name); }
  }
  return { pkg: { ...pkg, ...(added.length ? { devDependencies } : {}) }, added };
}
```

- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/pkgjson.ts test/unit/pkgjson.test.ts
git commit -m "feat(lib): additive package.json script/devDependency merges"
```

---

### Task 5: Minimal YAML key reader (backlog config)

**Files:**
- Create: `src/lib/yamlmini.ts`
- Test: `test/unit/yamlmini.test.ts`

**Interfaces:**
- Produces: `readSimpleKeys(filePath: string, keys: string[]): Record<string, string | undefined>` — parses flat `key: value` lines only (quoted values unquoted); missing file → all undefined. Enough for backlog's `config.yml` name/description.

- [ ] **Step 1: Failing test**

```ts
// test/unit/yamlmini.test.ts
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readSimpleKeys } from '../../src/lib/yamlmini.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sbl-yaml-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('readSimpleKeys', () => {
  it('reads flat keys and strips quotes', () => {
    const p = join(dir, 'config.yml');
    writeFileSync(p, 'project_name: "My Project"\ndescription: Plain text\nother:\n  nested: x\n');
    expect(readSimpleKeys(p, ['project_name', 'description'])).toEqual({
      project_name: 'My Project',
      description: 'Plain text',
    });
  });
  it('returns undefined for missing file and missing keys', () => {
    expect(readSimpleKeys(join(dir, 'nope.yml'), ['name'])).toEqual({ name: undefined });
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

```ts
// src/lib/yamlmini.ts
import { existsSync, readFileSync } from 'node:fs';

export function readSimpleKeys(filePath: string, keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) out[k] = undefined;
  if (!existsSync(filePath)) return out;
  const wanted = new Set(keys);
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!m || !wanted.has(m[1])) continue;
    const raw = m[2].trim();
    out[m[1]] = raw.replace(/^["'](.*)["']$/, '$1');
  }
  return out;
}
```

- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/yamlmini.ts test/unit/yamlmini.test.ts
git commit -m "feat(lib): flat YAML key reader for backlog config"
```

---

### Task 6: Ownership + opencode.json create-or-merge

**Files:**
- Create: `src/lib/ownership.ts`
- Create: `src/lib/opencode.ts`
- Test: `test/unit/ownership.test.ts`, `test/unit/opencode.test.ts`

**Interfaces:**
- Produces:
  - `PLUGIN_SPEC = 'superpowers@git+https://github.com/obra/superpowers.git'` (byte-exact)
  - `FINGERPRINT_RE = /<!--\s*managed-by:\s*super-backlog\s*v?\d+\.\d+\.\d+\s*-->/`
  - `isOwnedSkillFile(content: string): boolean`
  - `renderSkill(content: string, version: string): string` — inserts fingerprint line after frontmatter
  - `applyPluginEntry(config: unknown): { config: Record<string, unknown>; changed: boolean }` — accepts anything found in opencode.json; returns normalized object with `plugin: string[]` containing PLUGIN_SPEC exactly once; refuses (throws `OwnershipError`) when an entry looks like ours but differs (e.g., pinned fork).

- [ ] **Step 1: Failing tests**

```ts
// test/unit/ownership.test.ts
import { describe, expect, it } from 'vitest';
import { FINGERPRINT_RE, isOwnedSkillFile, renderSkill } from '../../src/lib/ownership.js';

const FRONT = `---\nname: spec-to-backlog\ndescription: bridge skill\n---\n\n# Spec to Backlog\n`;

describe('skill ownership', () => {
  it('renders fingerprint after frontmatter', () => {
    const out = renderSkill(FRONT, '1.0.0');
    expect(out).toMatch(FINGERPRINT_RE);
    const fmEnd = out.indexOf('---', 3);
    expect(out.indexOf('managed-by')).toBeGreaterThan(fmEnd);
  });
  it('recognizes rendered files as owned regardless of version', () => {
    expect(isOwnedSkillFile(renderSkill(FRONT, '9.9.9'))).toBe(true);
  });
  it('does not claim foreign skills', () => {
    expect(isOwnedSkillFile(FRONT)).toBe(false);
  });
});
```

```ts
// test/unit/opencode.test.ts
import { describe, expect, it } from 'vitest';
import { PLUGIN_SPEC, applyPluginEntry } from '../../src/lib/opencode.js';

describe('applyPluginEntry', () => {
  it('creates config with plugin array when file was empty object', () => {
    const r = applyPluginEntry({});
    expect(r.changed).toBe(true);
    expect(r.config.plugin).toEqual([PLUGIN_SPEC]);
  });
  it('appends once, preserves other plugins and keys', () => {
    const input = { theme: 'dark', plugin: ['other@x'] };
    const r = applyPluginEntry(input);
    expect(r.config.theme).toBe('dark');
    expect(r.config.plugin).toEqual(['other@x', PLUGIN_SPEC]);
    const again = applyPluginEntry(r.config);
    expect(again.changed).toBe(false);
    expect(again.config.plugin).toHaveLength(2);
  });
  it('refuses near-miss entries that look like ours', () => {
    const input = { plugin: ['superpowers@git+https://example.com/fork.git'] };
    expect(() => applyPluginEntry(input)).toThrow(/refusing/i);
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

```ts
// src/lib/ownership.ts
export class OwnershipError extends Error {}

export const FINGERPRINT_RE =
  /<!--\s*managed-by:\s*super-backlog\s*v?\d+\.\d+\.\d+\s*-->/;

export function renderSkill(templateContent: string, version: string): string {
  const line = `<!-- managed-by: super-backlog ${version} -->`;
  if (/^---\r?\n/.test(templateContent)) {
    const close = templateContent.indexOf('\n---', 3);
    const insertAt = templateContent.indexOf('\n', close + 1) + 1;
    return (
      templateContent.slice(0, insertAt) + `\n${line}` + templateContent.slice(insertAt)
    );
  }
  return `${line}\n${templateContent}`;
}

export function isOwnedSkillFile(content: string): boolean {
  return FINGERPRINT_RE.test(content);
}
```

```ts
// src/lib/opencode.ts
import { OwnershipError } from './ownership.js';

export const PLUGIN_SPEC = 'superpowers@git+https://github.com/obra/superpowers.git';

export function applyPluginEntry(config: unknown): {
  config: Record<string, unknown>;
  changed: boolean;
} {
  const base: Record<string, unknown> =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};

  const raw = base.plugin;
  const list: unknown[] = Array.isArray(raw) ? [...raw] : raw === undefined ? [] : [raw];

  if (list.includes(PLUGIN_SPEC)) return { config: base, changed: false };

  const suspicious = list.find(
    (e) => typeof e === 'string' && e.startsWith('superpowers@'),
  );
  if (suspicious !== undefined) {
    throw new OwnershipError(
      `refusing to modify existing superpowers plugin entry "${String(suspicious)}" — resolve manually, then re-run`,
    );
  }

  list.push(PLUGIN_SPEC);
  return { config: { ...base, plugin: list }, changed: true };
}
```

- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/ownership.ts src/lib/opencode.ts test/unit/ownership.test.ts test/unit/opencode.test.ts
git commit -m "feat(lib): ownership fingerprints and opencode plugin merge"
```

---

### Task 7: Task validator + guard hook install/remove

**Files:**
- Create: `src/lib/validate-task.ts`
- Create: `src/lib/hooks.ts`
- Create: `src/templates/guard-hook.sh`
- Test: `test/unit/validate-task.test.ts`, `test/unit/hooks.test.ts`

**Interfaces:**
- Produces:
  - `validateTaskMarkdown(filename: string, content: string): string[]` — errors array; checks frontmatter present, `id:` equals filename without `.md`, non-empty `title:`.
  - `HOOK_START(version)` / reuse `MARKER_END`: hook block markers `# >>> super-backlog guard <version> >>>` … `# <<< super-backlog guard <<<`
  - `renderGuardHook(version: string): string` — full executable pre-commit content (self-contained sh + embedded node validator calling the same rules)
  - `installGuardHook(gitDir: string, version: string): void` — append-or-replace marked section in `pre-commit`; ensures exec bit where platform allows.
  - `removeGuardHook(gitDir: string): boolean` — strips marked section; deletes file if result is empty/comments-only.

The hook validates staged `backlog/**` task files by running its embedded node snippet (no dependency on our package at runtime — keeps working even if someone prunes node_modules without uninstalling properly).

- [ ] **Step 1: Failing validator test**

```ts
// test/unit/validate-task.test.ts
import { describe, expect, it } from 'vitest';
import { validateTaskMarkdown } from '../../src/lib/validate-task.js';

const ok = (id: string) =>
  `---\nid: ${id}\ntitle: Something\nstatus: To Do\ncreated: 2026-08-25T00:00:00Z\n---\n\nbody\n`;

describe('validateTaskMarkdown', () => {
  it('accepts a well-formed task', () => {
    expect(validateTaskMarkdown('TASK-1.md', ok('TASK-1'))).toEqual([]);
  });
  it('rejects missing frontmatter', () => {
    const errs = validateTaskMarkdown('TASK-1.md', '# just markdown');
    expect(errs.join(' ')).toMatch(/frontmatter/i);
  });
  it('rejects id/filename mismatch', () => {
    const errs = validateTaskMarkdown('TASK-2.md', ok('TASK-1'));
    expect(errs.join(' ')).toMatch(/id.*TASK-1.*does not match.*TASK-2/i);
  });
  it('rejects empty title', () => {
    const errs = validateTaskMarkdown('TASK-1.md', ok('TASK-1').replace('title: Something', 'title: ""'));
    expect(errs.join(' ')).toMatch(/title/i);
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement validator**

```ts
// src/lib/validate-task.ts
export function validateTaskMarkdown(filename: string, content: string): string[] {
  const errors: string[] = [];
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) return [`backlog/tasks/${filename}: missing YAML frontmatter (edit tasks via the backlog CLI instead)`];
  const fm = m[1];
  const field = (name: string): string | null => {
    const fmMatch = new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm').exec(fm);
    return fmMatch ? fmMatch[1].replace(/^["']|["']$/g, '') : null;
  };
  const expectedId = filename.replace(/\.md$/, '');
  const id = field('id');
  if (!id) errors.push(`backlog/tasks/${filename}: missing 'id' field`);
  else if (id !== expectedId)
    errors.push(`backlog/tasks/${filename}: id '${id}' does not match filename '${expectedId}'`);
  const title = field('title');
  if (!title) errors.push(`backlog/tasks/${filename}: empty or missing 'title'`);
  return errors;
}
```

- [ ] **Step 4: Validator green.**
- [ ] **Step 5: Write hook template + failing hooks test**

```sh
# src/templates/guard-hook.sh
# >>> super-backlog guard {{VERSION}} >>>
# Validates staged backlog/** task files structurally.
# Escape hatch: git commit --no-verify
staged=$(git diff --cached --name-only --diff-filter=ACMR -- 'backlog/*' 2>/dev/null || true)
if [ -n "$staged" ]; then
  staged="$staged" node --input-type=commonjs -e '
    const { execSync } = require("child_process");
    const fs = require("fs");
    const errs = [];
    for (const f of process.env.staged.split("\n").filter(Boolean)) {
      if (!/^backlog\/tasks\/.+\.md$/.test(f)) continue;
      const content = fs.readFileSync(f, "utf8");
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
      if (!fm) { errs.push(`${f}: missing frontmatter (use the backlog CLI)`); continue; }
      const get = (n) => { const m = new RegExp("^" + n + ":\\s*(.*?)\\s*$", "m").exec(fm[1]); return m ? m[1].replace(/^["\x27]|["\x27]$/g, "") : null; };
      const id = get("id"), title = get("title");
      const want = f.replace(/^backlog\/tasks\//, "").replace(/\.md$/, "");
      if (!id) errs.push(`${f}: missing id`);
      else if (id !== want) errs.push(`${f}: id ${id} != filename ${want}`);
      if (!title) errs.push(`${f}: empty title`);
    }
    if (errs.length) { console.error("super-backlog guard rejected this commit:\n" + errs.map(e => "  - " + e).join("\n") + "\nBypass: git commit --no-verify"); process.exit(1); }
  ' || exit 1
fi
# <<< super-backlog guard <<<
```

```ts
// test/unit/hooks.test.ts
import { mkdtempSync, existsSync, readFileSync, rmSync, chmodSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installGuardHook, removeGuardHook } from '../../src/lib/hooks.js';

let dir: string;
beforeEach(() => { dir = join(mkdtempSync(join(tmpdir(), 'sbl-hook-')), '.git'); import('node:fs').then(fs => fs.mkdirSync(dir, { recursive: true })); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('guard hook lifecycle', () => {
  it('installs into pre-commit preserving foreign content', async () => {
    await new Promise((r) => setTimeout(r, 0));
    const pre = join(dir, 'pre-commit');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(pre, '#!/bin/sh\nnpm test\n');
    installGuardHook(dir, '1.0.0');
    const content = readFileSync(pre, 'utf8');
    expect(content).toContain('npm test');
    expect(content).toContain('>>> super-backlog guard 1.0.0 >>>');
    expect(content).toContain('<<< super-backlog guard <<<');
  });
  it('replaces older guard block on re-install', async () => {
    await new Promise((r) => setTimeout(r, 0));
    installGuardHook(dir, '1.0.0');
    installGuardHook(dir, '1.1.0');
    const content = readFileSync(join(dir, 'pre-commit'), 'utf8');
    expect(content).toContain('1.1.0');
    expect(content).not.toContain('1.0.0');
  });
  it('remove strips block and deletes file when nothing else remains', async () => {
    await new Promise((r) => setTimeout(r, 0));
    installGuardHook(dir, '1.0.0');
    expect(removeGuardHook(dir)).toBe(true);
    expect(existsSync(join(dir, 'pre-commit'))).toBe(false);
  });
  it('remove keeps foreign pre-commit intact', async () => {
    await new Promise((r) => setTimeout(r, 0));
    const { writeFileSync } = await import('node:fs');
    const pre = join(dir, 'pre-commit');
    writeFileSync(pre, '#!/bin/sh\nnpm test\n');
    installGuardHook(dir, '1.0.0');
    expect(removeGuardHook(dir)).toBe(true);
    expect(readFileSync(pre, 'utf8')).toContain('npm test');
  });
});
```

- [ ] **Step 6: Verify failure, then implement hooks.ts**

```ts
// src/lib/hooks.ts
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync as rf } from 'node:fs';
import { dirname, join as j } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD_RE = /^# >>> super-backlog guard [\d.]+ >>>[\s\S]*?# <<< super-backlog guard <<<\n?/m;

function hookTemplate(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // dist/lib at runtime, src/lib under vitest
  const candidates = [j(here, '..', 'templates', 'guard-hook.sh'), j(here, 'templates', 'guard-hook.sh')];
  for (const c of candidates) if (existsSync(c)) return rf(c, 'utf8');
  throw new Error('guard-hook.sh template not found');
}

export function renderGuardHook(version: string): string {
  return hookTemplate().replace('{{VERSION}}', version);
}

export function installGuardHook(gitDir: string, version: string): void {
  const path = join(gitDir, 'hooks', 'pre-commit');
  const block = renderGuardHook(version);
  let next: string;
  if (existsSync(path)) {
    const cur = readFileSync(path, 'utf8');
    next = GUARD_RE.test(cur) ? cur.replace(GUARD_RE, block) : cur.replace(/\n?$/, '\n') + block;
  } else {
    next = '#!/bin/sh\n' + block;
  }
  writeFileSync(path, next);
  try { chmodSync(path, 0o755); } catch { /* best effort on Windows */ }
}

export function removeGuardHook(gitDir: string): boolean {
  const path = join(gitDir, 'hooks', 'pre-commit');
  if (!existsSync(path)) return false;
  const cur = readFileSync(path, 'utf8');
  if (!GUARD_RE.test(cur)) return false;
  const rest = cur.replace(GUARD_RE, '').trim();
  if (rest === '' || rest === '#!/bin/sh') rmSync(path);
  else writeFileSync(path, rest + '\n');
  return true;
}
```

Adjust the earlier `beforeEach` in the test to create `.git` synchronously:

```ts
beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), 'sbl-hook-')), '.git');
  mkdirSync(dir, { recursive: true });
});
```

(and import `mkdirSync` statically.)

- [ ] **Step 7: Hooks green.**
- [ ] **Step 8: Commit**

```bash
git add src/lib/validate-task.ts src/lib/hooks.ts src/templates/guard-hook.sh test/unit/validate-task.test.ts test/unit/hooks.test.ts
git commit -m "feat(guard): task validator and self-contained pre-commit guard hook"
```

---

### Task 8: Glue templates (workflow block, skill, CLAUDE pointer)

**Files:**
- Create: `src/templates/workflow-block.md`
- Create: `src/templates/skill-spec-to-backlog.md`
- Create: `src/templates/claude-pointer.md`
- Test: `test/unit/templates.test.ts`

**Interfaces:**
- Produces: template contents with `{{VERSION}}` tokens; structural assertions guarantee required sections so later tasks can rely on them.

Template content requirements (assert in tests):
- workflow-block contains: roles line ("Backlog.md = WHAT", "Superpowers = HOW"), all 9 pipeline phases, the four binding rules, note that project gates go below the block.
- skill contains: trigger list, `backlog instructions overview` prerequisite, `--ac`, `--dep`, review-gate stop rule, "never hand-edit" boundary.
- claude-pointer references AGENTS.md block.

- [ ] **Step 1: Failing structural test**

```ts
// test/unit/templates.test.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tplDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'templates');
const read = (f: string) => readFileSync(join(tplDir, f), 'utf8');

describe('workflow-block.md', () => {
  const t = read('workflow-block.md');
  it('exists with version token', () => {
    expect(t).toContain('{{VERSION}}');
  });
  it('defines roles, nine phases, four rules', () => {
    expect(t).toMatch(/Backlog\.md = WHAT/);
    expect(t).toMatch(/Superpowers = HOW/);
    for (const phase of ['brainstorming', 'design gate', 'spec-to-backlog', 'review gate', 'plan-before-code', 'TDD implementation', 'verification & final summary', 'merge & archive']) {
      expect(t.toLowerCase()).toContain(phase.toLowerCase());
    }
    expect(t).toMatch(/[Nn]o task, no code/);
    expect(t).toMatch(/[Pp]lan before code/);
    expect(t).toMatch(/verification evidence/);
    expect(t).toMatch(/[Ss]kills take precedence/);
  });
  it('points project-specific gates below the block', () => {
    expect(t).toMatch(/below the block/i);
  });
});

describe('skill-spec-to-backlog.md', () => {
  const t = read('skill-spec-to-backlog.md');
  it('has frontmatter with name and description', () => {
    expect(t.startsWith('---')).toBe(true);
    expect(t).toMatch(/^name: spec-to-backlog$/m);
    expect(t).toMatch(/^description: .+/m);
  });
  it('covers triggers, prerequisites, flags, boundaries', () => {
    expect(t).toContain('writing-plans');
    expect(t).toContain('backlog instructions overview');
    expect(t).toContain('--ac');
    expect(t).toContain('--dep');
    expect(t).toMatch(/review gate/i);
    expect(t).toMatch(/never hand-edit/i);
  });
});

describe('claude-pointer.md', () => {
  it('points at the AGENTS.md block', () => {
    expect(read('claude-pointer.md')).toMatch(/AGENTS\.md/);
  });
});

describe('all templates exist', () => {
  it('no stray placeholders other than {{VERSION}}', () => {
    for (const f of ['workflow-block.md', 'skill-spec-to-backlog.md', 'claude-pointer.md']) {
      expect(existsSync(join(tplDir, f))).toBe(true);
      expect(read(f)).not.toMatch(/TBD|TODO/);
    }
  });
});
```

- [ ] **Step 2: Verify failure (files missing).**
- [ ] **Step 3: Author templates.**

`workflow-block.md` — write the full English block (roles, 9-phase pipeline table mirroring the approved design §6.2, binding rules, closing hint "Add project-specific human gates below the block."). Include token `{{VERSION}}` inside the intro sentence: `This section is managed by super-backlog {{VERSION}}.`

`skill-spec-to-backlog.md`:

```markdown
---
name: spec-to-backlog
description: Convert an approved design/implementation plan (from brainstorming/writing-plans) into reviewed Backlog.md tasks with acceptance criteria, milestones and dependencies. Use after a design is approved, when the user asks to decompose work into tasks, or before starting planned work in this project.
---

# Spec → Backlog: turn plan units into tracked tasks

Bridge between Superpowers (brainstorming, writing-plans) and Backlog.md.

## When this skill runs

1. After an approved design doc (end of brainstorming), BEFORE implementing.
2. After writing-plans, to materialize plan units as tasks.
3. When the user asks to split work into tasks.

## Procedure

1. Read `backlog instructions overview` and `backlog instructions task-creation` first.
2. Decompose: every plan unit becomes ONE task, small enough for one session/PR.
3. Create per task:
   backlog task create "Title" -d "<goal/context>" --ac "<criterion 1>" --ac "<criterion 2>" --type feature --label feature --ref "<path/to/plan-doc>"
   - Dependencies: --dep TASK-y (order follows the plan).
   - Larger efforts: backlog milestone add "<Name>", attach via -m.
   - Reference the plan doc via --ref; NEVER copy it into the task.
4. Never set --plan or --notes at create time — those belong to the "task started" checkpoint after codebase research.
5. STOP at the review gate: the human reviews specs and acceptance criteria (backlog board / backlog browser / dashboard.html) before any code exists.

## Boundaries

- Never hand-edit task markdown; use the backlog CLI exclusively.
- No code, no worktrees, no status changes inside this skill.
- Project-specific human-gate topics get their own tasks with an explicit review gate.
```

`claude-pointer.md`:

```markdown
## Workflow system (managed by super-backlog)

This project uses the combined Backlog.md + Superpowers workflow. Read the
integration block in AGENTS.md (section between SUPER-BACKLOG markers) and follow
it. Tasks are managed exclusively through the `backlog` CLI.
```

- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit**

```bash
git add src/templates/workflow-block.md src/templates/skill-spec-to-backlog.md src/templates/claude-pointer.md test/unit/templates.test.ts
git commit -m "feat(templates): workflow block, glue skill, claude pointer"
```

---

### Task 9: Process runner + backlog binary resolution

**Files:**
- Create: `src/lib/run.ts`
- Test: `test/unit/run.test.ts`

**Interfaces:**
- Produces:
  - `runCapture(cmd: string, args: string[], cwd: string): { status: number; stdout: string; stderr: string }` (sync spawn, utf8, no shell)
  - `resolveBacklogBin(cwd: string): string | null` — first hit among `<cwd>/node_modules/.bin/backlog<ext>` then PATH lookup (`where`/`which` via runCapture), else null.

- [ ] **Step 1: Failing test**

```ts
// test/unit/run.test.ts
import { describe, expect, it } from 'vitest';
import { resolveBacklogBin, runCapture } from '../../src/lib/run.js';

describe('runCapture', () => {
  it('captures stdout and status', () => {
    const node = process.execPath;
    const r = runCapture(node, ['-e', 'console.log(42)'], process.cwd());
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('42');
  });
  it('reports nonzero status without throwing', () => {
    const r = runCapture(process.execPath, ['-e', 'process.exit(3)'], process.cwd());
    expect(r.status).toBe(3);
  });
});

describe('resolveBacklogBin', () => {
  it('returns null when nowhere to be found (fixture cwd)', () => {
    // Not guaranteed on machines with global backlog; acceptable flake-guard:
    const r = resolveBacklogBin(process.platform === 'win32' ? 'C:\\__no_such_dir__' : '/__no_such_dir__');
    expect(['backlog', null]).toContain(r);
  });
});
```

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement**

```ts
// src/lib/run.ts
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';

export interface RunResult { status: number; stdout: string; stderr: string; }

export function runCapture(cmd: string, args: string[], cwd: string): RunResult {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false });
  if (r.error && (r.status === null || r.status === undefined)) {
    return { status: 127, stdout: '', stderr: String(r.error.message) };
  }
  return {
    status: r.status ?? 1,
    stdout: (r.stdout ?? '').toString(),
    stderr: (r.stderr ?? '').toString(),
  };
}

const EXT = process.platform === 'win32' ? '.cmd' : '';

export function resolveBacklogBin(cwd: string): string | null {
  const local = join(cwd, 'node_modules', '.bin', `backlog${EXT}`);
  if (existsSync(local)) return local;
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const w = runCapture(probe, ['backlog'], cwd);
  if (w.status === 0) {
    const first = w.stdout.split(/\r?\n/).find(Boolean);
    if (first) return first.trim().replace(/\.ps1$/i, '.cmd');
  }
  return null;
}
```

- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/run.ts test/unit/run.test.ts
git commit -m "feat(lib): sync process runner and backlog bin resolution"
```

---

### Task 10: Init planner (pure ChangeSet)

**Files:**
- Create: `src/init/planner.ts`
- Test: `test/unit/planner.test.ts`

**Interfaces:**
- Consumes: libs from Tasks 1–8.
- Produces:
  ```ts
  export interface FileOp { kind: 'write'; path: string; contents: string }
  export interface JsonOp { kind: 'merge-json'; path: 'opencode.json' | 'package.json'; transform: 'plugin-entry' | 'scripts-and-devdeps' }
  export interface InjectOp { kind: 'inject-agents-block' }
  export interface PointerOp { kind: 'write-claude-pointer' }
  export interface SkillsOp { kind: 'copy-skills' }
  export interface HookOp { kind: 'install-guard-hook' }
  export interface UpstreamOp { kind: 'upstream-install'; pm: PM | 'none' } // skipped when SBL_SKIP_INSTALL
  export interface DashboardOp { kind: 'generate-dashboard' }
  export type Action = FileOp | JsonOp | InjectOp | PointerOp | SkillsOp | HookOp | UpstreamOp | DashboardOp;

  export interface InitOptions {
    projectName?: string; harnesses: Array<'opencode' | 'claude'>; pm: PM | 'auto' | 'skip';
    guard: boolean; dashboard: boolean; skipInstall: boolean;
  }
  export interface InitState { cwd: string; hasBacklogConfig: boolean; agentsExists: boolean; claudeMdExists: boolean; opencodeConfig: unknown | undefined /* undefined = file absent */; pkgExists: boolean; }
  export function planInit(state: InitState, opts: InitOptions, version: string): { actions: Action[]; warnings: string[] }
  ```

Planner rules (each covered by a test):
- Always emits `upstream-install` unless `opts.skipInstall` or `pm === 'skip'`; pm resolved when `'auto'` (state needs `detectedPm: PM | null` — extend state with `detectedPm`). If auto resolves to `null` and not skipInstall → warning + `pm:'none'` action variant replaced by warning string in returned `warnings` and no upstream action.
- `opencode.json` merge only when harness includes opencode AND (`opencodeConfig !== undefined` or file-absent → still emit merge-json; executor creates file). When applyPluginEntry would throw (near-miss), planner catches and pushes warning, omits action.
- `inject-agents-block` emitted when harnesses include either (block targets AGENTS.md regardless of harness choice — both harnesses read it).
- `write-claude-pointer` only when `harnesses` includes claude.
- `copy-skills` when any harness selected (writes both locations; harmless extra for single-harness users, documented).
- `install-guard-hook` only when `guard`.
- `generate-dashboard` unless `dashboard === false`.
- `merge-json package.json` only when `pkgExists`.

- [ ] **Step 1: Failing tests** — cover each rule above with fixture states (empty project; existing opencode.json with other plugin; near-miss plugin; claude-only harness; guard; dashboard off; skipInstall; no package.json).

```ts
// test/unit/planner.test.ts
import { describe, expect, it } from 'vitest';
import { PLUGIN_SPEC } from '../../src/lib/opencode.js';
import { planInit, type InitState } from '../../src/init/planner.js';

const base: InitState = {
  cwd: '/proj', detectedPm: 'npm', hasBacklogConfig: false,
  agentsExists: false, claudeMdExists: false, opencodeConfig: undefined, pkgExists: true,
};

describe('planInit', () => {
  it('plans full flow for defaults', () => {
    const { actions, warnings } = planInit(base, {
      harnesses: ['opencode', 'claude'], pm: 'auto', guard: false, dashboard: true, skipInstall: false,
    }, '1.0.0');
    const kinds = actions.map(a => a.kind);
    expect(kinds).toContain('upstream-install');
    expect(kinds).toContain('merge-json');
    expect(kinds.filter(k => k === 'merge-json')).toHaveLength(2);
    expect(kinds).toContain('inject-agents-block');
    expect(kinds).toContain('write-claude-pointer');
    expect(kinds).toContain('copy-skills');
    expect(kinds).toContain('generate-dashboard');
    expect(warnings).toEqual([]);
  });

  it('skips upstream when skipInstall', () => {
    const { actions } = planInit(base, { harnesses: ['opencode'], pm: 'auto', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(actions.map(a => a.kind)).not.toContain('upstream-install');
  });

  it('warns and skips upstream without detected PM', () => {
    const { actions, warnings } = planInit({ ...base, detectedPm: null, pkgExists: false },
      { harnesses: ['opencode'], pm: 'auto', guard: false, dashboard: false, skipInstall: false }, '1.0.0');
    expect(actions.map(a => a.kind)).not.toContain('upstream-install');
    expect(warnings.join(' ')).toMatch(/no package manager detected/i);
    expect(actions.map(a => a.kind)).not.toContain('merge-json');
  });

  it('omits opencode merge on near-miss entry with warning', () => {
    const { actions, warnings } = planInit(
      { ...base, opencodeConfig: { plugin: ['superpowers@git+https://example.com/fork.git'] } },
      { harnesses: ['opencode'], pm: 'skip', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(actions.filter(a => a.kind === 'merge-json' && (a as any).path === 'opencode.json')).toHaveLength(0);
    expect(warnings.join(' ')).toMatch(/refusing/i);
  });

  it('claude-only skips opencode merge but still merges package.json', () => {
    const { actions } = planInit(base, { harnesses: ['claude'], pm: 'skip', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    const jsonOps = actions.filter(a => a.kind === 'merge-json') as Array<{ kind: 'merge-json'; path: string }>;
    expect(jsonOps.map(a => a.path)).toEqual(['package.json']);
    expect(actions.some(a => a.kind === 'write-claude-pointer')).toBe(true);
  });

  it('adds guard hook action only when requested', () => {
    const with_ = planInit(base, { harnesses: ['opencode'], pm: 'skip', guard: true, dashboard: false, skipInstall: true }, '1.0.0');
    const without = planInit(base, { harnesses: ['opencode'], pm: 'skip', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(with_.actions.some(a => a.kind === 'install-guard-hook')).toBe(true);
    expect(without.actions.some(a => a.kind === 'install-guard-hook')).toBe(false);
  });
});
```

Note during implementation: none required — the claude-only test asserts exactly one `merge-json` (`package.json`) plus the pointer op.

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement planner per rules.** (Straightforward composition of lib calls; ~120 lines. Block contents come from `renderSkill`-style helpers defined here: `agentsBlockContents(version)` returning workflow template with `{{VERSION}}` replaced.)

- [ ] **Step 4: Green.**
- [ ] **Step 5: Commit**

```bash
git add src/init/planner.ts test/unit/planner.test.ts
git commit -m "feat(init): pure ChangeSet planner"
```

---

### Task 11: Init executor + `sbl init` command

**Files:**
- Create: `src/init/execute.ts`
- Create: `src/commands/init.ts`
- Modify: `src/cli.ts` (create minimal dispatcher now: parseArgs with subcommands init/uninstall/update/dashboard; unknown → help; exit codes per Global Constraints)
- Test: `test/e2e/init.e2e.test.ts`

**Interfaces:**
- Consumes: `planInit` actions; executor implements each op against disk:
  - `upstream-install`: run PM install cmds for `['backlog.md@latest','super-backlog@latest']` via `runCapture` (exit 3 on failure); then `resolveBacklogBin` + `runCapture(backlog, ['init', name, '--defaults', '--agent-instructions', 'none'], cwd)` unless `hasBacklogConfig`. With `SBL_SKIP_INSTALL=1`: instead fabricate `backlog/config.yml` containing `project_name: <name>` and continue.
  - `merge-json`: read file (or `{}`), apply transform, pretty-print 2-space JSON + trailing newline, `atomicWrite`.
  - `inject-agents-block`: read-or-create AGENTS.md, `injectBlock`, write when changed.
  - `write-claude-pointer`: append pointer template to CLAUDE.md (create if missing; skip when our heading already present — detect via `/Workflow system \(managed by super-backlog\)/`).
  - `copy-skills`: write `renderSkill(skillTpl, version)` to `.opencode/skill/spec-to-backlog/SKILL.md` and `.claude/skills/spec-to-backlog/SKILL.md`.
  - `install-guard-hook`: locate `.git` dir upward (helper `findGitDir(cwd): string | null` in execute.ts; warning when none found).
  - `generate-dashboard`: dynamic-import dashboard generator (`await import('../commands/dashboard.js')`), call `generateDashboard(cwd, { serve: false })`; on failure push warning, keep exit code 0 → overall exit 4 if warnings non-empty else 0.
- Produces: `runInit(cwd: string, args: ParsedArgs): Promise<number>`; CLI prints summary table (planned vs applied vs skipped + warnings).

- [ ] **Step 1: E2E failing test**

```ts
// test/e2e/init.e2e.test.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'cli.js'); // built by pretest step below

function scaffoldProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sbl-e2e-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo', version: '0.0.1' }));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

describe('sbl init (SBL_SKIP_INSTALL)', () => {
  let dir = '';
  beforeEach(() => { dir = scaffoldProject(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes manifest artifacts and is idempotent', () => {
    execFileSync(process.execPath, [CLI, 'init', '--pm', 'npm', '--no-dashboard'], {
      cwd: dir, env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    });
    const oc = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect(oc.plugin).toContain('superpowers@git+https://github.com/obra/superpowers.git');
    const agents = readFileSync(join(dir, 'agents.md').replace('agents', 'AGENTS'), 'utf8');
    expect(agents).toMatch(/SUPER-BACKLOG:\d+\.\d+\.\d+ START/);
    expect(existsSync(join(dir, '.opencode', 'skill', 'spec-to-backlog', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dir, '.claude', 'skills', 'spec-to-backlog', 'SKILL.md'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts.board).toBe('backlog board');
    expect(pkg.devDependencies['backlog.md']).toBe('latest');
    expect(JSON.parse(readFileSync(join(dir, 'backlog', 'config.yml'), 'utf8') || '{}')).toBeTruthy(); // fabricated stub exists
    const hook = readFileSync(join(dir, '.git', 'hooks', 'pre-commit'), 'utf8');
    expect(hook).toContain('super-backlog guard');

    // re-run: no duplication
    execFileSync(process.execPath, [CLI, 'init', '--pm', 'npm', '--no-dashboard'], {
      cwd: dir, env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    });
    const oc2 = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect(oc2.plugin.filter(e => e.includes('superpowers'))).toHaveLength(1);
  });

  it('--dry-run changes nothing', () => {
    execFileSync(process.execPath, [CLI, 'init', '--dry-run', '--no-dashboard'], {
      cwd: dir, env: { ...process.env, SBL_SKIP_INSTALL: '1' },
    });
    expect(existsSync(join(dir, 'opencode.json'))).toBe(false);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
  });
});
```

Pretest step: add `"pretest": "npm run build"` to scripts in package.json (modify in this task) so e2e uses fresh dist.

- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement execute.ts + commands/init.ts + cli.ts dispatcher** (~200 lines total, following Interfaces contracts above; `cli.ts` uses `util.parseArgs` with `allowPositionals` and per-command flag tables; prints English summary; maps warnings→exit 4).
- [ ] **Step 4: Build + e2e green** — `npm.cmd run build; npx.cmd vitest run test/e2e/init.e2e.test.ts` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/init/execute.ts src/commands/init.ts src/cli.ts test/e2e/init.e2e.test.ts package.json
git commit -m "feat(init): sbl init command with idempotent executor"
```

---

### Task 12: `sbl uninstall`

**Files:**
- Create: `src/commands/uninstall.ts`
- Test: `test/e2e/uninstall.e2e.test.ts`

**Interfaces:**
- Produces: `runUninstall(cwd, args): number`. Removal set (only provably owned):
  1. `stripOwned` AGENTS.md; pointer-heading check removes our CLAUDE.md section.
  2. Delete skill dirs when their SKILL.md passes `isOwnedSkillFile`; leave foreign dirs untouched.
  3. Remove `scripts.tasks/board/browser/dashboard` ONLY when value matches WANTED_SCRIPTS exactly; remove devDeps `backlog.md`/`super-backlog` ONLY when spec === 'latest'.
  4. Remove opencode plugin entry only when byte-equal PLUGIN_SPEC (array left possibly empty; delete `plugin` key if emptied).
  5. `removeGuardHook`.
  6. Delete `dashboard.html`.
  7. Default: keep `backlog/` and `backlog.md` dep data untouched; `--with-backlog` additionally removes devDep entries regardless of spec, deletes `backlog/`, and prints prominent data-deleted notice.
  - Report lines `removed:` / `kept:` / `skipped:` per item; exit 0.

- [ ] **Step 1: Failing e2e** — chain: run init e2e helper (extract shared `scaffoldAndInit()` into `test/e2e/helpers.ts` in this task), then uninstall, assert: AGENTS.md has no SUPER-BACKLOG markers, skill dirs gone, scripts gone, plugin entry gone (array empty → key removed), hook gone, `backlog/config.yml` STILL exists; second variant with `--with-backlog` removes it.
- [ ] **Step 2–4: implement, build, green.**
- [ ] **Step 5: Commit**

```bash
git add src/commands/uninstall.ts test/e2e/uninstall.e2e.test.ts test/e2e/helpers.ts
git commit -m "feat(uninstall): ownership-scoped clean removal"
```

---

### Task 13: `sbl update`

**Files:**
- Create: `src/commands/update.ts`
- Test: `test/unit/update.test.ts` (pure parts) + reuse e2e helper

**Interfaces:**
- Produces: `runUpdate(cwd, args): number`. Behavior: re-run planner with current state (skipInstall=false, pm auto) restricted to refresh ops (`inject-agents-block`, `pointer`, `copy-skills`, guard if installed, dashboard regen if file exists) + print upstream freshness report:
  - local backlog version: `runCapture(resolvedBacklogBin, ['--version'])`
  - published: `runCapture(npm, ['view', 'backlog.md', 'version'])` — network allowed here (real command, guarded by try/catch → warning offline).
- Unit-test the pure filter `refreshActions(all: Action[]): Action[]` exported from update.ts.

- [ ] **Steps:** failing test → implement (small) → green → commit `feat(update): refresh injected glue and report upstream versions`.

---

### Task 14: Dashboard collector + HTML generator

**Files:**
- Create: `src/dashboard/data.ts`
- Create: `src/dashboard/render.ts`
- Create: `src/templates/dashboard.html`
- Test: `test/unit/dashboard-data.test.ts`, `test/unit/dashboard-render.test.ts` (snapshot)

**Interfaces:**
- Produces:
  ```ts
  export interface DashboardData {
    project: { name: string; description: string };
    generatedAt: string; kitVersion: string;
    statuses: Array<{ status: string; count: number }>;
    milestones: Array<{ name: string; done: number; total: number }>;
    tasks: Array<{ id: string; title: string; status: string; priority?: string; assignee?: string; updated?: string; milestone?: string; description?: string; acs: Array<{ text: string; checked: boolean }> }>;
    source: 'backlog-json' | 'fallback-empty';
  }
  export function collectDashboardData(cwd: string, opts: { kitVersion: string }): DashboardData;
  export function renderDashboard(data: DashboardData): string;
  export async function generateDashboard(cwd: string, o: { serve: boolean }): Promise<string>; // writes dashboard.html, optionally serves
  ```
- Collector: prefer `resolveBacklogBin`; `task list --json` parsed defensively (accept `{tasks:[...]}` shape; map fields `id,title,status,priority,assignee,updated_at,milestone,description,acceptance_criteria[]` tolerantly — unknown shapes degrade to `fallback-empty` with zero counts, never crash).
- Renderer contract (snapshot-tested): output starts `<!doctype html>`; embeds `<script type="application/json" id="sbl-data">` containing JSON with `<` escaped as `\u003c`; contains section headings `Overview`, `Milestones`, `Tasks`, `Workflow cheat sheet`; contains quick-command strings `backlog browser` and `sbl dashboard --serve`; no external URLs (`http` occurrences limited to xmlns-free inline SVG only → simply assert `src="http` absent and `href="http` absent).

HTML/CSS/JS requirements (authored fully in template): header w/ name+description+generatedAt+kitVersion; metric cards from statuses; milestone progress bars; task table with client-side sort/filter + row-expand detail incl. AC checkboxes; 9-phase cheat-sheet grid (static content duplicated from workflow-block phases — acceptable, asserted equal via shared constant in render.ts importing `PIPELINE_PHASES` exported from a new `src/dashboard/phases.ts` also used by… simpler: define `PIPELINE_PHASES` in render.ts and have workflow template stay prose-only); dark/light via `prefers-color-scheme`; system font stack; vanilla JS ≤150 lines.

- [ ] **Steps:** failing data test (fixture JSON + fake bin dir) → failing snapshot render test → implement → green → commit `feat(dashboard): Project Dashboard data collection and single-file renderer`.

---

### Task 15: `--serve` mode + CLI completion

**Files:**
- Create: `src/dashboard/server.ts`
- Modify: `src/commands/dashboard.ts`, `src/cli.ts` (final wiring, help texts, exit-code mapping, `--version`)
- Test: `test/integration/serve.test.ts`

**Interfaces:**
- Produces: `startServeServer(cwd, { port, regenerate: () => Promise<void>, openBrowser: boolean }): Promise<{ server: http.Server; port: number; close(): Promise<void> }>` — ephemeral-port capable for tests (pass 0); GET `/` → latest dashboard.html bytes; fs.watch on `<cwd>/backlog` triggers `regenerate()` (debounced 300ms).
- CLI: `sbl dashboard [--serve] [--port N] [--no-open] [--out dashboard.html]`; `sbl --version`; top-level help listing all commands with one-line descriptions.

- [ ] **Step 1: Failing integration test** — start server on port 0, fetch `/` via `node:http` request, assert 200 + doctype + contains project name; call `regenerate` manually after writing temp backlog file, poll until content hash changes (timeout 2s).
- [ ] **Steps 2–4:** implement → build → green.
- [ ] **Step 5: Commit** `feat(dashboard): serve mode with live regeneration; finalize CLI`.

---

### Task 16: Docs, LICENSE, polish, pack check

**Files:**
- Create: `README.md`, `LICENSE` (MIT, copyright 2026 super-backlog contributors), `CHANGELOG.md` (0.1.0 entry), `CONTRIBUTING.md` (short), `docs/architecture.md`, `docs/harness-support.md`, `docs/guard.md`, `docs/troubleshooting.md` (incl. Windows OpenCode npm-fallback steps verbatim from obra/superpowers INSTALL.md)
- Modify: `README.md` badge-less, sections: What/Why (niche paragraph from spec §1), Quickstart (3 commands), What gets installed (manifest table copied from spec §4.1), Project Dashboard screenshot placeholder replaced by `docs/assets/dashboard.png` TODO-capture step executed manually post-v0, Uninstall guarantee, Requirements, Troubleshooting link.

Testable bits: `test/docs.test.ts` asserts README contains `npx super-backlog init`, the four merged script names, `dashboard.html`, and uninstall guarantee sentence — prevents doc rot.

- [ ] Steps: write docs → failing docs test → green → `npm.cmd pack --dry-run` (assert tarball includes dist+README only, no src/test) → adjust `files` if needed → commit `docs: README, guides, license, changelog`.

---

### Task 17: Dogfood — equip this repo with the kit

**Files:**
- Modify: `AGENTS.md`, `opencode.json`, `package.json`, `.git/hooks/pre-commit`, plus generated `dashboard.html` (this repo)

**Steps:**
1. `npm.cmd run build`
2. `node dist/cli.js init --pm npm` (real install this time — pulls `backlog.md@latest` + `super-backlog@latest` as devDeps of the kit repo itself; keep `private:true`).
3. Review diff: our hand-made `opencode.json` entry must remain single; AGENTS.md gains marker block AFTER the existing BACKLOG.MD guidelines comment (order irrelevant, verify no nesting).
4. `npm.cmd run dashboard` → commit `chore: dogfood super-backlog on itself`.
5. Manually capture `docs/assets/dashboard.png` for README (only remaining manual step).

---

## Self-Review Notes

- Spec coverage: D1–D9 → Tasks 10/11 (D1,D6,D7), 14/15 (D2,D9), 8/16 (D3), 16+12 (D4 roadmap pointers live in our own backlog — created post-v0 via spec-to-backlog), naming (D5) in Task 1 package.json, guard (D8) Tasks 7/11/12, freshness (D7) Tasks 11/13.
- Known forward dependency handled: Task 11 imports Task 14's `generateDashboard` dynamically with warning fallback — interfaces declared here so both sides implement to contract.
- Type consistency checked across Interface blocks (`Action` union, `DashboardData`, `PM`, marker constants).
