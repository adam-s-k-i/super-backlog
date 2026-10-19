# Fewer Interruptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the project profile, bind the managed block to the three pipeline gates only, fix the blank embedded Backlog browser, bump dependencies and release 1.10.3.

**Architecture:** Templates in `src/templates/` are the source of the managed block, the pointer and the glue skills; `sbl update --no-self` re-renders them into this repo. The hub (`src/dashboard/hub.ts`) proxies the per-project `backlog browser` process by a routing cookie; the fix serves the proxied SPA at the hub root so its history router matches, and adds a WebSocket upgrade proxy.

**Tech Stack:** TypeScript (Node 20+), vitest, release-please.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-19-fewer-interruptions-design.md` — block wording is taken verbatim from its section 2.
- Never hand-edit `AGENTS.md`, `CLAUDE.md` or `.claude/skills/*` in this repo; run `node dist/bin.js update --no-self` after `npm run build`.
- Never commit EOL-only changes under `test/unit/__snapshots__/`; restore them with `git checkout -- test/unit/__snapshots__/`.
- Commits use `fix:`, `docs:` or `chore:`; the PR body carries `Release-As: 1.10.3`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Backlog tasks: TASK-121 (Task 1), TASK-122 (Task 2), TASK-123 (Task 3), TASK-126 (Task 4), TASK-124 (Task 5), TASK-125 (Tasks 6–7).

---

### Task 1: Remove the project profile from CLI, router and templates

**Files:**
- Delete: `src/templates/skill-project-profile.md`, `src/lib/critical-areas.ts`, `test/unit/critical-areas.test.ts`, `backlog/docs/critical-areas.md`
- Modify: `src/init/execute.ts:166`, `src/commands/init.ts:39-41,204`, `src/commands/doctor.ts` (import, `DoctorDeps.readCriticalAreas`, check 6 at 194–212), `src/models/agents.ts:24`, `src/templates/claude-pointer.md`
- Test: `test/unit/glue-skills.test.ts`, `test/integration/init-preflight.test.ts`, `test/unit/doctor.test.ts`, `test/e2e/doctor.e2e.test.ts`, `test/unit/models/agents.test.ts`, `test/unit/templates.test.ts`

**Interfaces:**
- Produces: `GLUE_SKILLS` without `project-profile`; `DoctorDeps` without `readCriticalAreas`; `INIT_PROFILE_HINT` no longer exists.

- [ ] **Step 1: Update the tests first**
  - `glue-skills.test.ts`: delete the whole `describe('skill-project-profile.md')` block.
  - `init-preflight.test.ts`: remove the `INIT_PROFILE_HINT` import and the two profile-hint cases; the remaining hint case asserts that the last output line equals `INIT_SUMMARY_HINT`; drop every `not.toContain(INIT_PROFILE_HINT)`.
  - `doctor.test.ts` / `doctor.e2e.test.ts`: delete the profile cases (stamped profile passes, provisional profile warns with exit 4, no Status line, and the `[skip] … not present` expectation) and every `readCriticalAreas` seam.
  - `agents.test.ts:62`: the Top description becomes `'description: Top tier — analysis, design, architecture and every decision where a mistake is costly.'`.
  - `templates.test.ts:126-128`: the pointer test asserts `expect(p).not.toContain('critical-areas.md')` and keeps the other two expectations.
- [ ] **Step 2: Run the five test files** — expected: FAIL (pointer still mentions the profile, Top description unchanged, doctor still prints check 6).

  ```bash
  npx vitest run test/unit/glue-skills.test.ts test/integration/init-preflight.test.ts test/unit/doctor.test.ts test/unit/models/agents.test.ts test/unit/templates.test.ts
  ```
- [ ] **Step 3: Remove the code**
  - Delete the four files listed above.
  - `execute.ts`: `const GLUE_SKILLS = ['spec-to-backlog', 'backlog-status-report', 'task-review-gate', 'architecture-summary'] as const;`
  - `init.ts`: delete the `CRITICAL_AREAS_PATH` import, the `INIT_PROFILE_HINT` constant with its comment, and the `console.log(INIT_PROFILE_HINT)` line.
  - `doctor.ts`: delete the `critical-areas` import, the `readCriticalAreas` seam in `DoctorDeps`, and the whole check 6 section.
  - `agents.ts:24`: `top: 'analysis, design, architecture and every decision where a mistake is costly.',`
  - `claude-pointer.md`: the last sentence becomes "Distribute subagent work by the block's "Model tiers and delegation" section and always pass the Agent tool's `model` explicitly." (keep the 80-column wrap).
- [ ] **Step 4: Run the same five test files** — expected: PASS.
- [ ] **Step 5: Commit** — `fix(profile): remove the project profile, its skill, doctor check and init hint`

### Task 2: Block wording — only the three gates interrupt

**Files:**
- Modify: `src/templates/workflow-block.md:30-32,36-39,49-51,58-61,72-77`
- Test: `test/unit/templates.test.ts:39-91`

- [ ] **Step 1: Rewrite the tests**
  - Rule 6 expectation becomes `6. Delegate by tier — when you delegate, the subtask goes to the cheapest model that solves it reliably (see "Model tiers and delegation" below).`
  - Rule 7 expectation becomes ``7. Keep the project summary current — if `backlog/docs/architecture.yml` is missing or `sbl summary --check` reports drift after a merge, say so in the final report; run the architecture-summary skill only when the user asks for it.``
  - Rule 8 test:

    ```ts
    it('binds rule 8: human checkpoints are the three gates only', () => {
      expect(t).toContain(
        '8. Human checkpoints are the three gates (3, 5, 6) and nothing else — outside them, do not ask for confirmation, make offers or present menus; decide, act and report at the end. Stop only when you are blocked or verification fails. This overrides any skill that asks for an integration or execution choice.',
      );
      expect(t).not.toContain('critical-areas.md');
      expect(t).not.toMatch(/Independent\s+check/);
    });
    ```
  - Replace `expect(t).toMatch(/Delegate only when it pays off/)` with `expect(t).toMatch(/Default is to do the work yourself in the session\./)`; delete the `"Independent check"` and `critical-areas.md` positive expectations.
- [ ] **Step 2: `npx vitest run test/unit/templates.test.ts`** — expected: FAIL on the new texts.
- [ ] **Step 3: Edit `workflow-block.md`** exactly per spec section 2:
  - rules 6, 7, 8 as above (old rule 8 deleted);
  - delegation opening paragraph: "Goal: the best result at the lowest token cost. Default is to do the work yourself in the session. Delegate only when it pays off: the subtask is self-contained, can be briefed completely in a few sentences, and is large enough (many files or sources, much intermediate output). When you delegate, the subtask goes to the cheapest model that solves it reliably, regardless of the session model.";
  - delete the separate "Delegate only when it pays off…" paragraph;
  - Top bullet ends after "costly or hard to reverse.";
  - Quality paragraph ends after "take over yourself."
- [ ] **Step 4: `npx vitest run test/unit/templates.test.ts test/e2e/update.e2e.test.ts`** — expected: PASS.
- [ ] **Step 5: Commit** — `fix(block): bind the managed block to the three gates and delegate only when it pays off`

### Task 3: `sbl update` removes the installed project-profile skill

**Files:**
- Modify: `src/init/execute.ts:168-175` (`applyCopySkills`)
- Test: `test/e2e/update.e2e.test.ts`

**Interfaces:**
- Produces: `applyCopySkills` also deletes `.claude/skills/project-profile` and `.opencode/skill/project-profile` and prints `removed legacy <rel>` for each.

- [ ] **Step 1: Write the failing e2e test**

  ```ts
  it('removes the legacy project-profile skill directories and reports them', () => {
    freshScaffold();
    for (const rel of ['.claude/skills/project-profile', '.opencode/skill/project-profile']) {
      mkdirSync(join(dir, rel), { recursive: true });
      writeFileSync(join(dir, rel, 'SKILL.md'), '<!-- managed-by: super-backlog 1.10.2 -->\n# old\n');
    }
    const r = runUpdate(dir);
    expect(r.status).toBe(4);
    expect(r.out).toContain('removed legacy .claude/skills/project-profile');
    expect(r.out).toContain('removed legacy .opencode/skill/project-profile');
    expect(existsSync(join(dir, '.claude', 'skills', 'project-profile'))).toBe(false);
    expect(existsSync(join(dir, '.opencode', 'skill', 'project-profile'))).toBe(false);
  });
  ```
- [ ] **Step 2: `npx vitest run test/e2e/update.e2e.test.ts`** — expected: FAIL (directories still present).
- [ ] **Step 3: Implement**

  ```ts
  const LEGACY_SKILL_DIRS = ['.claude/skills/project-profile', '.opencode/skill/project-profile'] as const;

  function applyCopySkills(cwd: string, version: string): boolean {
    for (const skill of GLUE_SKILLS) { /* unchanged */ }
    for (const rel of LEGACY_SKILL_DIRS) {
      const abs = join(cwd, ...rel.split('/'));
      if (!existsSync(abs)) continue;
      rmSync(abs, { recursive: true, force: true });
      console.log(`removed legacy ${rel}`);
    }
    return true;
  }
  ```
  Import `existsSync` and `rmSync` from `node:fs` if missing.
- [ ] **Step 4: Run the e2e file** — expected: PASS.
- [ ] **Step 5: Commit** — `fix(update): remove the legacy project-profile skill from user projects`

### Task 4: Docs, README, dogfood refresh

**Files:**
- Delete: `docs/guide/project-profile.md`
- Modify: `docs/.vitepress/config.mts` (sidebar entry), `docs/guide/harness-support.md`, `docs/guide/model-router.md` (Top row), `docs/guide/quickstart.md`, `README.md:44,66`, `backlog/docs/architecture.yml` (`src/lib/critical-areas.ts` entry), plus `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`, `.opencode/skill/` via `sbl update --no-self`

- [ ] **Step 1: Edit the docs** — remove every profile sentence and link; the harness-support paragraph describes the softened rule (default is to work in the session; when delegating, pick the cheapest tier); doctor rows drop "and the `critical-areas.md` project profile"; the skills rows drop `project-profile`.
- [ ] **Step 2: `npm run build && node dist/bin.js update --no-self`** — expected: `AGENTS.md` and `CLAUDE.md` refreshed, `.claude/skills/project-profile` and `.opencode/skill/project-profile` removed.
- [ ] **Step 3: `npm run lint`** — expected: PASS.
- [ ] **Step 4: Commit** — `docs: drop the project profile guide and describe the softened delegation rule`

### Task 5: Embedded Backlog browser — serve the SPA at the hub root and proxy WebSockets

**Files:**
- Modify: `src/dashboard/hub.ts` (root handler, `bb/` branch, new `proxyUpgrade`, `server.on('upgrade')`)
- Test: `test/unit/hub-backlog-proxy.test.ts`

**Root cause (reproduced 2026-10-19):** `backlog browser` ships a React SPA with `<base href="/">` and a history router. Proxied under `/p/<slug>/bb/` it logs `No routes matched location "/p/<slug>/bb/"` and renders nothing. Its `ws://<hub>/` live-update socket is not proxied either.

**Interfaces:**
- Produces: `GET /p/<slug>/bb/` → `302 Location: /` with `Set-Cookie: sbl_bb=<slug>; Path=/; SameSite=Lax`; `GET /` with a valid `sbl_bb` cookie proxies the browser root; HTTP upgrade requests with the cookie are piped to the browser process.

- [ ] **Step 1: Change the tests**
  - The first case becomes "GET /p/<slug>/bb/ sets the routing cookie and redirects to the hub root": expect status 302, `location` `/`, cookie as before.
  - Add:

    ```ts
    it('serves the proxied browser at / once the routing cookie is set', async () => {
      const browser = await fakeBrowser('alpha-root'); browsers.push(browser);
      const hub = await startHub([browser.port]); handles.push(hub);
      const cwd = projectDir('Alpha');
      const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
      if (!reg.ok) throw new Error('register failed');
      const plain = await req(hub.port, '/');
      expect(plain.body).toContain('sbl hub');
      const proxied = await req(hub.port, '/', { headers: { cookie: `sbl_bb=${reg.slug}` } });
      expect(proxied.status).toBe(200);
      expect(proxied.body).toContain('alpha-root');
    });

    it('proxies websocket upgrades by cookie to the project browser', async () => {
      const browser = await fakeBrowser('alpha-root'); browsers.push(browser);
      browser.server.on('upgrade', (_req, socket) => {
        socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
        socket.write('hello-from-browser');
      });
      const hub = await startHub([browser.port]); handles.push(hub);
      const cwd = projectDir('Alpha');
      const reg = hub.register({ cwd, file: join(cwd, 'dash.html'), regenerate: () => {} });
      if (!reg.ok) throw new Error('register failed');
      const got = await new Promise<string>((resolve, reject) => {
        const r = request({
          host: '127.0.0.1', port: hub.port, path: '/',
          headers: { host: '127.0.0.1', cookie: `sbl_bb=${reg.slug}`, connection: 'Upgrade', upgrade: 'websocket' },
        });
        r.on('upgrade', (_res, socket) => {
          socket.once('data', (d: Buffer) => { socket.destroy(); resolve(d.toString('utf8')); });
        });
        r.on('error', reject);
        r.end();
      });
      expect(got).toBe('hello-from-browser');
    });
    ```
    Extend the file's `req` helper to accept `{ headers }` and expose `server` on the `fakeBrowser` result if not already.
- [ ] **Step 2: `npx vitest run test/unit/hub-backlog-proxy.test.ts`** — expected: FAIL (bb/ returns 200, `/` returns the hub index, the upgrade is dropped).
- [ ] **Step 3: Implement in `hub.ts`**
  - Root handler: serve the hub index only when `cookieEntry === null`; with a cookie, `/` falls through to the cookie proxy.
  - `bb/` branch, after a successful `ensure()`:

    ```ts
    res.writeHead(302, { location: '/', 'set-cookie': `sbl_bb=${slug}; Path=/; SameSite=Lax` });
    res.end();
    return;
    ```
  - New function after `proxyToOrigin`:

    ```ts
    function proxyUpgrade(origin: string, req: IncomingMessage, socket: Duplex, head: Buffer): void {
      const target = new URL(origin);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (key === 'host' || value === undefined) continue;
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
      const upstream = httpRequest({ host: target.hostname, port: target.port, method: req.method ?? 'GET', path: req.url ?? '/', headers });
      upstream.on('upgrade', (up, upSocket, upHead) => {
        const lines = [`HTTP/1.1 ${up.statusCode ?? 101} ${up.statusMessage ?? 'Switching Protocols'}`];
        for (const [key, value] of Object.entries(up.headers)) {
          if (value === undefined) continue;
          for (const v of Array.isArray(value) ? value : [value]) lines.push(`${key}: ${v}`);
        }
        socket.write(`${lines.join('\r\n')}\r\n\r\n`);
        if (upHead.length > 0) socket.write(upHead);
        if (head.length > 0) upSocket.write(head);
        upSocket.pipe(socket);
        socket.pipe(upSocket);
        upSocket.on('error', () => socket.destroy());
        socket.on('error', () => upSocket.destroy());
      });
      upstream.on('response', () => socket.destroy());
      upstream.on('error', () => socket.destroy());
      upstream.end();
    }
    ```
  - In the server factory, after `createServer`:

    ```ts
    server.on('upgrade', (req, socket, head) => {
      if (!isAllowedHost(req.headers.host)) { socket.destroy(); return; }
      const slug = cookieValue(req, 'sbl_bb');
      const entry = slug !== null ? projects.get(slug) : undefined;
      if (!entry) { socket.destroy(); return; }
      void entry.browser.ensure().then((result) => {
        if (!result.ok) { socket.destroy(); return; }
        proxyUpgrade(result.url, req, socket, head);
      });
    });
    ```
    with `import type { Duplex } from 'node:stream'`. Reuse the file's existing host-check and cookie helpers under whatever names they have.
- [ ] **Step 4: Run the test file** — expected: PASS. Then `npm run build`, restart `sbl dashboard`, open the Backlog overlay from a project page: the board renders, no `No routes matched` warning and no WebSocket error in the console.
- [ ] **Step 5: Commit** — `fix(dashboard): render the embedded Backlog browser at the hub root and proxy its websocket`

### Task 6: Dependency bumps

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install** — `npm install --save-dev backlog.md@^1.54.0 cspell@^10.4.0 vitest@^5.0.5 happy-dom@21.0.3` (caret ranges stay for the first three, happy-dom stays pinned).
- [ ] **Step 2: `npm test && npm run lint`** — expected: PASS. If happy-dom 21 breaks a dashboard test, pin happy-dom at the latest 20.x instead and say so in the commit body.
- [ ] **Step 3: `git checkout -- test/unit/__snapshots__/`** if only line endings changed.
- [ ] **Step 4: Commit** — `chore(deps): bump backlog.md, cspell, vitest and happy-dom`

### Task 7: Verify, PR, release 1.10.3

- [ ] **Step 1: `npm run build && npm test && npm run lint && npx tsc --noEmit`** — all PASS.
- [ ] **Step 2: Push `fix/fewer-interruptions`, open the PR with `--body-file`; the body ends with `Release-As: 1.10.3` and the Claude Code footer; add the `automerge` label.
- [ ] **Step 3: After the merge, release-please opens `chore(master): release 1.10.3`; merge it; confirm the tag and the npm publish; close the backlog tasks via the CLI.
