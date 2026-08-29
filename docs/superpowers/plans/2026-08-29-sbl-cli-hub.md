# sbl CLI, Dashboard Hub, and Version Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One viewing command (`sbl dashboard`), a multi-project hub at `http://127.0.0.1:6428/p/<slug>/`, a once-per-day npm version hint, and CLI contract tests.

**Architecture:** Export `runCli` from `src/cli.ts` so help and removed commands are unit-tested. A pure `projectSlug` plus `hub-state` file decide become-hub vs attach. `startHubServer` is one HTTP process with a project registry; existing `/api/run` and SSE handlers stay unchanged and receive URL-stripped `/api/...` paths. `applyVersionHint` is an injectable module called from `runCli` and never blocks on the network.

**Tech Stack:** Node 20+ ESM TypeScript, vitest, existing `runCapture` / `atomicWrite` / `readSimpleKeys`. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-29-sbl-cli-hub-design.md`

## Global Constraints

- Node >= 20; ESM-only; internal imports use `.js` extensions.
- No new runtime dependencies.
- Hub listens on `127.0.0.1` only. Default port `6428`. Never auto-pick the next free port.
- Do not spawn `backlog browser` from `sbl dashboard`.
- Do not add `sbl backlog`. Do not auto-run `npm i -g`.
- Version hint skipped when `SBL_SKIP_UPDATE_CHECK` is non-empty; never changes command exit codes.
- Tests must not hit the live npm registry.
- User-facing CLI copy is English.
- Do not rewrite historical specs, archived tasks, or CHANGELOG history.

## File map

| File | Role |
|---|---|
| `src/cli.ts` | `HELP`, `runCli(argv)`, removed-command errors, calls version hint |
| `src/lib/slug.ts` | `projectSlug(cwd)` |
| `src/lib/hub-state.ts` | `hub.json` read/write/probe |
| `src/dashboard/hub.ts` | `startHubServer`, register, routes `/`, `/api/hub/*`, `/p/<slug>/...` |
| `src/dashboard/server.ts` | Keep brokers, `createRunApiHandler`, watch helpers; `startServeServer` becomes a thin wrapper or is replaced by hub tests |
| `src/commands/dashboard.ts` | Become hub vs attach; no browser spawn |
| `src/lib/version-check.ts` | Cache + hint |
| `src/templates/dashboard.html` | Relative `api/run` and `api/events` |
| Delete | `src/commands/serve.ts` after CLI no longer imports it |

---

### Task 1: CLI contract — remove serve/browser/board

**Files:**
- Modify: `src/cli.ts`
- Delete: `src/commands/serve.ts` (after `cli.ts` stops importing it)
- Test: `test/unit/cli-contract.test.ts`
- Modify: `test/unit/dashboard-command.test.ts` (drop `runServe` describe)
- Modify: `test/unit/glue-skills.test.ts`
- Modify: `src/templates/skill-backlog-status-report.md`
- Modify: `README.md`, `docs/guide/quickstart.md`, `docs/guide/troubleshooting.md` (command lists and `--serve` wording only)

**Interfaces:**
- Consumes: existing `runInit`, `runUninstall`, `runUpdate`, `runDashboard`, `runModels`, `runDoctor`.
- Produces:
  - `export const HELP: string`
  - `export async function runCli(argv: string[]): Promise<number>`
  - Removed commands `serve` | `browser` | `board` → stderr `error: "sbl <cmd>" was removed; the live dashboard is \`sbl dashboard\`` and return `1`

- [ ] **Step 1: Write the failing CLI contract tests**

```ts
// test/unit/cli-contract.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HELP, runCli } from '../../src/cli.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HELP', () => {
  it('lists kept commands and dashboard flags only', () => {
    for (const cmd of ['init', 'uninstall', 'update', 'dashboard', 'models', 'doctor']) {
      expect(HELP).toContain(cmd);
    }
    expect(HELP).toContain('--port');
    expect(HELP).toContain('--no-open');
    expect(HELP).not.toMatch(/^\s+serve\s/m);
    expect(HELP).not.toMatch(/^\s+browser\s/m);
    expect(HELP).not.toMatch(/^\s+board\s/m);
    expect(HELP).not.toContain('--serve');
  });
});

describe('runCli', () => {
  it('prints version for --version and -v', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runCli(['--version'])).toBe(0);
    expect(await runCli(['-v'])).toBe(0);
    expect(log.mock.calls.length).toBeGreaterThan(0);
  });

  it('prints HELP for help, --help, -h, and no args', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const argv of [[], ['help'], ['--help'], ['-h']]) {
      expect(await runCli(argv)).toBe(0);
    }
    expect(log.mock.calls.some((c) => String(c[0]).includes('Usage: sbl'))).toBe(true);
  });

  it.each(['serve', 'browser', 'board'])('rejects removed command %s', async (cmd) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runCli([cmd])).toBe(1);
    expect(err.mock.calls.map(String).join('\n')).toContain(`"sbl ${cmd}" was removed`);
    expect(err.mock.calls.map(String).join('\n')).toContain('sbl dashboard');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/unit/cli-contract.test.ts`

Expected: FAIL (`HELP` / `runCli` not exported, or `serve` still in help).

- [ ] **Step 3: Export `HELP` and `runCli`; remove aliases**

In `src/cli.ts`:
- Change `const HELP` to `export const HELP`.
- Extract the body of `main` into `export async function runCli(argv: string[]): Promise<number>`.
- Add explicit `case 'serve':`, `case 'browser':`, `case 'board':` that `console.error` the spec message and `return 1`.
- Remove imports of `runServe` and `runBacklogSubcommand`.
- Drop `browser`, `board`, and `serve` from `HELP` (keep dashboard `--port` / `--no-open`).
- Bottom of file still: `runCli(process.argv.slice(2)).then(...)`.

Delete `src/commands/serve.ts`.

In `test/unit/dashboard-command.test.ts` delete the `runServe` import and `describe('runServe')` block.

`src/templates/skill-backlog-status-report.md`: replace `sbl dashboard --serve` with `sbl dashboard`. Keep `backlog browser` (that skill still points agents at the upstream CLI).

`test/unit/glue-skills.test.ts`: `expect(t).toContain('sbl dashboard');` and `expect(t).not.toContain('--serve');`. Keep the `backlog browser` assertion.

README / `docs/guide/quickstart.md` / `docs/guide/troubleshooting.md`: remove `sbl serve` and `sbl dashboard --serve` as the happy path. Troubleshooting Windows Node 24 section title becomes `` `sbl dashboard` disables live reload `` (same technical content, no `--serve`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/cli-contract.test.ts test/unit/dashboard-command.test.ts test/unit/glue-skills.test.ts test/docs.test.ts`

Expected: PASS. If `docs.test.ts` asserts `sbl serve`, update that assertion to the new command list.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts src/commands/serve.ts src/templates/skill-backlog-status-report.md test/unit/cli-contract.test.ts test/unit/dashboard-command.test.ts test/unit/glue-skills.test.ts README.md docs/guide/quickstart.md docs/guide/troubleshooting.md
git commit -m "feat(cli): drop serve/browser/board; export runCli contract"
```

---

### Task 2: `projectSlug`

**Files:**
- Create: `src/lib/slug.ts`
- Test: `test/unit/slug.test.ts`

**Interfaces:**
- Consumes: `readSimpleKeys` from `src/lib/yamlmini.ts`; `realpathSync`, `basename` from `node:fs` / `node:path`.
- Produces:
  - `export type SlugResult = { ok: true; slug: string } | { ok: false; reason: 'empty' }`
  - `export function projectSlug(cwd: string): SlugResult`
  - `export function realpathKey(cwd: string): string` — `realpathSync` result; on `win32` lowercased

Rules (spec §6): `project_name` from `backlog/config.yml` if non-empty string, else `basename(realpath(cwd))`. Do not use config `name` or `package.json` `name`. Sanitize: NFKD, strip combining marks, lower case, spaces/underscores → `-`, drop except `[a-z0-9-]`, collapse `-`, trim `-`. Empty → `{ ok: false, reason: 'empty' }`.

- [ ] **Step 1: Write failing tests**

```ts
// test/unit/slug.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectSlug } from '../../src/lib/slug.js';

const dirs: string[] = [];
function fresh(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), name));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('projectSlug', () => {
  it('uses project_name from backlog/config.yml', () => {
    const cwd = fresh('sbl-slug-');
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), 'project_name: Acme Webshop\n');
    expect(projectSlug(cwd)).toEqual({ ok: true, slug: 'acme-webshop' });
  });

  it('does not use package.json name when project_name is absent', () => {
    const cwd = fresh('sbl-slug-pkg-');
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'not-the-slug' }));
    const slug = projectSlug(cwd);
    expect(slug.ok).toBe(true);
    if (slug.ok) expect(slug.slug).not.toBe('not-the-slug');
  });

  it('returns empty when sanitize strips everything', () => {
    const cwd = fresh('sbl-slug-empty-');
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), 'project_name: ---\n');
    expect(projectSlug(cwd)).toEqual({ ok: false, reason: 'empty' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/slug.test.ts`

Expected: FAIL `projectSlug is not defined`.

- [ ] **Step 3: Implement `src/lib/slug.ts`**

```ts
import { realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import process from 'node:process';
import { readSimpleKeys } from './yamlmini.js';

export type SlugResult = { ok: true; slug: string } | { ok: false; reason: 'empty' };

export function realpathKey(cwd: string): string {
  const resolved = realpathSync(cwd);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function sanitizeSlug(raw: string): string {
  const nk = raw.normalize('NFKD').replace(/\p{M}/gu, '');
  return nk
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function projectSlug(cwd: string): SlugResult {
  const cfg = readSimpleKeys(join(cwd, 'backlog', 'config.yml'), ['project_name']);
  const raw = (cfg.project_name && cfg.project_name.trim() !== '' ? cfg.project_name : basename(realpathSync(cwd)));
  const slug = sanitizeSlug(raw);
  if (slug === '') return { ok: false, reason: 'empty' };
  return { ok: true, slug };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/slug.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts test/unit/slug.test.ts
git commit -m "feat(hub): add projectSlug from project_name"
```

---

### Task 3: Hub state file

**Files:**
- Create: `src/lib/hub-state.ts`
- Test: `test/unit/hub-state.test.ts`

**Interfaces:**
- Consumes: `atomicWrite` from `src/lib/atomic.ts`.
- Produces:
  - `export interface HubState { pid: number; port: number; token: string }`
  - `export function hubStatePath(home: string): string` → `join(home, '.super-backlog', 'hub.json')`
  - `export function readHubState(home: string): HubState | null`
  - `export function writeHubState(home: string, state: HubState): void`
  - `export function clearHubState(home: string, pid: number): void` — delete only if file pid matches
  - `export function isPidAlive(pid: number): boolean` — `process.kill(pid, 0)` in try/catch
  - `export function newHubToken(): string` — 16 bytes hex via `node:crypto`

- [ ] **Step 1: Write failing tests**

```ts
// test/unit/hub-state.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import process from 'node:process';
import { clearHubState, hubStatePath, isPidAlive, readHubState, writeHubState } from '../../src/lib/hub-state.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('hub-state', () => {
  it('round-trips hub.json under the injected home', () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-hub-home-'));
    dirs.push(home);
    writeHubState(home, { pid: 42, port: 6428, token: 'abc' });
    expect(readHubState(home)).toEqual({ pid: 42, port: 6428, token: 'abc' });
    expect(hubStatePath(home)).toContain('.super-backlog');
  });

  it('clearHubState ignores a file owned by another pid', () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-hub-home-'));
    dirs.push(home);
    writeHubState(home, { pid: 1, port: 6428, token: 'x' });
    clearHubState(home, 99);
    expect(readHubState(home)?.pid).toBe(1);
  });

  it('isPidAlive is true for this process', () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/hub-state.test.ts`

Expected: FAIL module not found.

- [ ] **Step 3: Implement `src/lib/hub-state.ts`**

Use `mkdirSync(join(home, '.super-backlog'), { recursive: true })` before write. `readHubState` returns `null` on missing/invalid JSON/missing fields. `isPidAlive`: `try { process.kill(pid, 0); return true; } catch { return false; }`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/hub-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-state.ts test/unit/hub-state.test.ts
git commit -m "feat(hub): persist hub.json state"
```

---

### Task 4: Hub HTTP server

**Files:**
- Create: `src/dashboard/hub.ts`
- Modify: `src/templates/dashboard.html` (absolute `/api/` → relative `api/`)
- Modify: `test/unit/dashboard-render.test.ts` (EventSource/fetch assertions)
- Modify: `test/integration/serve.test.ts` (paths `/` → `/p/<slug>/`; keep watcher skips)
- Test: `test/unit/hub.test.ts`

**Interfaces:**
- Consumes: `createReloadBroker`, `createDebouncedReloader`, `createRunApiHandler`, `recursiveWatchSupported`, `DASHBOARD_PORT` from `src/dashboard/server.ts`; `createModelApiHandler` from `src/models/dashboard-api.ts`; `projectSlug`, `realpathKey` from `src/lib/slug.ts`.
- Produces:
  - `export interface HubProject { cwd: string; slug: string; file: string; regenerate: () => void | Promise<void> }`
  - `export interface HubHandle { server: Server; port: number; register(project: Omit<HubProject, 'slug'> & { slug?: string }): RegisterResult; close(): Promise<void> }`
  - `export type RegisterResult = { ok: true; slug: string; url: string } | { ok: false; code: 409; existingCwd: string; incomingCwd: string } | { ok: false; code: 400; message: string }`
  - `export function startHubServer(opts: { port?: number; token: string }): Promise<HubHandle>`

Routing:
- `GET /` — HTML list of `slug` links to `/p/<slug>/`
- `GET /api/hub/status?token=` — 200 `{ pid, port }` if token matches, else 401
- `POST /api/hub/register` JSON `{ cwd, token }` — 401 wrong token; else `register({ cwd })`
- `GET /p/<slug>` → 302 `/p/<slug>/`
- `GET /p/<slug>/` and `/p/<slug>/index.html` — that project's HTML file
- Any `/p/<slug>/api/...` — strip `/p/<slug>` and dispatch to that project's run/SSE/model handlers (so `createRunApiHandler` still sees `/api/run`)
- Unknown slug → 404
- Listen `127.0.0.1` only. Port `0` allowed in tests.

Collision: same slug, different `realpathKey` → 409. Same slug, same key → 200 refresh.

Relative URLs in `src/templates/dashboard.html`:
- `fetch('/api/run'` → `fetch('api/run'`
- `new EventSource('/api/events')` → `new EventSource('api/events')`

- [ ] **Step 1: Write failing hub tests**

```ts
// test/unit/hub.test.ts — core cases (expand with helpers like serve.test.ts)
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startHubServer } from '../../src/dashboard/hub.js';

function req(port: number, path: string, method = 'GET', body?: string): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const r = request({ host: '127.0.0.1', port, path, method, headers: { 'content-type': 'application/json' } }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, body: b }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

describe('startHubServer', () => {
  const handles: Array<{ close(): Promise<void> }> = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const h of handles) await h.close().catch(() => {});
    handles.length = 0;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('serves HTML at /p/<slug>/ and lists it on /', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-hub-a-'));
    dirs.push(cwd);
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), 'project_name: Alpha\n');
    const file = join(cwd, 'dash.html');
    writeFileSync(file, '<html>alpha</html>');
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    const reg = hub.register({ cwd, file, regenerate: () => {} });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    const page = await req(hub.port, `/p/${reg.slug}/`);
    expect(page.status).toBe(200);
    expect(page.body).toContain('alpha');
    const index = await req(hub.port, '/');
    expect(index.body).toContain(`/p/${reg.slug}/`);
  });

  it('returns 409 on slug collision with a different cwd', async () => {
    const a = mkdtempSync(join(tmpdir(), 'sbl-hub-a-'));
    const b = mkdtempSync(join(tmpdir(), 'sbl-hub-b-'));
    dirs.push(a, b);
    for (const d of [a, b]) {
      mkdirSync(join(d, 'backlog'));
      writeFileSync(join(d, 'backlog', 'config.yml'), 'project_name: Same\n');
    }
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    hub.register({ cwd: a, file: join(a, 'x.html'), regenerate: () => {} });
    writeFileSync(join(a, 'x.html'), 'a');
    const second = hub.register({ cwd: b, file: join(b, 'x.html'), regenerate: () => {} });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe(409);
  });

  it('rejects status and register without the token', async () => {
    const hub = await startHubServer({ port: 0, token: 'secret' });
    handles.push(hub);
    expect((await req(hub.port, '/api/hub/status')).status).toBe(401);
    expect((await req(hub.port, '/api/hub/register', 'POST', JSON.stringify({ cwd: process.cwd(), token: 'nope' }))).status).toBe(401);
  });
});
```

Also add a test that `POST /api/hub/register` with the correct token and a second distinct `project_name` returns 200 and that `GET /p/slug-b/` is 200.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/hub.test.ts`

Expected: FAIL `startHubServer` not defined.

- [ ] **Step 3: Implement hub + relative template URLs**

`src/dashboard/hub.ts`: one `Map<slug, { cwd, realpath, file, broker, reloader, watcher, runApi }>`. `register` computes slug via `projectSlug(cwd)`; 400 on empty slug. Watch `join(cwd, 'backlog')` with the same `recursiveWatchSupported` guard and warning as `startServeServer`. On `close()`, cancel reloaders, close brokers/watchers, `server.close()`.

Strip prefix: if `url` matches `^/p/([^/]+)(/.*)?$`, look up slug, rewrite `req.url` to `rest || '/'` for API, serve file when rest is `/` or `/index.html`.

Update `src/templates/dashboard.html` relative fetches.

Update `test/unit/dashboard-render.test.ts`:
- `new EventSource('api/events')`
- `fetch('api/run'`
- Assert rendered HTML does **not** contain `EventSource('/api/events')` or `fetch('/api/run'`.

Update `test/integration/serve.test.ts`: either point it at `startHubServer` + `/p/serve-demo/` or keep `startServeServer` as a wrapper that starts a hub, registers `cwd`, and still serves the project at `/p/<slug>/`. Do not leave tests fetching `/` expecting dashboard HTML (`/` is now the index). Watcher-skip on win32 Node 24 unchanged.

If `startServeServer` remains, it must register the project on a hub and not serve dashboard HTML at `/`. Prefer deleting the old listen loop and routing all production traffic through `startHubServer`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/hub.test.ts test/unit/dashboard-render.test.ts test/integration/serve.test.ts test/unit/server-reload.test.ts test/unit/run-api.test.ts`

Expected: PASS (`run-api` still uses raw `/api/run` on `createRunApiHandler` directly).

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/hub.ts src/dashboard/server.ts src/templates/dashboard.html test/unit/hub.test.ts test/unit/dashboard-render.test.ts test/integration/serve.test.ts
git commit -m "feat(hub): multi-project server at /p/<slug>/"
```

---

### Task 5: `sbl dashboard` become-hub vs attach

**Files:**
- Modify: `src/commands/dashboard.ts`
- Modify: `test/unit/dashboard-command.test.ts`
- Test: `test/integration/dashboard-attach.test.ts`
- Modify: `README.md` (dashboard paragraph: hub URL shape, no Backlog-browser spawn, no `sbl serve` alias)

**Interfaces:**
- Consumes: `projectSlug` (`src/lib/slug.ts`); `readHubState`, `writeHubState`, `clearHubState`, `isPidAlive`, `newHubToken`, `hubStatePath` (`src/lib/hub-state.ts`); `startHubServer` (`src/dashboard/hub.ts`); `collectDashboardData` / `renderDashboard` / `atomicWrite` / `KIT_VERSION` as today.
- Produces: `runDashboard(cwd, args)` still `Promise<number>`.
  - Empty slug → stderr `error: set project_name in backlog/config.yml` (or equivalent), return `1`.
  - Attach: `GET /api/hub/status?token=` 200 and pid alive → `POST /api/hub/register` → open `url` unless `--no-open` → return `0` without listening.
  - Stale state (dead pid): become hub.
  - Foreign process on port: return `1`, do not scan for another port. `--port` writes that port into `hub.json` and warns on stderr that default bookmarks (`:6428`) will miss this hub.
  - Become hub: `writeHubState(homedir(), { pid: process.pid, port, token })`, `register({ cwd, file: tempHtml, regenerate })`, open `/p/<slug>/` unless `--no-open`, block on the server, `clearHubState` in `finally` if pid matches.
  - Do **not** call `resolveBacklogBin` or `spawn` for `backlog browser`.

Home directory: `os.homedir()`. Tests inject via optional 3rd argument:

```ts
export interface DashboardDeps {
  homedir?: () => string;
  startHub?: typeof startHubServer;
  attach?: (url: string, body: unknown) => Promise<{ status: number; json: unknown }>;
  openBrowser?: (url: string) => void;
  nowPid?: () => number;
}
export async function runDashboard(cwd: string, args: ParsedArgs, deps?: DashboardDeps): Promise<number>
```

If adding `deps` is too invasive, integration tests can set `os.homedir` by writing state under a mocked home — prefer the `deps` object; it matches `runInit`.

- [ ] **Step 1: Write failing tests**

`test/unit/dashboard-command.test.ts`:
- Remove tests that expect `spawn(..., ['browser', ...])` and the “backlog CLI not found” warning.
- Add: `runDashboard` does not call `cross-spawn` for backlog.
- Mock hub: first call starts hub (inject `startHub` that records `register`).

`test/integration/dashboard-attach.test.ts`:
1. Start a real hub via `startHubServer({ port: 0, token })`, write `hub.json` under a temp home with `process.pid` and that port.
2. `runDashboard(secondCwd, { values: { 'no-open': true }, positionals: [] }, { homedir: () => tempHome })` returns `0` and does not bind another port.
3. `GET /p/<slug-b>/` on the first hub is 200.
4. Collision: two dirs with `project_name: Same` → second `runDashboard` returns `1` and stderr contains both paths.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/dashboard-command.test.ts test/integration/dashboard-attach.test.ts`

Expected: FAIL (browser still spawned and/or attach not implemented).

- [ ] **Step 3: Implement `runDashboard`**

Temp HTML path stays `join(tmpdir(), \`sbl-dashboard-${Date.now()}-${slug}.html\`)`. `regenerate` writes that file via `collectDashboardData` + `renderDashboard` + `atomicWrite` (same as today).

Port parsing stays (invalid → 1). Default `DASHBOARD_PORT`.

Listen errors (EADDRINUSE) → `error: port 6428 is in use` and hint `--port` as emergency only.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/dashboard-command.test.ts test/integration/dashboard-attach.test.ts test/unit/hub.test.ts`

Expected: PASS.

README dashboard section: bookmark form `http://127.0.0.1:6428/p/<project_name>/`; second repo attaches to the same hub; Ctrl+C in the hub terminal stops all; no sentence about launching Backlog browser.

- [ ] **Step 5: Commit**

```bash
git add src/commands/dashboard.ts test/unit/dashboard-command.test.ts test/integration/dashboard-attach.test.ts README.md
git commit -m "feat(dashboard): attach to hub or become hub"
```

---

### Task 6: Version hint

**Files:**
- Create: `src/lib/version-check.ts`
- Test: `test/unit/version-check.test.ts`
- Modify: `src/cli.ts` (`runCli` calls hint except help/version)

**Interfaces:**
- Consumes: `KIT_VERSION` from `src/lib/version.ts`; `runCapture` only inside the default `fetchLatest`, not in tests.
- Produces:
  - `export interface VersionCheckCache { checkedAt: string; latest: string }`
  - `export interface VersionCheckDeps { home: string; now: () => Date; fetchLatest: () => Promise<string | null>; log: (line: string) => void; env: NodeJS.ProcessEnv }`
  - `export function applyVersionHint(installed: string, deps: VersionCheckDeps): Promise<void>`
  - Cache path: `join(home, '.super-backlog', 'version-check.json')`
  - Hint line exactly: `super-backlog <latest> is available (installed <installed>). Update: npm i -g super-backlog`

Behaviour (spec §7):
1. If `deps.env.SBL_SKIP_UPDATE_CHECK` is non-empty, return immediately.
2. If cache exists and `latest` is a greater triple-numeric semver than `installed`, `log` the hint **before** returning.
3. If cache missing or `checkedAt` older than 24h, do not await a long fetch: fire `fetchLatest` without blocking `runCli` (void promise). On success write cache. Do **not** log from that background write.
4. Fetch/parse errors: keep old cache, log nothing.

`runCli`: first line after resolving the command, unless argv is help/version/no-command. Pass `env: { ...process.env, SBL_SKIP_UPDATE_CHECK: process.env.SBL_SKIP_UPDATE_CHECK }` and default `fetchLatest` that runs `npm.cmd`/`npm` `view super-backlog version` with 2s — implement timeout by racing `fetchLatest` internally. Tests never call real npm.

Default `fetchLatest` is only used in production `runCli`; unit tests always inject a stub.

Semver compare: split on `.`, compare three `Number` parts; non-numeric → treat as not-newer (no hint).

- [ ] **Step 1: Write failing tests**

```ts
// test/unit/version-check.test.ts
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyVersionHint } from '../../src/lib/version-check.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function homeWithCache(latest: string, checkedAt: string): string {
  const home = mkdtempSync(join(tmpdir(), 'sbl-vc-'));
  dirs.push(home);
  mkdirSync(join(home, '.super-backlog'));
  writeFileSync(join(home, '.super-backlog', 'version-check.json'), JSON.stringify({ latest, checkedAt }));
  return home;
}

describe('applyVersionHint', () => {
  it('prints when cache latest is newer and does not fetch', async () => {
    const logs: string[] = [];
    const fetchLatest = vi.fn(async () => '9.9.9');
    await applyVersionHint('1.0.3', {
      home: homeWithCache('1.0.4', new Date().toISOString()),
      now: () => new Date(),
      fetchLatest,
      log: (l) => logs.push(l),
      env: {},
    });
    expect(logs[0]).toContain('1.0.4');
    expect(logs[0]).toContain('npm i -g super-backlog');
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it('skips when SBL_SKIP_UPDATE_CHECK is set', async () => {
    const logs: string[] = [];
    const fetchLatest = vi.fn(async () => '9.9.9');
    await applyVersionHint('1.0.3', {
      home: homeWithCache('1.0.4', new Date().toISOString()),
      now: () => new Date(),
      fetchLatest,
      log: (l) => logs.push(l),
      env: { SBL_SKIP_UPDATE_CHECK: '1' },
    });
    expect(logs).toEqual([]);
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it('does not log on a failed fetch and leaves exit path clean', async () => {
    const home = mkdtempSync(join(tmpdir(), 'sbl-vc-'));
    dirs.push(home);
    const logs: string[] = [];
    await applyVersionHint('1.0.3', {
      home,
      now: () => new Date(),
      fetchLatest: async () => null,
      log: (l) => logs.push(l),
      env: {},
    });
    expect(logs).toEqual([]);
  });
});
```

Add a `runCli` test in `test/unit/cli-contract.test.ts`: `--version` and `help` do not print `npm i -g super-backlog` even if a temp cache would (set `SBL_SKIP_UPDATE_CHECK` in those tests **or** assert help/version skip the hint function). Easiest: `runCli(['--version'])` with env skip unset still must not contain the hint (no cache in default homedir — flaky). So: stub is inside `applyVersionHint` only; `runCli(['--version'])` must not call fetch. Implement skip by command name before `applyVersionHint`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/version-check.test.ts`

Expected: FAIL module not found.

- [ ] **Step 3: Implement module and wire `runCli`**

`applyVersionHint` is `async` but the stale-cache refresh is `void fetchLatest().then(writeCache)` with no `await` on that promise (and no `log` in the `then`). The function may still `await` nothing and return immediately after scheduling.

`runCli`: if first arg is `help` | `--help` | `-h` | `--version` | `-v` | `undefined`, skip hint. Else `void applyVersionHint(KIT_VERSION, defaultDeps)` — **do not await** so commands stay fast. Tests of `applyVersionHint` await it directly.

Default `log` = `(line) => console.error(line)`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/version-check.test.ts test/unit/cli-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/version-check.ts src/cli.ts test/unit/version-check.test.ts test/unit/cli-contract.test.ts
git commit -m "feat(cli): daily npm version hint from cache"
```

---

### Task 7: Command smokes and leftover docs

**Files:**
- Test: `test/unit/command-smoke.test.ts`
- Modify: any remaining user-facing `sbl dashboard --serve` in `docs/guide/` (not historical specs)
- Modify: `.opencode/skill/backlog-status-report/SKILL.md` and `.claude/skills/backlog-status-report/SKILL.md` only if tests or `copy-skills` do not regenerate them — the source of truth is `src/templates/skill-backlog-status-report.md` (Task 1). Do not edit Backlog task markdown.

**Interfaces:**
- Consumes: `runInit`, `runDoctor`, `runModels`, `runUpdate`, `runCli`.
- Produces: smokes that assert no throw and known exit codes. Set `SBL_SKIP_UPDATE_CHECK=1` in these tests via `process.env` in `beforeEach` / restore after.

- [ ] **Step 1: Write failing smokes if anything still crashes**

```ts
// test/unit/command-smoke.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInit } from '../../src/commands/init.js';
import { runDoctor } from '../../src/commands/doctor.js';
import { runModels } from '../../src/commands/models.js';
import { runUpdate } from '../../src/commands/update.js';

const dirs: string[] = [];
beforeEach(() => {
  process.env.SBL_SKIP_UPDATE_CHECK = '1';
});
afterEach(() => {
  delete process.env.SBL_SKIP_UPDATE_CHECK;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('command smoke', () => {
  it('init --dry-run exits 0 or 4', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-smoke-'));
    dirs.push(cwd);
    const code = await runInit(cwd, { values: { 'dry-run': true, pm: 'skip' }, positionals: [] });
    expect([0, 4]).toContain(code);
  });

  it('doctor exits 0 or 4', () => {
    const code = runDoctor(process.cwd());
    expect([0, 4]).toContain(code);
  });

  it('models show does not throw', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-smoke-'));
    dirs.push(cwd);
    const code = await runModels(cwd, { values: {}, positionals: ['show'] });
    expect(typeof code).toBe('number');
  });

  it('update on an empty dir does not throw', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-smoke-'));
    dirs.push(cwd);
    const code = await runUpdate(cwd, { values: {}, positionals: [] });
    expect(typeof code).toBe('number');
  });
});
```

If these already pass against current code, keep them as regression nets.

- [ ] **Step 2: Run smokes**

Run: `npx vitest run test/unit/command-smoke.test.ts`

Expected: PASS (or fix only crashes; do not change init/update/doctor semantics).

- [ ] **Step 3: Full suite + lint**

Run: `npm test` then `npm run lint`

Expected: all tests pass (win32 Node 24 watcher skips remain). `markdownlint` / `cspell` clean. Add words to `cspell.json` only if the new stderr strings fail cspell.

Grep the repo (excluding `backlog/`, `CHANGELOG.md`, `docs/superpowers/`) for `sbl dashboard --serve` and `sbl serve` as user-facing instructions; fix stragglers in `docs/guide/` and shipped templates.

- [ ] **Step 4: Commit**

```bash
git add test/unit/command-smoke.test.ts docs/guide src/templates cspell.json
git commit -m "test(cli): smoke remaining commands; finish --serve doc sweep"
```

---

## Self-review (spec coverage)

| Spec | Task |
|---|---|
| D1 viewing command / no `--serve` / no `--no-watch` | 1 |
| D2 removed commands exit 1 | 1 |
| D3 first process is hub, later attach | 5 |
| D4 URL `/p/<slug>/`, `GET /` index | 4 |
| D5 slug from `project_name`, collision 409 | 2, 4, 5 |
| D6 Ctrl+C clears hub.json | 5 (`clearHubState` in finally) |
| D7 port 6428, no auto-increment, `--port` warning | 5 |
| D8 no browser spawn | 5 |
| D9 version hint cache 24h, no install | 6 |
| D10 init/update unchanged | 7 (smoke only) |
| Relative `api/` URLs | 4 |
| CLI contract tests | 1 |
| Hub tests (attach, collision, stale pid, SSE isolation) | 4, 5 — **SSE isolation:** add in Task 4 if not already: two projects, trigger regenerate on A, B's broker `clientCount`/broadcast must not receive A's reload. Implement by spying `broadcast` or connecting two EventSources. |
| Docs / skill template | 1, 5, 7 |
| Out of scope wizard / protocol / auto npm i | not scheduled |

SSE isolation explicit test to add in Task 4 if the sample `hub.test.ts` block is not enough: register A and B, subscribe to `/p/b/api/events`, call A's regenerate/reloader, expect no `event: reload` on B within 400ms.

No placeholders left. Types: `RegisterResult`, `HubState`, `SlugResult`, `DashboardDeps`, `VersionCheckDeps` used consistently across tasks.
