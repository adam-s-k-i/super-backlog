# Floorplan Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace super-backlog's curated architecture layer (`backlog/docs/architecture.yml`, diagram, drift check, `architecture-summary` skill) with the Floorplan plugin's map, keep a slim facts page with a Code map card, and serve the built map from the hub.

**Architecture:** One new module, `src/lib/floorplan.ts`, reads `floorplan/graph.json` and owns every wording about the map; doctor, the `sbl summary` stub, `sbl init` and the summary page consume it. The hub serves exactly one file, `<project>/floorplan/index.html`, at `/p/<slug>/map/` under a restrictive CSP. The summary page keeps its facts pipeline (`summary-facts.ts`) and loses schema, layout and drift.

**Tech Stack:** TypeScript (Node 20+), vitest, markdownlint, cspell, vitepress, release-please.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-28-floorplan-integration-design.md`. User-visible strings are taken from its decisions 2–7; the three deviations below are deliberate and already folded into the spec in this plan's commit.
- **Deviation 1 (spec corrected):** `sbl dashboard` has no `--out` export. The Code map card always renders the **Open map** link in the `map` state.
- **Deviation 2 (spec extended):** the hub regenerates the project pages before serving `/summary/` when `floorplan/graph.json` changed since the last check, so a first or rebuilt map shows up on the next page load (TASK-130 AC #5).
- **Deviation 3 (wording):** counts are pluralized (`1 file` / `2 files`, `1 part` / `2 parts`, `1 commit` / `2 commits`); dates are the UTC day `YYYY-MM-DD`.
- One branch (`feat/floorplan-integration`), one PR, one commit per task below. A `feat` commit reaching `master` releases 1.11.0 through release-please: the PR is merged only after the user approved the release.
- `sbl` never installs, starts or talks to Floorplan; it never creates, edits or deletes anything under `floorplan/`. It never deletes a user project's `backlog/docs/architecture.yml`.
- No request input becomes part of a file path in the hub's map route.
- Never hand-edit `AGENTS.md`, `CLAUDE.md` or `.claude/skills/*` in this repo; run `node dist/bin.js update --no-self` after `npm run build` (Task 6 only).
- Never hand-edit backlog task files; use `npx backlog` and `node dist/bin.js phase <id> <phase>`.
- Never commit EOL-only changes under `test/unit/__snapshots__/`; restore them with `git checkout -- test/unit/__snapshots__/`.
- Do not commit `.claude/launch.json`, `.playwright-mcp/`, `design-demos/` or `floorplan/` (self-ignored).
- When running Floorplan scripts, keep `FLOORPLAN_NO_PROMPTS=1` set; never sign up for its waitlist.
- Commit trailer: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Task order keeps every commit green: Task 1 (TASK-127) → Task 2 (TASK-128) → Task 3 (TASK-131) → Task 4 (TASK-130) → Task 5 (TASK-129) → Task 6 (TASK-132). TASK-131 comes before TASK-129 because `src/commands/init.ts` imports from `summary-schema.ts`, which TASK-129 deletes.
- Full verification after every task: `npm run build && npm test && npx tsc --noEmit`; `npm run lint` and `npx vitepress build docs` in addition after Task 6.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/lib/floorplan.ts` | create | Constants, `readFloorplanStatus`, `floorplanStatusLine`, `floorplanBuiltDate`, `floorplanPagePath`, `floorplanStamp` |
| `src/commands/doctor.ts` | modify | Check 5 reads the map status; legacy-file notice |
| `src/commands/summary.ts` | rewrite | Deprecation stub |
| `src/cli.ts` | modify | Help text, `summary` accepts any arguments |
| `src/commands/init.ts` | modify | `INIT_FLOORPLAN_HINT` replaces `INIT_SUMMARY_HINT` |
| `src/init/execute.ts` | modify | Three glue skills; legacy `architecture-summary` dirs removed on update |
| `src/templates/workflow-block.md` | modify | Rule 7 |
| `src/templates/skill-architecture-summary.md` | delete | |
| `src/dashboard/hub.ts` | modify | `/map` routes, CSP header, map-change refresh |
| `src/dashboard/summary-render.ts` | rewrite | Facts model, Code map card, facts-only view |
| `src/templates/summary.html` | modify | Diagram markup, CSS and client code removed; card styles added |
| `src/dashboard/summary-{schema,layout,drift}.ts` | delete | |
| `docs/guide/project-summary.md`, `README.md`, `docs/guide/quickstart.md`, `docs/guide/harness-support.md` | modify | Docs |
| `cspell.json` | modify | Spell-check word `haydenschmitty` |
| `docs/assets/project-summary.png` | replace | Screenshot of the new page |
| `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`, `.opencode/skill/` | regenerate | `node dist/bin.js update --no-self` |
| `backlog/docs/architecture.yml` | delete | Dogfood |

---

### Task 1 (TASK-127): Map status reader and doctor check 5

**Files:**

- Create: `src/lib/floorplan.ts`, `test/unit/floorplan.test.ts`
- Modify: `src/commands/doctor.ts:4-6,25-30,139-189`
- Test: `test/unit/doctor.test.ts` (imports, `makeDeps`, `describe('check 5: …')` from line 170 to the end), `test/e2e/doctor.e2e.test.ts`

**Interfaces:**

- Consumes: `runCapture(cmd, args, cwd): RunResult` and `RunResult { status, stdout, stderr, errorCode? }` from `src/lib/run.ts`.
- Produces (used by Tasks 2–5):

  ```ts
  export const FLOORPLAN_DIR = 'floorplan';
  export const FLOORPLAN_REPO_URL = 'https://github.com/haydenschmitty/floorplan';
  export const FLOORPLAN_INSTALL_COMMANDS: readonly [string, string];
  export const LEGACY_ARCHITECTURE_PATH = 'backlog/docs/architecture.yml';
  export type FloorplanStatus =
    | { state: 'missing' }
    | { state: 'invalid'; reason: string }
    | { state: 'map'; builtAt: string; files: number; nodes: number; commitsSince: number | null };
  export interface FloorplanDeps { runCapture?: (cmd: string, args: string[], cwd: string) => RunResult }
  export function readFloorplanStatus(cwd: string, deps?: FloorplanDeps): FloorplanStatus;
  export function floorplanStatusLine(status: FloorplanStatus): string;
  export function floorplanBuiltDate(builtAt: string): string; // 'YYYY-MM-DD' (UTC)
  export function floorplanPagePath(cwd: string): string;      // <cwd>/floorplan/index.html
  export function floorplanStamp(cwd: string): number;          // mtimeMs of graph.json, 0 when absent
  ```

  `DoctorDeps` loses `loadArchitecture`, `layoutArchitecture`, `detectDrift` and gains `readFloorplanStatus?: (cwd: string) => FloorplanStatus` and `legacyArchitectureExists?: (cwd: string) => boolean`.

- [ ] **Step 1: Write the failing unit test** — `test/unit/floorplan.test.ts`:

  ```ts
  // test/unit/floorplan.test.ts
  import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';
  import { afterEach, describe, expect, it } from 'vitest';

  import {
    FLOORPLAN_INSTALL_COMMANDS,
    floorplanBuiltDate,
    floorplanPagePath,
    floorplanStamp,
    floorplanStatusLine,
    readFloorplanStatus,
    type FloorplanStatus,
  } from '../../src/lib/floorplan.js';
  import type { RunResult } from '../../src/lib/run.js';

  const HEAD = '8204637bd25234d5a7f599812806882eeb0a049c';
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function project(graph: unknown | string | null, withPage = true): string {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-floorplan-'));
    dirs.push(cwd);
    if (graph === null && !withPage) return cwd;
    mkdirSync(join(cwd, 'floorplan'));
    if (graph !== null) {
      writeFileSync(join(cwd, 'floorplan', 'graph.json'), typeof graph === 'string' ? graph : JSON.stringify(graph));
    }
    if (withPage) writeFileSync(join(cwd, 'floorplan', 'index.html'), '<!doctype html><title>map</title>');
    return cwd;
  }

  function graph(meta: Record<string, unknown> = {}, nodes: unknown = [{}, {}, {}]): Record<string, unknown> {
    return {
      schema: 1,
      meta: {
        generatedAt: '2026-11-28T13:46:30.507Z',
        counts: { files: 165, loc: 25741 },
        repos: [{ path: '.', name: 'demo', head: HEAD }],
        ...meta,
      },
      nodes,
    };
  }

  const git = (stdout: string, status = 0) => {
    const calls: string[][] = [];
    const runCapture = (cmd: string, args: string[]): RunResult => {
      calls.push([cmd, ...args]);
      return { status, stdout, stderr: '' };
    };
    return { calls, runCapture };
  };

  describe('readFloorplanStatus', () => {
    it('is missing without a floorplan directory', () => {
      expect(readFloorplanStatus(project(null, false))).toEqual({ state: 'missing' });
    });

    it('is missing when graph.json or index.html is absent', () => {
      expect(readFloorplanStatus(project(null, true))).toEqual({ state: 'missing' });
      expect(readFloorplanStatus(project(graph(), false))).toEqual({ state: 'missing' });
    });

    it('reads build date, file count, part count and commits since the mapped head', () => {
      const g = git('2\n');
      expect(readFloorplanStatus(project(graph()), g)).toEqual({
        state: 'map',
        builtAt: '2026-11-28T13:46:30.507Z',
        files: 165,
        nodes: 3,
        commitsSince: 2,
      });
      expect(g.calls).toEqual([['git', 'rev-list', '--count', `${HEAD}..HEAD`]]);
    });

    it('falls back to 0 files and 0 parts when the counts are absent or malformed', () => {
      const status = readFloorplanStatus(project(graph({ counts: { files: 'many' } }, 'nope')), git('0\n'));
      expect(status).toMatchObject({ state: 'map', files: 0, nodes: 0, commitsSince: 0 });
    });

    it.each([
      ['no repos entry', { repos: undefined }],
      ['no entry with path "."', { repos: [{ path: 'packages/a', head: HEAD }] }],
      ['a short head', { repos: [{ path: '.', head: '8204637' }] }],
      ['a head that looks like an option', { repos: [{ path: '.', head: '--output=/tmp/x'.padEnd(40, 'a') }] }],
      ['a non-string head', { repos: [{ path: '.', head: 42 }] }],
    ])('never calls git with %s', (_name, meta) => {
      const g = git('5\n');
      expect(readFloorplanStatus(project(graph(meta)), g)).toMatchObject({ state: 'map', commitsSince: null });
      expect(g.calls).toEqual([]);
    });

    it('has commitsSince null when git fails, prints garbage or throws', () => {
      expect(readFloorplanStatus(project(graph()), git('', 128))).toMatchObject({ commitsSince: null });
      expect(readFloorplanStatus(project(graph()), git('abc\n'))).toMatchObject({ commitsSince: null });
      const throwing = { runCapture: (): RunResult => { throw new Error('spawn failed'); } };
      expect(readFloorplanStatus(project(graph()), throwing)).toMatchObject({ state: 'map', commitsSince: null });
    });

    it('is invalid for broken JSON, a non-object, or a missing or unparsable build date', () => {
      expect(readFloorplanStatus(project('{ not json'))).toEqual({ state: 'invalid', reason: 'not valid JSON' });
      expect(readFloorplanStatus(project('[]'))).toEqual({ state: 'invalid', reason: 'no build date (meta.generatedAt)' });
      expect(readFloorplanStatus(project(graph({ generatedAt: 'yesterday' })))).toEqual({
        state: 'invalid',
        reason: 'no build date (meta.generatedAt)',
      });
      expect(readFloorplanStatus(project(graph({ generatedAt: 1764337590507 })))).toMatchObject({ state: 'invalid' });
    });

    it('is invalid for a graph.json above 10 MB and does not parse it', () => {
      const cwd = project('x'.repeat(10 * 1024 * 1024 + 1));
      expect(readFloorplanStatus(cwd)).toEqual({ state: 'invalid', reason: 'graph.json is larger than 10 MB' });
    });

    it('never throws when graph.json is a directory', () => {
      const cwd = project(null, true);
      mkdirSync(join(cwd, 'floorplan', 'graph.json'));
      expect(readFloorplanStatus(cwd).state).toBe('invalid');
    });
  });

  describe('floorplanStatusLine', () => {
    const map = (over: Partial<Extract<FloorplanStatus, { state: 'map' }>> = {}): FloorplanStatus => ({
      state: 'map',
      builtAt: '2026-11-28T13:46:30.507Z',
      files: 165,
      nodes: 11,
      commitsSince: 0,
      ...over,
    });

    it('covers every row of the check 5 table', () => {
      expect(floorplanStatusLine({ state: 'missing' })).toBe(
        'no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)',
      );
      expect(floorplanStatusLine({ state: 'invalid', reason: 'not valid JSON' })).toBe(
        'floorplan/graph.json unreadable (not valid JSON)',
      );
      expect(floorplanStatusLine(map())).toBe('floorplan map current (built 2026-11-28, 165 files, 11 parts)');
      expect(floorplanStatusLine(map({ commitsSince: 3 }))).toBe(
        'floorplan map built 2026-11-28, 3 commits behind HEAD (165 files, 11 parts)',
      );
      expect(floorplanStatusLine(map({ commitsSince: null }))).toBe('floorplan map built 2026-11-28 (165 files, 11 parts)');
    });

    it('uses singular nouns for counts of one', () => {
      expect(floorplanStatusLine(map({ files: 1, nodes: 1, commitsSince: 1 }))).toBe(
        'floorplan map built 2026-11-28, 1 commit behind HEAD (1 file, 1 part)',
      );
    });
  });

  describe('helpers', () => {
    it('floorplanBuiltDate is the UTC day', () => {
      expect(floorplanBuiltDate('2026-11-28T23:59:59.000-05:00')).toBe('2026-11-29');
    });

    it('floorplanPagePath points at floorplan/index.html', () => {
      expect(floorplanPagePath(join('a', 'b'))).toBe(join('a', 'b', 'floorplan', 'index.html'));
    });

    it('floorplanStamp is 0 without a map and the graph mtime with one', () => {
      expect(floorplanStamp(project(null, false))).toBe(0);
      expect(floorplanStamp(project(graph()))).toBeGreaterThan(0);
    });

    it('lists the two install commands', () => {
      expect(FLOORPLAN_INSTALL_COMMANDS).toEqual([
        'claude plugin marketplace add haydenschmitty/floorplan',
        'claude plugin install floorplan@floorplan',
      ]);
    });
  });
  ```

- [ ] **Step 2: Run it** — `npx vitest run test/unit/floorplan.test.ts` — expected: FAIL (module `src/lib/floorplan.js` not found).

- [ ] **Step 3: Implement `src/lib/floorplan.ts`**

  ```ts
  // src/lib/floorplan.ts
  // Reads the map the Floorplan plugin (https://github.com/haydenschmitty/floorplan)
  // writes to <project>/floorplan/. Read-only: sbl never creates or changes that folder.
  import { existsSync, readFileSync, statSync } from 'node:fs';
  import { join } from 'node:path';

  import { runCapture as defaultRunCapture, type RunResult } from './run.js';

  export const FLOORPLAN_DIR = 'floorplan';
  export const FLOORPLAN_REPO_URL = 'https://github.com/haydenschmitty/floorplan';
  export const FLOORPLAN_INSTALL_COMMANDS = [
    'claude plugin marketplace add haydenschmitty/floorplan',
    'claude plugin install floorplan@floorplan',
  ] as const;
  /** The curated file Floorplan replaced; doctor only reports it. */
  export const LEGACY_ARCHITECTURE_PATH = 'backlog/docs/architecture.yml';
  export const FLOORPLAN_MAX_GRAPH_BYTES = 10 * 1024 * 1024;

  export type FloorplanStatus =
    | { state: 'missing' }
    | { state: 'invalid'; reason: string }
    | { state: 'map'; builtAt: string; files: number; nodes: number; commitsSince: number | null };

  export interface FloorplanDeps {
    runCapture?: (cmd: string, args: string[], cwd: string) => RunResult;
  }

  const FULL_SHA = /^[0-9a-f]{40}$/;

  function graphPath(cwd: string): string {
    return join(cwd, FLOORPLAN_DIR, 'graph.json');
  }

  export function floorplanPagePath(cwd: string): string {
    return join(cwd, FLOORPLAN_DIR, 'index.html');
  }

  /** Change marker for the hub: mtime of graph.json, 0 when there is no map. Never throws. */
  export function floorplanStamp(cwd: string): number {
    try {
      return statSync(graphPath(cwd)).mtimeMs;
    } catch {
      return 0;
    }
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** Commits on HEAD that the map has not seen; null when unknown. The head only reaches git as a full SHA. */
  function commitsSince(cwd: string, meta: Record<string, unknown>, run: NonNullable<FloorplanDeps['runCapture']>): number | null {
    if (!Array.isArray(meta.repos)) return null;
    const own = meta.repos.find((r) => isRecord(r) && r.path === '.');
    if (!isRecord(own) || typeof own.head !== 'string' || !FULL_SHA.test(own.head)) return null;
    try {
      const result = run('git', ['rev-list', '--count', `${own.head}..HEAD`], cwd);
      if (result.status !== 0) return null;
      const text = result.stdout.trim();
      return /^\d+$/.test(text) ? Number(text) : null;
    } catch {
      return null;
    }
  }

  export function readFloorplanStatus(cwd: string, deps: FloorplanDeps = {}): FloorplanStatus {
    try {
      const file = graphPath(cwd);
      if (!existsSync(file) || !existsSync(floorplanPagePath(cwd))) return { state: 'missing' };
      if (statSync(file).size > FLOORPLAN_MAX_GRAPH_BYTES) return { state: 'invalid', reason: 'graph.json is larger than 10 MB' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch (err) {
        if (err instanceof SyntaxError) return { state: 'invalid', reason: 'not valid JSON' };
        throw err;
      }
      const meta = isRecord(parsed) ? parsed.meta : undefined;
      if (!isRecord(meta) || typeof meta.generatedAt !== 'string' || Number.isNaN(Date.parse(meta.generatedAt))) {
        return { state: 'invalid', reason: 'no build date (meta.generatedAt)' };
      }
      const counts = isRecord(meta.counts) ? meta.counts : {};
      const files = typeof counts.files === 'number' && Number.isFinite(counts.files) ? counts.files : 0;
      const nodes = isRecord(parsed) && Array.isArray(parsed.nodes) ? parsed.nodes.length : 0;
      return {
        state: 'map',
        builtAt: meta.generatedAt,
        files,
        nodes,
        commitsSince: commitsSince(cwd, meta, deps.runCapture ?? defaultRunCapture),
      };
    } catch (err) {
      return { state: 'invalid', reason: err instanceof Error ? err.message : String(err) };
    }
  }

  export function floorplanBuiltDate(builtAt: string): string {
    return new Date(builtAt).toISOString().slice(0, 10);
  }

  function count(n: number, noun: string): string {
    return `${n} ${n === 1 ? noun : `${noun}s`}`;
  }

  /** The one wording of the map status; doctor prefixes its mark, `sbl summary` prefixes "map status: ". */
  export function floorplanStatusLine(status: FloorplanStatus): string {
    if (status.state === 'missing') {
      return 'no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)';
    }
    if (status.state === 'invalid') return `floorplan/graph.json unreadable (${status.reason})`;
    const date = floorplanBuiltDate(status.builtAt);
    const size = `${count(status.files, 'file')}, ${count(status.nodes, 'part')}`;
    if (status.commitsSince === 0) return `floorplan map current (built ${date}, ${size})`;
    if (status.commitsSince === null) return `floorplan map built ${date} (${size})`;
    return `floorplan map built ${date}, ${count(status.commitsSince, 'commit')} behind HEAD (${size})`;
  }
  ```

- [ ] **Step 4: Run it** — `npx vitest run test/unit/floorplan.test.ts` — expected: PASS (all cases).

- [ ] **Step 5: Rewrite the doctor tests**
  - `test/unit/doctor.test.ts`: delete the imports of `summary-layout.js` and `summary-schema.js`, the `ARCH_OK` constant and the whole `describe('check 5: architecture.yml', …)` block (line 170 to the end of the file). Remove the unused `node:fs`/`node:os`/`node:path` imports if nothing else uses them. In `makeDeps`, replace the `loadArchitecture` and `detectDrift` entries with:

    ```ts
    readFloorplanStatus: () => ({ state: 'missing' }),
    legacyArchitectureExists: () => false,
    ```

  - Append:

    ```ts
    describe('check 5: floorplan map', () => {
      const map = { state: 'map', builtAt: '2026-11-28T13:46:30.507Z', files: 165, nodes: 11 } as const;

      it('skips without a map', () => {
        const d = makeDeps();
        expect(runDoctor('/proj', d)).toBe(0);
        expect(d.lines).toContain(
          '[skip] no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)',
        );
      });

      it('warns with the fix line for an unreadable graph.json (exit 4)', () => {
        const d = makeDeps({ readFloorplanStatus: () => ({ state: 'invalid', reason: 'not valid JSON' }) });
        expect(runDoctor('/proj', d)).toBe(4);
        const at = d.lines.indexOf('[warn] floorplan/graph.json unreadable (not valid JSON)');
        expect(at).toBeGreaterThan(-1);
        expect(d.lines[at + 1]).toBe('        fix: ask your agent to update the floorplan');
      });

      it('is ok for a current map', () => {
        const d = makeDeps({ readFloorplanStatus: () => ({ ...map, commitsSince: 0 }) });
        expect(runDoctor('/proj', d)).toBe(0);
        expect(d.lines).toContain('[ok]   floorplan map current (built 2026-11-28, 165 files, 11 parts)');
      });

      it('is ok, not a warning, for a map behind HEAD (exit 0)', () => {
        const d = makeDeps({ readFloorplanStatus: () => ({ ...map, commitsSince: 4 }) });
        expect(runDoctor('/proj', d)).toBe(0);
        expect(d.lines).toContain('[ok]   floorplan map built 2026-11-28, 4 commits behind HEAD (165 files, 11 parts)');
      });

      it('is ok when the distance to HEAD is unknown', () => {
        const d = makeDeps({ readFloorplanStatus: () => ({ ...map, commitsSince: null }) });
        expect(runDoctor('/proj', d)).toBe(0);
        expect(d.lines).toContain('[ok]   floorplan map built 2026-11-28 (165 files, 11 parts)');
      });

      it('reports a leftover architecture.yml as a skip line and keeps the exit code', () => {
        const d = makeDeps({ legacyArchitectureExists: () => true });
        expect(runDoctor('/proj', d)).toBe(0);
        expect(d.lines).toContain(
          '[skip] backlog/docs/architecture.yml is no longer used (Floorplan replaces it; safe to delete)',
        );
        expect(d.lines.slice(-1)[0]).toMatch(/^doctor summary: \d+ ok, 0 warn, 2 skip, 0 fail$/);
      });

      it('does not delete the leftover file (default seams, real directory)', () => {
        const cwd = mkdtempSync(join(tmpdir(), 'sbl-doctor-legacy-'));
        try {
          mkdirSync(join(cwd, 'backlog', 'docs'), { recursive: true });
          const file = join(cwd, 'backlog', 'docs', 'architecture.yml');
          writeFileSync(file, 'schema: 1\n');
          const d = makeDeps({ readFloorplanStatus: undefined, legacyArchitectureExists: undefined });
          runDoctor(cwd, d);
          expect(existsSync(file)).toBe(true);
          expect(d.lines.some((l) => l.startsWith('[skip] backlog/docs/architecture.yml is no longer used'))).toBe(true);
        } finally {
          rmSync(cwd, { recursive: true, force: true });
        }
      });
    });
    ```

    Keep (or add) the `node:fs` imports `existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync`, `tmpdir` and `join` for the last case.
  - `test/e2e/doctor.e2e.test.ts`: delete `DRIFT_LINE` and `expectCleanExceptDrift`; add

    ```ts
    function expectClean({ out, status }: DoctorResult): void {
      expect(out).toContain('[ok]');
      expect(out).not.toContain('[warn]');
      expect(out).not.toContain('[fail]');
      expect(status).toBe(0);
    }
    ```

    and use it in the two permissive-policy cases, renamed to `'exits 0 when policy is permissive'` and `'exits 0 for an Undefined policy on Windows'`. (The repo root has a local map on a developer machine and none in CI; both are exit 0.)

- [ ] **Step 6: Run the doctor unit test** — `npx vitest run test/unit/doctor.test.ts` — expected: FAIL (TypeScript: unknown `DoctorDeps` keys; the old architecture lines are still printed).

- [ ] **Step 7: Change `src/commands/doctor.ts`**
  - Replace the three `../dashboard/summary-*.js` imports (lines 4–6) with:

    ```ts
    import { existsSync } from 'node:fs';
    import { join } from 'node:path';

    import {
      floorplanStatusLine,
      LEGACY_ARCHITECTURE_PATH,
      readFloorplanStatus,
      type FloorplanStatus,
    } from '../lib/floorplan.js';
    ```

    (`node:` imports go above the existing `node:process` import group.)
  - In `DoctorDeps`, replace the three check 5 seams (lines 25–30) with:

    ```ts
    /** Seam for check 5; defaults to reading floorplan/graph.json. */
    readFloorplanStatus?: (cwd: string) => FloorplanStatus;
    /** Seam for check 5; defaults to checking backlog/docs/architecture.yml on disk. */
    legacyArchitectureExists?: (cwd: string) => boolean;
    ```

  - Replace the whole check 5 section (lines 139–189) with:

    ```ts
    // check 5: Floorplan code map (optional). A map behind HEAD is information, not a warning.
    const map = (deps.readFloorplanStatus ?? ((c: string) => readFloorplanStatus(c)))(cwd);
    if (map.state === 'missing') {
      emit('skip', floorplanStatusLine(map));
    } else if (map.state === 'invalid') {
      emit('warn', floorplanStatusLine(map), ['fix: ask your agent to update the floorplan']);
    } else {
      emit('ok', floorplanStatusLine(map));
    }
    const legacyExists =
      deps.legacyArchitectureExists ?? ((c: string) => existsSync(join(c, ...LEGACY_ARCHITECTURE_PATH.split('/'))));
    if (legacyExists(cwd)) {
      emit('skip', `${LEGACY_ARCHITECTURE_PATH} is no longer used (Floorplan replaces it; safe to delete)`);
    }
    ```

- [ ] **Step 8: Verify** — `npm run build && npx vitest run test/unit/floorplan.test.ts test/unit/doctor.test.ts test/e2e/doctor.e2e.test.ts && npx tsc --noEmit` — expected: PASS, no type errors. Then `node dist/bin.js doctor` in the repo root — expected: a check 5 `[ok]   floorplan map built …` line, the `[skip] backlog/docs/architecture.yml is no longer used …` line, exit 0.

- [ ] **Step 9: Commit**

  ```bash
  git add src/lib/floorplan.ts src/commands/doctor.ts test/unit/floorplan.test.ts test/unit/doctor.test.ts test/e2e/doctor.e2e.test.ts
  git commit -m "feat(doctor): check 5 reads the Floorplan map status"
  ```

### Task 2 (TASK-128): `sbl summary` becomes a deprecation stub

**Files:**

- Rewrite: `src/commands/summary.ts`
- Modify: `src/cli.ts:31` (help line), `src/cli.ts:56-57` (`summary options:` block), `src/cli.ts:161-171` (`case 'summary'`)
- Test: `test/unit/summary-command.test.ts`, `test/integration/summary-cli.test.ts`, `test/unit/cli-contract.test.ts:37`

**Interfaces:**

- Consumes: `FLOORPLAN_REPO_URL`, `floorplanStatusLine`, `readFloorplanStatus`, `FloorplanStatus` from Task 1.
- Produces: `runSummary(cwd: string, deps?: SummaryCommandDeps): number` (always 0), `SUMMARY_DEPRECATION: string`. `formatFinding` and `SummaryArgs` no longer exist.

- [ ] **Step 1: Rewrite `test/unit/summary-command.test.ts`** (replace the whole file):

  ```ts
  // test/unit/summary-command.test.ts
  import { describe, expect, it } from 'vitest';

  import { runSummary, SUMMARY_DEPRECATION } from '../../src/commands/summary.js';

  function run(overrides: Parameters<typeof runSummary>[1] = {}): { code: number; lines: string[] } {
    const lines: string[] = [];
    const code = runSummary('/proj', { isProject: () => true, log: (l) => lines.push(l), ...overrides });
    return { code, lines };
  }

  describe('sbl summary (deprecation stub)', () => {
    it('names the replacement', () => {
      expect(SUMMARY_DEPRECATION).toBe(
        'sbl summary no longer checks backlog/docs/architecture.yml: the curated architecture file was replaced by Floorplan (https://github.com/haydenschmitty/floorplan).',
      );
    });

    it('prints the deprecation line and the map status inside a project, exit 0', () => {
      const { code, lines } = run({
        readFloorplanStatus: () => ({ state: 'map', builtAt: '2026-11-28T13:46:30.507Z', files: 165, nodes: 11, commitsSince: 2 }),
      });
      expect(code).toBe(0);
      expect(lines).toEqual([
        SUMMARY_DEPRECATION,
        'map status: floorplan map built 2026-11-28, 2 commits behind HEAD (165 files, 11 parts)',
      ]);
    });

    it('stays at exit 0 for a missing or unreadable map', () => {
      expect(run({ readFloorplanStatus: () => ({ state: 'missing' }) })).toEqual({
        code: 0,
        lines: [
          SUMMARY_DEPRECATION,
          'map status: no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)',
        ],
      });
      expect(run({ readFloorplanStatus: () => ({ state: 'invalid', reason: 'not valid JSON' }) }).code).toBe(0);
    });

    it('prints only the deprecation line outside a project and does not read the map', () => {
      let read = 0;
      const { code, lines } = run({
        isProject: () => false,
        readFloorplanStatus: () => {
          read += 1;
          return { state: 'missing' };
        },
      });
      expect(code).toBe(0);
      expect(lines).toEqual([SUMMARY_DEPRECATION]);
      expect(read).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Rewrite the CLI tests**
  - `test/integration/summary-cli.test.ts`: keep the header, `CLI`, `root`/`repo`/`env`, `git`, `summary`, `beforeEach`/`afterEach`; delete `arch()` and every existing `it`. If `beforeEach` writes or commits an `architecture.yml`, remove those lines (it must still create `repo/backlog/config.yml` and an initial commit). New cases:

    ```ts
    const DEPRECATION =
      'sbl summary no longer checks backlog/docs/architecture.yml: the curated architecture file was replaced by Floorplan (https://github.com/haydenschmitty/floorplan).';
    const NO_MAP =
      'map status: no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)';

    describe('sbl summary (deprecation stub)', () => {
      it('prints the deprecation line and the map status inside a project, exit 0', () => {
        const { out, status } = summary();
        expect(status).toBe(0);
        expect(out.trimEnd().split(/\r?\n/)).toEqual([DEPRECATION, NO_MAP]);
      });

      it('reports a built map with its distance to HEAD', () => {
        const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, env, encoding: 'utf8' }).trim();
        mkdirSync(join(repo, 'floorplan'));
        writeFileSync(join(repo, 'floorplan', 'index.html'), '<!doctype html>');
        writeFileSync(
          join(repo, 'floorplan', 'graph.json'),
          JSON.stringify({
            meta: { generatedAt: '2026-11-28T13:46:30.507Z', counts: { files: 3 }, repos: [{ path: '.', head }] },
            nodes: [{}, {}],
          }),
        );
        const { out, status } = summary();
        expect(status).toBe(0);
        expect(out).toContain('map status: floorplan map current (built 2026-11-28, 3 files, 2 parts)');
      });

      it.each([['--check'], ['--json'], ['--check', '--json', 'extra'], ['--no-such-flag=1']])(
        'accepts and ignores old arguments (%s)',
        (...args) => {
          const { out, status } = summary(args);
          expect(status).toBe(0);
          expect(out.trimEnd().split(/\r?\n/)).toEqual([DEPRECATION, NO_MAP]);
        },
      );

      it('prints only the deprecation line outside a project, exit 0', () => {
        const outside = join(root, 'outside');
        mkdirSync(outside);
        const { out, status } = summary([], outside);
        expect(status).toBe(0);
        expect(out.trimEnd()).toBe(DEPRECATION);
      });
    });
    ```

    Drop the `unlinkSync` import if it is no longer used.
  - `test/unit/cli-contract.test.ts:37`: rename the case to `'lists sbl summary as deprecated without an options block'` and assert

    ```ts
    expect(help).toMatch(/^\s+summary\s+Deprecated: prints the Floorplan map status$/m);
    expect(help).not.toContain('summary options:');
    expect(help).not.toMatch(/^\s+--check\s+Report only/m);
    ```

    (use the variable name the surrounding cases use for the help text).

- [ ] **Step 3: Run** — `npx vitest run test/unit/summary-command.test.ts test/unit/cli-contract.test.ts` — expected: FAIL (`SUMMARY_DEPRECATION` is not exported; help still lists the old line).

- [ ] **Step 4: Rewrite `src/commands/summary.ts`** (replace the whole file):

  ```ts
  // src/commands/summary.ts
  // Deprecation stub: the curated architecture file was replaced by Floorplan. Always exits 0
  // so scripts that still call `sbl summary --check` keep working.
  import { existsSync } from 'node:fs';
  import { join } from 'node:path';

  import { FLOORPLAN_REPO_URL, floorplanStatusLine, readFloorplanStatus, type FloorplanStatus } from '../lib/floorplan.js';

  export const SUMMARY_DEPRECATION =
    'sbl summary no longer checks backlog/docs/architecture.yml: the curated architecture file was replaced by ' +
    `Floorplan (${FLOORPLAN_REPO_URL}).`;

  export interface SummaryCommandDeps {
    isProject?: (cwd: string) => boolean;
    readFloorplanStatus?: (cwd: string) => FloorplanStatus;
    log?: (line: string) => void;
  }

  export function runSummary(cwd: string, deps: SummaryCommandDeps = {}): number {
    const log = deps.log ?? ((line: string) => console.log(line));
    const isProject = deps.isProject ?? ((c: string) => existsSync(join(c, 'backlog', 'config.yml')));
    log(SUMMARY_DEPRECATION);
    if (isProject(cwd)) {
      const read = deps.readFloorplanStatus ?? ((c: string) => readFloorplanStatus(c));
      log(`map status: ${floorplanStatusLine(read(cwd))}`);
    }
    return 0;
  }
  ```

- [ ] **Step 5: Change `src/cli.ts`**
  - Help line 31 becomes `  summary     Deprecated: prints the Floorplan map status`.
  - Delete the `summary options:` heading, its `--check` line and the blank line that separated the block from its neighbor (lines 56–57 plus one blank line), so the help keeps single blank lines between blocks.
  - `case 'summary'` becomes (no `parseArgs`: every old or unknown argument is accepted):

    ```ts
    case 'summary':
      // deprecated: arguments such as --check are accepted and ignored
      return runSummary(process.cwd());
    ```

  - Run `grep -rn "formatFinding\|SummaryArgs" src test` — expected: no hits. Remove any leftover import.

- [ ] **Step 6: Verify** — `npm run build && npx vitest run test/unit/summary-command.test.ts test/unit/cli-contract.test.ts test/integration/summary-cli.test.ts && npx tsc --noEmit` — expected: PASS. Then `node dist/bin.js summary --check; echo "exit=$?"` — expected: two lines, `exit=0`.

- [ ] **Step 7: Commit**

  ```bash
  git add src/commands/summary.ts src/cli.ts test/unit/summary-command.test.ts test/unit/cli-contract.test.ts test/integration/summary-cli.test.ts
  git commit -m "feat(summary): sbl summary becomes a deprecation stub with the map status"
  ```


---

### Task 3 (TASK-131): Templates, init hint and legacy skill cleanup

**Files:**

- Modify: `src/templates/workflow-block.md:31` (rule 7)
- Delete: `src/templates/skill-architecture-summary.md`
- Modify: `src/init/execute.ts:166-169` (`GLUE_SKILLS`, `LEGACY_SKILL_DIRS`)
- Modify: `src/commands/init.ts:14` (import), `:34-36` (hint constant), `:199` (hint condition)
- Test: `test/unit/templates.test.ts:81-95`, `test/unit/glue-skills.test.ts:65-111`, `test/integration/init-preflight.test.ts:7` and `:192-236`, `test/e2e/init.e2e.test.ts:59-60`, `test/e2e/update.e2e.test.ts` (new test after line 210), `test/e2e/uninstall.e2e.test.ts` (before the `runCli(dir, ['uninstall'])` call at line 41)

**Interfaces:**

- Consumes: `readFloorplanStatus(cwd)` from Task 1 (`src/lib/floorplan.ts`).
- Produces: `INIT_FLOORPLAN_HINT: string` exported from `src/commands/init.ts`. `INIT_SUMMARY_HINT` no longer exists. `src/commands/init.ts` no longer imports from `src/dashboard/summary-schema.ts` (Task 5 deletes that module).

- [ ] **Step 1: Change the template tests (red)**
  - `test/unit/templates.test.ts`, rule 8 test: replace `t.indexOf('7. Keep the project summary current')` with `t.indexOf('7. Keep the code map current')`.
  - Same file, replace the rule 7 test with:

    ```ts
    it('binds rule 7: keep an existing code map current, never create one unasked', () => {
      expect(t).toContain(
        '7. Keep the code map current — if the project has a Floorplan map (`floorplan/` exists) and a merge changed the structure (new, moved or removed modules), update the floorplan with the Floorplan skill before the final report, or say in the report that the map is stale when the skill is not available. Never create a map unasked.',
      );
      expect(t.indexOf('7. Keep the code map current')).toBeGreaterThan(t.indexOf('6. Delegate by tier'));
      expect(t.indexOf('7. Keep the code map current')).toBeLessThan(t.indexOf('8. Human checkpoints'));
    });
    ```

  - Same file, add a new `describe` at the end (uses the existing `tplDir`, `read` and the already imported `readdirSync`):

    ```ts
    describe('no template names the removed architecture layer', () => {
      it('has no architecture.yml, architecture-summary or sbl summary reference in any markdown template', () => {
        for (const f of readdirSync(tplDir).filter((n) => n.endsWith('.md'))) {
          const t = read(f);
          expect(t, f).not.toContain('architecture.yml');
          expect(t, f).not.toContain('architecture-summary');
          expect(t, f).not.toContain('sbl summary');
        }
      });
    });
    ```

  - `test/unit/glue-skills.test.ts`: rename the test to `'all three glue skill templates are present'`, remove `'skill-architecture-summary.md'` from its list, add `expect(existsSync(join(tplDir, 'skill-architecture-summary.md'))).toBe(false);` after the loop, and delete the whole `describe('skill-architecture-summary.md', …)` block (lines 78–111).

- [ ] **Step 2: Rewrite the init hint tests (red)** — in `test/integration/init-preflight.test.ts` change the import on line 7 to `INIT_FLOORPLAN_HINT` and replace the three hint tests (lines 192–236) with:

  ```ts
  it('ends with the Floorplan hint when claude is selected and no map exists', async () => {
    for (const harness of ['claude', 'opencode,claude']) {
      const cwd = tempCwd(`hint-${harness.replace(',', '-')}`);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await runInit(cwd, args({ harness }), { preflight: () => okResult(), doctor: () => 0 });
        expect(INIT_FLOORPLAN_HINT).toBe(
          'next step (optional): install the Floorplan plugin for an interactive code map (claude plugin marketplace add haydenschmitty/floorplan; claude plugin install floorplan@floorplan), then ask your agent to make a floorplan',
        );
        const lines = spy.mock.calls.map((c) => String(c[0]));
        expect(lines.slice(-1)).toEqual([INIT_FLOORPLAN_HINT]);
        expect(lines.findIndex((l) => l.startsWith('super-backlog init complete'))).toBeLessThan(
          lines.indexOf(INIT_FLOORPLAN_HINT),
        );
      } finally {
        spy.mockRestore();
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  });

  it('prints no Floorplan hint for an opencode-only init', async () => {
    const cwd = tempCwd('hint-opencode');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit(cwd, args({ harness: 'opencode' }), { preflight: () => okResult(), doctor: () => 0 });
      expect(spy.mock.calls.map((c) => String(c[0]))).not.toContain(INIT_FLOORPLAN_HINT);
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('prints no Floorplan hint when a map already exists', async () => {
    const cwd = tempCwd('hint-present');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit(cwd, args({ harness: 'claude' }), {
        preflight: () => okResult(),
        // the doctor seam runs after the init actions and before the hint check
        doctor: (c) => {
          mkdirSync(join(c, 'floorplan'), { recursive: true });
          writeFileSync(join(c, 'floorplan', 'index.html'), '<!doctype html>');
          writeFileSync(
            join(c, 'floorplan', 'graph.json'),
            JSON.stringify({ meta: { generatedAt: '2026-11-28T13:46:30.507Z', counts: { files: 3 } }, nodes: [{}] }),
          );
          return 0;
        },
      });
      expect(spy.mock.calls.map((c) => String(c[0]))).not.toContain(INIT_FLOORPLAN_HINT);
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('prints no hint on --dry-run', async () => {
    const cwd = tempCwd('hint-dryrun');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit(cwd, args({ harness: 'claude', 'dry-run': true }), { preflight: () => okResult(), doctor: () => 0 });
      expect(spy.mock.calls.map((c) => String(c[0]))).not.toContain(INIT_FLOORPLAN_HINT);
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });
  ```

  The `harness` value is the comma-separated form `runInit` already parses (`init.ts:97-115`). The temp directories are not git repositories, which is fine: `readFloorplanStatus` returns `missing` before it would call git.

- [ ] **Step 3: Change the e2e tests (red)**
  - `test/e2e/init.e2e.test.ts:59-60`: both `architecture-summary` expectations become `.toBe(false)`.
  - `test/e2e/update.e2e.test.ts`: add after the `project-profile` test (line 210):

    ```ts
    it('removes the legacy architecture-summary skill directories and reports them', () => {
      freshScaffold();
      for (const rel of ['.claude/skills/architecture-summary', '.opencode/skill/architecture-summary']) {
        mkdirSync(join(dir, rel), { recursive: true });
        writeFileSync(join(dir, rel, 'SKILL.md'), '<!-- managed-by: super-backlog 1.10.3 -->\n# old\n');
      }

      const r = runUpdate(dir);

      expect(r.status).toBe(4);
      expect(r.out).toContain('removed legacy .claude/skills/architecture-summary');
      expect(r.out).toContain('removed legacy .opencode/skill/architecture-summary');
      expect(existsSync(join(dir, '.claude', 'skills', 'architecture-summary'))).toBe(false);
      expect(existsSync(join(dir, '.opencode', 'skill', 'architecture-summary'))).toBe(false);
      expect(runUpdate(dir).out).not.toContain('removed legacy');
    });
    ```

  - `test/e2e/uninstall.e2e.test.ts`, first test: a fresh init no longer writes the skill, so recreate an older install right before `const out = runCli(dir, ['uninstall']);`:

    ```ts
    // an install made by 1.10 still carries the architecture-summary skill
    for (const rel of ['.claude/skills/architecture-summary', '.opencode/skill/architecture-summary']) {
      mkdirSync(join(dir, rel), { recursive: true });
      writeFileSync(join(dir, rel, 'SKILL.md'), '<!-- managed-by: super-backlog 1.10.3 -->\n# old\n');
    }
    ```

    The existing expectations at lines 52–53 (`architecture-summary` directories gone) stay unchanged. `src/commands/uninstall.ts` is not edited: `OWNED_SKILL_DIRS` already lists both paths.

- [ ] **Step 4: Run the unit and integration tests to see them fail** — `npx vitest run test/unit/templates.test.ts test/unit/glue-skills.test.ts test/integration/init-preflight.test.ts` — expected: FAIL (rule 7 wording, the template still exists, `INIT_FLOORPLAN_HINT` is not exported).

- [ ] **Step 5: Change the templates**
  - `src/templates/workflow-block.md` line 31 becomes exactly:

    ```markdown
    7. Keep the code map current — if the project has a Floorplan map (`floorplan/` exists) and a merge changed the structure (new, moved or removed modules), update the floorplan with the Floorplan skill before the final report, or say in the report that the map is stale when the skill is not available. Never create a map unasked.
    ```

    Rule 8 and the tier section (line 51 mentions "architecture" as a kind of work; that stays) are unchanged.
  - `git rm src/templates/skill-architecture-summary.md`.
  - `grep -n "architecture.yml\|architecture-summary\|sbl summary" src/templates/*.md` — expected: no hits (`skill-backlog-status-report.md` and `skill-task-review-gate.md` carry no such reference today; the guard test from Step 1 keeps it that way).

- [ ] **Step 6: Change `src/init/execute.ts`** — lines 166–169 become:

  ```ts
  const GLUE_SKILLS = ['spec-to-backlog', 'backlog-status-report', 'task-review-gate'] as const;

  /** Skill directories earlier releases installed and this release no longer ships; removed on every init/update. */
  const LEGACY_SKILL_DIRS = [
    '.claude/skills/project-profile',
    '.opencode/skill/project-profile',
    '.claude/skills/architecture-summary',
    '.opencode/skill/architecture-summary',
  ] as const;
  ```

  `applyCopySkills` is unchanged: it already removes every legacy directory that exists and prints `removed legacy <path>`.

- [ ] **Step 7: Change `src/commands/init.ts`**
  - Replace the import on line 14 with `import { readFloorplanStatus } from '../lib/floorplan.js';`.
  - Replace the `INIT_SUMMARY_HINT` constant and its comment with:

    ```ts
    /** Printed after a real init for Claude Code while the project has no Floorplan map. sbl never installs the plugin. */
    export const INIT_FLOORPLAN_HINT =
      'next step (optional): install the Floorplan plugin for an interactive code map (claude plugin marketplace add haydenschmitty/floorplan; claude plugin install floorplan@floorplan), then ask your agent to make a floorplan';
    ```

  - Replace line 199 with:

    ```ts
    if (harnesses.includes('claude') && readFloorplanStatus(cwd).state === 'missing') console.log(INIT_FLOORPLAN_HINT);
    ```

    `harnesses` is the local array from line 97. An `invalid` map prints no hint (doctor already reports it); a dry run returns before this line.
  - Remove `existsSync` and `join` from the imports on lines 2–3 only if `npx tsc --noEmit` reports them unused.

- [ ] **Step 8: Verify** — `npm run build && npx vitest run test/unit/templates.test.ts test/unit/glue-skills.test.ts test/integration/init-preflight.test.ts test/e2e/init.e2e.test.ts test/e2e/update.e2e.test.ts test/e2e/uninstall.e2e.test.ts && npx tsc --noEmit` — expected: PASS. Then the full run `npm test` — expected: PASS (snapshot tests of the workflow block, if any report a diff, are updated with `npx vitest run -u <file>` and the diff must show rule 7 only).

- [ ] **Step 9: Commit**

  ```bash
  git add -A src/templates src/init/execute.ts src/commands/init.ts test/unit/templates.test.ts test/unit/glue-skills.test.ts test/integration/init-preflight.test.ts test/e2e/init.e2e.test.ts test/e2e/update.e2e.test.ts test/e2e/uninstall.e2e.test.ts
  git commit -m "feat(init): Floorplan hint, rule 7 and legacy architecture-summary cleanup"
  ```

  The managed files of this repo (`AGENTS.md`, `.claude/skills/architecture-summary`) are refreshed in Task 6, not here.

---

### Task 4 (TASK-130): Hub serves the map at `/p/<slug>/map/`

**Files:**

- Modify: `src/dashboard/hub.ts` (imports, `ProjectEntry` at lines 45–54, `serveFile` at 197–209, `register` at 286–309, project routes at 466–482)
- Test: `test/unit/hub.test.ts` (`req` helper at lines 18–37, new `describe` block)

**Interfaces:**

- Consumes: `floorplanPagePath(cwd: string): string` and `floorplanStamp(cwd: string): number` from Task 1.
- Produces: routes `GET /p/<slug>/map` (302 to `/p/<slug>/map/`), `GET /p/<slug>/map/` and `GET /p/<slug>/map/index.html` (200, the file `<project>/floorplan/index.html`). The summary page (Task 5) links to `../map/`.

- [ ] **Step 1: Let the test helper return headers** — in `test/unit/hub.test.ts` extend `req`: the return type becomes `Promise<{ status: number; location?: string; body: string; headers: IncomingHttpHeaders }>`, the `resolve` call adds `headers: res.headers`, and the `node:http` import becomes `import { request, type IncomingHttpHeaders } from 'node:http';`. Existing callers are unaffected.

- [ ] **Step 2: Write the failing tests** — add at the end of `describe('startHubServer', …)` in `test/unit/hub.test.ts`:

  ```ts
  describe('floorplan map route', () => {
    const MAP_HTML = '<!doctype html><title>map</title><p>floorplan-map-marker</p>';

    function withMap(cwd: string): void {
      mkdirSync(join(cwd, 'floorplan'), { recursive: true });
      writeFileSync(join(cwd, 'floorplan', 'index.html'), MAP_HTML);
      writeFileSync(join(cwd, 'floorplan', 'graph.json'), '{"secret":"graph-json-marker"}');
      writeFileSync(join(cwd, 'floorplan', 'serve.mjs'), '// serve-mjs-marker');
    }

    async function hubWith(cwd: string, file: string, regenerate: () => void = () => {}) {
      const hub = await startHubServer({ port: 0, token: 't' });
      handles.push(hub);
      const reg = hub.register({ cwd, file, regenerate });
      if (!reg.ok) throw new Error('register failed');
      return { hub, slug: reg.slug };
    }

    it('redirects /map to /map/', async () => {
      const { cwd, file } = fixture('sbl-hub-map-a-', 'map-a');
      dirs.push(cwd);
      withMap(cwd);
      const { hub, slug } = await hubWith(cwd, file);
      const res = await req(hub.port, `/p/${slug}/map`);
      expect(res.status).toBe(302);
      expect(res.location).toBe(`/p/${slug}/map/`);
    });

    it('serves floorplan/index.html with the restrictive headers', async () => {
      const { cwd, file } = fixture('sbl-hub-map-b-', 'map-b');
      dirs.push(cwd);
      withMap(cwd);
      const { hub, slug } = await hubWith(cwd, file);
      for (const path of [`/p/${slug}/map/`, `/p/${slug}/map/index.html`]) {
        const res = await req(hub.port, path);
        expect(res.status).toBe(200);
        expect(res.body).toBe(MAP_HTML);
        expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.headers['content-security-policy']).toBe(
          "connect-src 'none'; form-action 'none'; base-uri 'none'",
        );
      }
    });

    it('answers 404 with the install hint while the project has no map', async () => {
      const { cwd, file } = fixture('sbl-hub-map-c-', 'map-c');
      dirs.push(cwd);
      const { hub, slug } = await hubWith(cwd, file);
      const res = await req(hub.port, `/p/${slug}/map/`);
      expect(res.status).toBe(404);
      expect(res.body).toBe(
        'no floorplan map - install the Floorplan plugin and ask your agent to make a floorplan',
      );
    });

    it('serves no other file below floorplan/', async () => {
      const { cwd, file } = fixture('sbl-hub-map-d-', 'map-d');
      dirs.push(cwd);
      withMap(cwd);
      writeFileSync(join(cwd, 'outside.txt'), 'outside-marker');
      const { hub, slug } = await hubWith(cwd, file);
      for (const tail of [
        'graph.json',
        'serve.mjs',
        'query.mjs',
        '.cache/x',
        '../outside.txt',
        '..%2foutside.txt',
        '%2e%2e/outside.txt',
        'index.html/',
        'index.html%00',
      ]) {
        const res = await req(hub.port, `/p/${slug}/map/${tail}`);
        expect(res.status, tail).toBe(404);
        expect(res.body, tail).not.toContain('marker');
      }
    });

    it('answers only GET on the map page', async () => {
      const { cwd, file } = fixture('sbl-hub-map-e-', 'map-e');
      dirs.push(cwd);
      withMap(cwd);
      const { hub, slug } = await hubWith(cwd, file);
      const res = await req(hub.port, `/p/${slug}/map/`, 'POST', '{}');
      expect(res.status).toBe(404);
      expect(res.body).not.toContain('floorplan-map-marker');
    });

    it('regenerates the project pages once when the map changed before /summary/ is served', async () => {
      const { cwd, file } = fixture('sbl-hub-map-f-', 'map-f');
      dirs.push(cwd);
      const regenerate = vi.fn();
      const { hub, slug } = await hubWith(cwd, file, regenerate);

      await req(hub.port, `/p/${slug}/summary/`);
      expect(regenerate).toHaveBeenCalledTimes(0); // no map at registration, none now

      withMap(cwd);
      await req(hub.port, `/p/${slug}/summary/`);
      expect(regenerate).toHaveBeenCalledTimes(1); // the map appeared

      await req(hub.port, `/p/${slug}/summary/index.html`);
      expect(regenerate).toHaveBeenCalledTimes(1); // unchanged map, no second run

      await req(hub.port, `/p/${slug}/`);
      await req(hub.port, `/p/${slug}/map/`);
      expect(regenerate).toHaveBeenCalledTimes(1); // only the summary route checks
    });

    it('still serves the summary when the regeneration throws', async () => {
      const { cwd, file } = fixture('sbl-hub-map-g-', 'map-g');
      dirs.push(cwd);
      writeFileSync(summaryFileFor(file), '<html>last-good-summary</html>');
      const { hub, slug } = await hubWith(cwd, file, () => {
        throw new Error('boom');
      });
      withMap(cwd);
      const res = await req(hub.port, `/p/${slug}/summary/`);
      expect(res.status).toBe(200);
      expect(res.body).toContain('last-good-summary');
    });
  });
  ```

  Notes for the implementer: `fixture`, `handles`, `dirs`, `summaryFileFor` and `vi` already exist in this file. The `..` cases never reach the map route, because the hub parses the URL with `new URL(req.url ?? '/', 'http://127.0.0.1')` (`hub.ts:322`), which normalizes dot segments; the test pins that they end in a 404 either way.

- [ ] **Step 3: Run the tests to see them fail** — `npx vitest run test/unit/hub.test.ts -t "floorplan map route"` — expected: FAIL (`/map` answers 404 `not found`, no CSP header, `regenerate` never called).

- [ ] **Step 4: Implement in `src/dashboard/hub.ts`**
  - Add the import `import { floorplanPagePath, floorplanStamp } from '../lib/floorplan.js';` next to the other `../lib/` imports.
  - Add below `WATCH_WARN`:

    ```ts
    const MAP_NOT_FOUND = 'no floorplan map - install the Floorplan plugin and ask your agent to make a floorplan';

    /**
     * The map is third-party HTML served from the hub's origin. This policy is added to the page's
     * own <meta> policy (policies intersect), so the page cannot call hub endpoints or post forms.
     */
    const MAP_HEADERS = { 'content-security-policy': "connect-src 'none'; form-action 'none'; base-uri 'none'" };
    ```

  - `ProjectEntry` gains two fields:

    ```ts
    regenerate: () => void | Promise<void>;
    /** mtime of floorplan/graph.json at the last check; 0 while the project has no map. */
    mapStamp: number;
    ```

  - `serveFile` takes extra headers:

    ```ts
    function serveFile(
      file: string,
      res: ServerResponse,
      notFound = 'dashboard not generated yet',
      extraHeaders: Record<string, string> = {},
    ): void {
      readFile(file)
        .then((bytes) => {
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            ...extraHeaders,
          });
          res.end(bytes);
        })
        .catch(() => {
          sendText(res, 404, notFound);
        });
    }
    ```

  - Add below `generateDashboard`:

    ```ts
    /**
     * The hub does not watch floorplan/. A first or rebuilt map is picked up here, right before the
     * summary page is served. A failing regeneration keeps the last good page.
     */
    async function refreshIfMapChanged(entry: ProjectEntry): Promise<void> {
      const stamp = floorplanStamp(entry.cwd);
      if (stamp === entry.mapStamp) return;
      entry.mapStamp = stamp;
      try {
        await entry.regenerate();
      } catch {
        /* serve the last good page */
      }
    }
    ```

  - `register`, re-registration branch: add `existing.regenerate = project.regenerate;` and `existing.mapStamp = floorplanStamp(project.cwd);` after `existing.file = project.file;`.
  - `register`, new entry literal: add `regenerate: project.regenerate,` and `mapStamp: floorplanStamp(project.cwd),`.
  - Project routes: the summary GET route awaits the refresh, and the map routes follow it:

    ```ts
    if (method === 'GET' && (rest === '/summary/' || rest === '/summary/index.html')) {
      await refreshIfMapChanged(entry);
      serveFile(summaryFileFor(entry.file), res, 'summary not generated yet');
      return;
    }

    if (rest === '/map') {
      res.writeHead(302, { location: `/p/${slug}/map/` });
      res.end();
      return;
    }

    // Exactly one file: the path is fixed, nothing from the request becomes part of it.
    if (method === 'GET' && (rest === '/map/' || rest === '/map/index.html')) {
      serveFile(floorplanPagePath(entry.cwd), res, MAP_NOT_FOUND, MAP_HEADERS);
      return;
    }
    ```

    Everything else below `/map/` falls through to the existing `sendText(res, 404, 'not found')`.

- [ ] **Step 5: Verify** — `npm run build && npx vitest run test/unit/hub.test.ts test/integration/serve.test.ts && npx tsc --noEmit` — expected: PASS.

- [ ] **Step 6: Browser check (TASK-130 AC #4)** — the repo has a built map in `floorplan/` from the spike. Start the preview `sbl-dashboard` (`.claude/launch.json`, port 6428), open `/p/super-backlog/map/` and confirm: the board renders and reacts to a click on a part; the console has no errors; the network log shows the page request only (no request to `/api/…`, none to another host). Record the three observations in the task notes. Stop the preview afterwards.

- [ ] **Step 7: Commit**

  ```bash
  git add src/dashboard/hub.ts test/unit/hub.test.ts
  git commit -m "feat(hub): serve the Floorplan map at /p/<slug>/map/"
  ```

  Known limit, stated in the docs (Task 6): the "commits since" count on the summary page is as fresh as the last page generation, like every other fact on that page.

---

### Task 5 (TASK-129): Summary page becomes a facts page with a Code map card

**Files:**

- Rewrite: `src/dashboard/summary-render.ts`
- Modify: `src/templates/summary.html` (CSS lines 59–226, body lines 255–262, client script lines 271–782)
- Modify: `src/lib/yamlmini.ts:18-19` (comment only)
- Delete: `src/dashboard/summary-schema.ts`, `src/dashboard/summary-layout.ts`, `src/dashboard/summary-drift.ts`
- Delete: `test/unit/summary-schema.test.ts`, `test/unit/summary-layout.test.ts`, `test/unit/summary-drift.test.ts`, `test/unit/summary-client.test.ts`, `test/fixtures/summary/architecture.kursbuchung.yml`, `test/fixtures/summary/architecture.super-backlog.yml`
- Test: `test/unit/summary-render.test.ts`, `test/unit/__snapshots__/summary-render.test.ts.snap`, `test/integration/serve.test.ts:254-387`

**Interfaces:**

- Consumes from Task 1 (`src/lib/floorplan.ts`): `readFloorplanStatus(cwd: string, deps?: { runCapture? }): FloorplanStatus` (never throws), `floorplanBuiltDate(builtAt: string): string` (UTC `YYYY-MM-DD`), `FLOORPLAN_INSTALL_COMMANDS` (two strings), `FLOORPLAN_REPO_URL`, and the type
  `FloorplanStatus = { state: 'missing' } | { state: 'invalid'; reason: string } | { state: 'map'; builtAt: string; files: number; nodes: number; commitsSince: number | null }`.
- Consumes from Task 4: the hub route `/p/<slug>/map/` (the card links to `../map/`) and the regeneration of the project pages when `floorplan/graph.json` changed.
- Produces: `codeMapHtml(status: FloorplanStatus | null): string`; `SummaryModel { facts; map: FloorplanStatus | null; renderError: string | null }`; `buildSummaryModel(cwd, deps?, progress?)` (the `data` parameter is gone); `SummaryView` without `architecture`, `layout` and `source.curated`. Unchanged signatures: `summaryFileFor`, `formatCount`, `emptyFacts`, `buildSummaryView(data, model)`, `noticeHtml(model)`, `renderSummary(data, model)`, `writeSummaryPage(cwd, data, dashboardFile, deps?)` — the callers `src/commands/dashboard.ts:38` and `src/dashboard/hub.ts:214` need no change.
- Removed exports (no caller is left after Tasks 1–3): `SUMMARY_DOCS_URL`, `MAX_NOTICE_PROBLEMS`, `SummaryDrift`, `formatPitch`.

- [ ] **Step 1: Rewrite the unit tests (red)** — in `test/unit/summary-render.test.ts`:
  - Imports: keep `dirname` and `fileURLToPath` (`here` and `TOKENS` still use them). Remove the imports of `SUMMARY_PROMPTS`, `layoutArchitecture`, `formatPitch`, `MAX_NOTICE_PROBLEMS`, `ARCHITECTURE_PATH`, `checkArchitectureText`, `ArchitectureLoadResult`. Add `codeMapHtml` to the `summary-render.js` import and add

    ```ts
    import { FLOORPLAN_INSTALL_COMMANDS, FLOORPLAN_REPO_URL, type FloorplanStatus } from '../../src/lib/floorplan.js';
    ```

  - Delete the `FIXTURE` constant, `validModel`, `missing` and `reducedModel`. Add in their place:

    ```ts
    const MAP: FloorplanStatus = { state: 'map', builtAt: '2026-11-28T10:00:00.000Z', files: 165, nodes: 11, commitsSince: 0 };
    const model: SummaryModel = { facts: FACTS, map: { state: 'missing' }, renderError: null };
    const withMap: SummaryModel = { ...model, map: MAP };
    ```

  - `describe('buildSummaryView')` becomes:

    ```ts
    describe('buildSummaryView', () => {
      it('matches the snapshot', () => {
        expect(buildSummaryView(DATA, model)).toMatchSnapshot();
      });

      it('has exactly the facts-page keys (no architecture, no layout, no curated source)', () => {
        const v = buildSummaryView(DATA, withMap);
        expect(Object.keys(v)).toEqual(['project', 'pitchHtml', 'packageName', 'manifest', 'facts', 'tasks', 'commands', 'stack', 'source']);
        expect(Object.keys(v.source)).toEqual(['auto', 'warnings']);
      });

      it('lists open tasks only (D5)', () => {
        const v = buildSummaryView(DATA, model);
        expect(v.tasks.map((t) => t.id)).toEqual(['T-2', 'T-3', 'TASK-85']);
        expect(v.tasks[0]).toEqual({ id: 'T-2', title: 'Add OAuth refresh', status: 'In Progress', phase: 'spec' });
        expect(v.facts.at(-1)).toEqual({ value: '3', label: 'Open tasks' });
      });

      it('computes the six header facts on the server', () => {
        const v = buildSummaryView(DATA, model);
        expect(v.facts).toEqual([
          { value: '1.6.0', label: 'Version · MIT' },
          { value: '31k', label: 'Lines of code' },
          { value: '96', label: 'Test files' },
          { value: '3', label: 'Runtime dependencies' },
          { value: '14', label: 'Releases' },
          { value: '3', label: 'Open tasks' },
        ]);
        const approx = buildSummaryView(DATA, { ...model, facts: { ...FACTS, locApprox: true, releasesNote: 'git unavailable' } });
        expect(approx.facts[1].value).toBe('≈31k');
        expect(approx.facts[4].label).toBe('Releases (git unavailable)');
      });

      it('takes commands, packages and the pitch from the automatic facts', () => {
        const v = buildSummaryView(DATA, model);
        expect(v.commands).toEqual(FACTS.commands);
        expect(v.stack).toEqual([{ name: 'cross-spawn', group: 'Runtime', version: '7.0.6' }]);
        expect(v.pitchHtml).toBe('A demo &lt;b&gt;project&lt;/b&gt;');
      });

      it('uses singular nouns for counts of one on the data-source lines', () => {
        const one: SummaryFacts = { ...FACTS, sourceFiles: 1, releases: 1, releasesNote: null, dependencies: 1, devDependencies: 0 };
        const v = buildSummaryView(DATA, { ...model, facts: one });
        expect(v.source.auto.join('\n')).toMatch(/^1 source file \(/m);
        expect(v.source.auto).toContain('1 release from git version tags');
        expect(v.source.auto).toContain('1 runtime and 0 development dependency; versions from lockfiles where present');
      });

      it('names the Floorplan map as a data source only when a map exists', () => {
        const line = 'Code map from floorplan/graph.json (Floorplan)';
        expect(buildSummaryView(DATA, withMap).source.auto).toContain(line);
        expect(buildSummaryView(DATA, model).source.auto).not.toContain(line);
        expect(buildSummaryView(DATA, { ...model, map: { state: 'invalid', reason: 'not valid JSON' } }).source.auto).not.toContain(line);
        expect(buildSummaryView(DATA, { ...model, map: null }).source.auto).not.toContain(line);
      });

      it('passes facts warnings into the data source (E4)', () => {
        const v = buildSummaryView(DATA, { ...model, facts: { ...FACTS, warnings: ['package.json: bad'] } });
        expect(v.source.warnings).toEqual(['package.json: bad']);
      });
    });
    ```

    This drops the tests `full view (valid architecture) keeps a stable structure`, `looks up stack versions as own properties only …` and the curated-source assertions.
  - Replace `describe('formatPitch and escaping')` with:

    ```ts
    describe('escaping', () => {
      it('escapes the project name in title and app bar', () => {
        const html = renderSummary({ ...DATA, project: { ...DATA.project, name: 'x<y>"z' } }, model);
        expect(html).toContain('<title>x&lt;y&gt;&quot;z &middot; Project Summary</title>');
        expect(html).not.toContain('x<y>');
      });

      it('escapes < in the JSON island', () => {
        const html = renderSummary({ ...DATA, tasks: [{ ...TASKS[1], title: '</script><i>x' }] }, model);
        expect(html).not.toContain('</script><i>');
        expect((island(html) as { tasks: { title: string }[] }).tasks[0].title).toBe('</script><i>x');
      });
    });
    ```

  - Replace `describe('noticeHtml')` (all ten tests) with:

    ```ts
    describe('noticeHtml', () => {
      it('is empty without a render error, whatever the map state', () => {
        expect(noticeHtml(model)).toBe('');
        expect(noticeHtml(withMap)).toBe('');
        expect(noticeHtml({ ...model, map: { state: 'invalid', reason: 'not valid JSON' } })).toBe('');
      });

      it('shows the render error (E3)', () => {
        const n = noticeHtml({ ...model, renderError: 'boom <x>' });
        expect(n).toContain('class="notice notice-error" role="alert"');
        expect(n).toContain('Summary could not be rendered (<code>boom &lt;x&gt;</code>)');
      });
    });
    ```

  - Add a new block after it:

    ```ts
    describe('codeMapHtml', () => {
      const map = (over: Partial<Extract<FloorplanStatus, { state: 'map' }>> = {}): FloorplanStatus => ({ ...MAP, ...over } as FloorplanStatus);

      it('is empty when the status could not be read', () => {
        expect(codeMapHtml(null)).toBe('');
      });

      it('shows build date, counts and the Open map link for a current map', () => {
        expect(codeMapHtml(MAP)).toBe(
          '<section class="codemap" aria-label="Code map"><h2>Code map</h2>' +
            '<p>Floorplan map, built 2026-11-28, 165 files, 11 parts. <a class="maplink" href="../map/">Open map</a></p></section>',
        );
      });

      it('adds the commits since the build only when HEAD moved', () => {
        expect(codeMapHtml(map({ commitsSince: 3 }))).toContain('165 files, 11 parts, 3 commits since. <a');
        expect(codeMapHtml(map({ commitsSince: 1 }))).toContain('11 parts, 1 commit since. <a');
        expect(codeMapHtml(map({ commitsSince: null }))).toContain('11 parts. <a');
        expect(codeMapHtml(map({ commitsSince: null }))).not.toContain('since');
      });

      it('uses singular nouns for one file and one part', () => {
        expect(codeMapHtml(map({ files: 1, nodes: 1 }))).toContain('built 2026-11-28, 1 file, 1 part. <a');
      });

      it('shows the date in UTC', () => {
        expect(codeMapHtml(map({ builtAt: '2026-11-28T23:30:00-05:00' }))).toContain('built 2026-11-29,');
      });

      it('explains Floorplan and lists the install commands when there is no map', () => {
        const html = codeMapHtml({ state: 'missing' });
        expect(html).toContain('<section class="codemap" aria-label="Code map"><h2>Code map</h2>');
        expect(html).toContain(`<p>No code map yet. <a href="${FLOORPLAN_REPO_URL}">Floorplan</a> draws an interactive map of the codebase.`);
        expect(html).toContain('ask your agent to "make a floorplan".</p>');
        for (const run of FLOORPLAN_INSTALL_COMMANDS) {
          expect(html).toContain(`<code>${run}</code>`);
          expect(html).toContain(`data-copy="${run}" aria-label="Copy command: ${run}"`);
        }
        expect(html).not.toContain('../map/');
        expect(html).not.toContain('notice');
      });

      it('shows one neutral line with the escaped reason for an unreadable map', () => {
        const html = codeMapHtml({ state: 'invalid', reason: '<x> & "y"' });
        expect(html).toContain('<p>Floorplan map unreadable (&lt;x&gt; &amp; &quot;y&quot;). Ask your agent to update the floorplan.</p>');
        expect(html).not.toContain('../map/');
        expect(html).not.toContain('notice');
      });
    });
    ```

  - `describe('renderSummary template')`: the first line becomes `const html = renderSummary(DATA, withMap);`. Keep the tests `replaces every placeholder`, `fills placeholders in one pass …`, `defines colors only through tokens …`, `carries the page marker …`, `subscribes to ../api/events …`, `links the page tabs …`, `inlines the shared tokens …` (in them, replace `validModel()` and `reducedModel` by `model`). Replace the accessibility test and the `profile row column layout (TASK-99)` block with:

    ```ts
    it('carries the status toast and no diagram hooks', () => {
      expect(html).toContain('role="status"');
      for (const gone of ['id="canvas"', 'id="panel"', 'id="stage"', "role: 'group'", 'renderSVG', 'architecture.yml', 'S.architecture', 'S.layout', 'data-flow']) {
        expect(html, gone).not.toContain(gone);
      }
    });

    it('places the Code map card between the head and the profile row', () => {
      const head = html.indexOf('id="head"');
      const card = html.indexOf('<section class="codemap"');
      const around = html.indexOf('id="around"');
      expect(head).toBeGreaterThan(-1);
      expect(card).toBeGreaterThan(head);
      expect(around).toBeGreaterThan(card);
      expect(html).toContain('<a class="maplink" href="../map/">Open map</a>');
    });

    it('renders no card when the map status is unknown', () => {
      expect(renderSummary(DATA, { ...model, map: null })).not.toContain('<section class="codemap"');
    });

    describe('profile row column layout (TASK-99)', () => {
      const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';

      it('uses two tracks on wide screens', () => {
        expect(style).toMatch(/\.around\s*\{\s*display:grid;\s*grid-template-columns:\s*minmax\(0,\s*1\.6fr\)\s+minmax\(0,\s*1fr\);/);
      });

      it('keeps two equal columns at 980px', () => {
        expect(style).toMatch(/@media \(max-width:980px\)\s*\{\s*\.around\s*\{\s*grid-template-columns:\s*1fr 1fr;/);
      });

      it('collapses to one column at 640px', () => {
        expect(style).toMatch(/@media \(max-width:640px\)\s*\{\s*\.around\s*\{\s*grid-template-columns:\s*1fr;/);
      });

      it('has no layout variants left', () => {
        expect(style).not.toContain('.around.two');
        expect(style).not.toContain('.around.reduced');
        expect(html).not.toContain("classList.toggle('two'");
      });
    });
    ```

  - `describe('sbl-tokens.css')` and `describe('helpers')` stay unchanged.
  - `describe('writeSummaryPage')`: keep `cwd` setup, `noGit`, `never throws, even when the target cannot be written` and `logs a failed summary write to stderr and still returns`. Replace the other three tests with:

    ```ts
    it('writes the page next to the dashboard file, with the install hint while there is no map', () => {
      const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), { runCapture: noGit });
      expect(file).toBe(join(cwd, 'dash.summary.html'));
      const html = readFileSync(file, 'utf8');
      expect(html).toContain('No code map yet');
      expect(html).not.toContain('Summary could not be rendered');
    });

    it('shows the map of the project directory', () => {
      mkdirSync(join(cwd, 'floorplan'));
      writeFileSync(join(cwd, 'floorplan', 'index.html'), '<!doctype html><title>map</title>');
      writeFileSync(
        join(cwd, 'floorplan', 'graph.json'),
        JSON.stringify({ meta: { generatedAt: '2026-11-28T10:00:00.000Z', counts: { files: 2 } }, nodes: [{}] }),
      );
      const html = readFileSync(writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), { runCapture: noGit }), 'utf8');
      expect(html).toContain('Floorplan map, built 2026-11-28, 2 files, 1 part. <a class="maplink" href="../map/">Open map</a>');
    });

    it('degrades to the facts with the error notice when the map status throws (E3)', () => {
      let lsFiles = 0;
      const counting = (cmd: string, args: string[]): RunResult => {
        if (cmd === 'git' && args[0] === 'ls-files') lsFiles++;
        return noGit();
      };
      const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), {
        runCapture: counting,
        readFloorplanStatus: () => {
          throw new Error('status exploded');
        },
      });
      const html = readFileSync(file, 'utf8');
      expect(html).toContain('Summary could not be rendered (<code>status exploded</code>)');
      expect(html).not.toContain('<section class="codemap"'); // unknown status: no card, no "No code map yet" claim
      expect(lsFiles).toBe(1); // the facts are collected once and reused by the fallback
    });
    ```

    Add `mkdirSync` to the `node:fs` import.
  - Replace `describe('buildSummaryModel drift (spec 2026-10-10)')` (to the end of the file) with:

    ```ts
    describe('buildSummaryModel', () => {
      let cwd: string;
      beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), 'sbl-summary-model-'));
      });
      afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
      });
      const noGit = (): RunResult => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });

      it('reads the map status through the injected seam and records progress', () => {
        const seen: string[] = [];
        const progress: { facts?: SummaryFacts; map?: FloorplanStatus } = {};
        const m = buildSummaryModel(
          cwd,
          {
            runCapture: noGit,
            readFloorplanStatus: (c) => {
              seen.push(c);
              return MAP;
            },
          },
          progress,
        );
        expect(seen).toEqual([cwd]);
        expect(m.map).toBe(MAP);
        expect(m.renderError).toBeNull();
        expect(progress.facts).toBe(m.facts);
        expect(progress.map).toBe(MAP);
      });

      it('passes runCapture on to the default status reader', () => {
        mkdirSync(join(cwd, 'floorplan'));
        writeFileSync(join(cwd, 'floorplan', 'index.html'), '<!doctype html>');
        writeFileSync(
          join(cwd, 'floorplan', 'graph.json'),
          JSON.stringify({
            meta: { generatedAt: '2026-11-28T10:00:00.000Z', counts: { files: 2 }, repos: [{ path: '.', head: 'a'.repeat(40) }] },
            nodes: [{}],
          }),
        );
        const runCapture = (cmd: string, args: string[]): RunResult =>
          cmd === 'git' && args[0] === 'rev-list' ? { status: 0, stdout: '4\n', stderr: '' } : noGit();
        expect(buildSummaryModel(cwd, { runCapture }).map).toEqual({
          state: 'map',
          builtAt: '2026-11-28T10:00:00.000Z',
          files: 2,
          nodes: 1,
          commitsSince: 4,
        });
      });

      it('reports a missing map for a project without floorplan/', () => {
        expect(buildSummaryModel(cwd, { runCapture: noGit }).map).toEqual({ state: 'missing' });
      });
    });
    ```

- [ ] **Step 2: Rewrite the integration tests (red)** — in `test/integration/serve.test.ts`:
  - Delete `ARCH_YML` and `writeArchitecture`. Add below `writeProjectPages`:

    ```ts
    function writeMap(dir: string, graph: string): void {
      mkdirSync(join(dir, 'floorplan'), { recursive: true });
      writeFileSync(join(dir, 'floorplan', 'index.html'), '<!doctype html><title>map</title>');
      writeFileSync(join(dir, 'floorplan', 'graph.json'), graph);
    }

    const GRAPH = JSON.stringify({ meta: { generatedAt: '2026-11-28T10:00:00.000Z', counts: { files: 7 } }, nodes: [{}, {}] });
    ```

  - `serves the generated summary page with its marker`: `'No architecture file yet'` becomes `'No code map yet'`.
  - Replace `shows architecture nodes after architecture.yml is written and pages regenerate` with:

    ```ts
    it('shows the Code map card on the next request after a map was built', async () => {
      const dir = freshProject();
      await writeProjectPages(dir);
      const regenerate = async (): Promise<void> => {
        await writeProjectPages(dir);
      };
      const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
      handles.push(handle);

      expect((await fetchRaw(handle.port, SUMMARY_PATH)).body).toContain('No code map yet');
      writeMap(dir, GRAPH);
      // no manual regenerate: the hub notices the new graph.json before it serves the page (Task 4)
      const res = await fetchRaw(handle.port, SUMMARY_PATH);
      expect(res.status).toBe(200);
      expect(res.body).toContain('Floorplan map, built 2026-11-28, 7 files, 2 parts.');
      expect(res.body).toContain('<a class="maplink" href="../map/">Open map</a>');
      const map = await fetchRaw(handle.port, `${PROJECT_PATH}map/`);
      expect(map.status).toBe(200);
      expect(map.body).toContain('<title>map</title>');
    });
    ```

  - Delete `watcherIt('regenerates and broadcasts a reload when architecture.yml changes', …)`.
  - Replace `serves an invalid architecture.yml as 200 with a notice` with:

    ```ts
    it('serves an unreadable map as 200 with one neutral line', async () => {
      const dir = freshProject();
      writeMap(dir, '{ not json');
      await writeProjectPages(dir);
      const handle = await startServeServer(dir, { port: 0, openBrowser: false });
      handles.push(handle);

      const res = await fetchRaw(handle.port, SUMMARY_PATH);
      expect(res.status).toBe(200);
      expect(res.body).toContain('Floorplan map unreadable (not valid JSON)');
      expect(res.body).not.toMatch(/class="notice[^"]*"/);
    });
    ```

  - The tests `redirects /summary to /summary/`, `answers 404 with a plain text body while the summary is not generated` and `keeps the dashboard intact when the summary chain fails` stay unchanged.

- [ ] **Step 3: Run the tests to see them fail** — `npx vitest run test/unit/summary-render.test.ts` — expected: FAIL (`codeMapHtml` is not exported; TypeScript reports the unknown `map` property). The integration file is run in Step 8, because it needs the build.

- [ ] **Step 4: Rewrite `src/dashboard/summary-render.ts`** — the complete new file:

  ```ts
  // src/dashboard/summary-render.ts
  // Project summary page: automatic facts plus the Code map card, which points to the
  // project's Floorplan map (spec 2026-11-28-floorplan-integration-design.md, decision 2).
  // One static HTML file next to the dashboard file.
  import { atomicWrite } from '../lib/atomic.js';
  import {
    FLOORPLAN_INSTALL_COMMANDS,
    FLOORPLAN_REPO_URL,
    floorplanBuiltDate,
    readFloorplanStatus,
    type FloorplanStatus,
  } from '../lib/floorplan.js';
  import type { Phase } from '../lib/phase.js';
  import type { DashboardData } from './data.js';
  import { isDone } from './metrics.js';
  import { esc, fillTemplate, jsonIsland, readTemplate, tokensCss } from './render.js';
  import { collectSummaryFacts, type FactsDeps, type SummaryFacts } from './summary-facts.js';

  export interface SummaryModel {
    facts: SummaryFacts;
    /** null when the map status could not be read; the page then shows no Code map card. */
    map: FloorplanStatus | null;
    renderError: string | null;
  }

  /** Filled step by step by buildSummaryModel, so the error path can reuse what already succeeded. */
  export interface SummaryProgress {
    facts?: SummaryFacts;
    map?: FloorplanStatus;
  }

  export interface SummaryDeps extends FactsDeps {
    /** Seam for tests; defaults to reading floorplan/graph.json. */
    readFloorplanStatus?: (cwd: string) => FloorplanStatus;
  }

  export interface SummaryFact {
    value: string;
    label: string;
  }

  export interface SummaryTask {
    id: string;
    title: string;
    status: string;
    phase: Phase | null;
  }

  export interface SummaryStackItem {
    name: string;
    group: string;
    version: string;
  }

  /** The JSON island the client renders from (`#sbl-summary`). */
  export interface SummaryView {
    project: string;
    /** escaped project description */
    pitchHtml: string;
    /** package name from the manifest, shown as the pill next to the title */
    packageName: string | null;
    manifest: string | null;
    facts: SummaryFact[];
    tasks: SummaryTask[];
    commands: { group: string; entries: { run: string; note?: string }[] }[];
    stack: SummaryStackItem[];
    source: { auto: string[]; warnings: string[] };
  }

  /** `<dashboard file without .html>.summary.html` (R2). */
  export function summaryFileFor(dashboardFile: string): string {
    return `${dashboardFile.replace(/\.html$/i, '')}.summary.html`;
  }

  /** 980 -> "980", 5234 -> "5.2k", 5000 -> "5k", 48213 -> "48k" */
  export function formatCount(n: number): string {
    if (n < 1000) return String(n);
    if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `${Math.round(n / 1000)}k`;
  }

  function plural(n: number, one: string, many: string): string {
    return n === 1 ? one : many;
  }

  /** "1 file", "165 files" */
  function counted(n: number, one: string, many: string): string {
    return `${n} ${plural(n, one, many)}`;
  }

  export function emptyFacts(): SummaryFacts {
    return {
      name: null,
      version: null,
      license: null,
      manifest: null,
      manifests: [],
      dependencies: 0,
      devDependencies: 0,
      packages: [],
      versions: {},
      extensions: [],
      fileSource: 'walk',
      sourceFiles: 0,
      loc: 0,
      locApprox: false,
      testFiles: 0,
      releases: 0,
      releasesNote: null,
      workflows: 0,
      commands: [],
      warnings: [],
    };
  }

  /** Collects the facts, then the map status. Throws only what its seams throw. */
  export function buildSummaryModel(cwd: string, deps: SummaryDeps = {}, progress: SummaryProgress = {}): SummaryModel {
    const facts = collectSummaryFacts(cwd, deps);
    progress.facts = facts;
    const map = deps.readFloorplanStatus
      ? deps.readFloorplanStatus(cwd)
      : readFloorplanStatus(cwd, deps.runCapture ? { runCapture: deps.runCapture } : {});
    progress.map = map;
    return { facts, map, renderError: null };
  }

  function headerFacts(facts: SummaryFacts, openTasks: number): SummaryFact[] {
    const releasesLabel = facts.releasesNote ? `Releases (${facts.releasesNote})` : 'Releases';
    return [
      { value: facts.version ?? '–', label: facts.license ? `Version · ${facts.license}` : 'Version' },
      { value: `${facts.locApprox ? '≈' : ''}${formatCount(facts.loc)}`, label: 'Lines of code' },
      { value: String(facts.testFiles), label: plural(facts.testFiles, 'Test file', 'Test files') },
      { value: String(facts.dependencies), label: plural(facts.dependencies, 'Runtime dependency', 'Runtime dependencies') },
      { value: String(facts.releases), label: releasesLabel },
      { value: String(openTasks), label: plural(openTasks, 'Open task', 'Open tasks') },
    ];
  }

  function autoSource(data: DashboardData, facts: SummaryFacts, map: FloorplanStatus | null): string[] {
    const out: string[] = [];
    out.push(
      facts.manifest
        ? `Name, version and license from ${facts.manifest}${facts.manifests.length > 1 ? ` (also read: ${facts.manifests.filter((m) => m !== facts.manifest).join(', ')})` : ''}`
        : 'No manifest found (package.json, composer.json or a WordPress header)',
    );
    const exts = facts.extensions.length > 0 ? ` (${facts.extensions.join(' ')})` : '';
    out.push(
      `${counted(facts.sourceFiles, 'source file', 'source files')}${exts} from ${facts.fileSource === 'git' ? 'git ls-files' : 'a directory walk'}` +
        (facts.locApprox ? '; line count stopped at the 10 MB read budget' : ''),
    );
    const depNoun = plural(facts.dependencies + facts.devDependencies, 'dependency', 'dependencies');
    out.push(`${facts.dependencies} runtime and ${facts.devDependencies} development ${depNoun}; versions from lockfiles where present`);
    out.push(
      facts.releasesNote
        ? `Releases: ${facts.releasesNote}`
        : `${counted(facts.releases, 'release', 'releases')} from git version tags`,
    );
    out.push(`${facts.workflows} GitHub Actions ${plural(facts.workflows, 'workflow', 'workflows')}`);
    out.push(data.source === 'backlog-json' ? 'Open work from backlog task list' : 'Open work: no backlog data');
    if (map?.state === 'map') out.push('Code map from floorplan/graph.json (Floorplan)');
    return out;
  }

  /** Pure: dashboard data + model -> the view the client renders. */
  export function buildSummaryView(data: DashboardData, model: SummaryModel): SummaryView {
    const { facts } = model;
    const open = data.tasks.filter((t) => !isDone(t.status));
    return {
      project: data.project.name,
      pitchHtml: esc(data.project.description),
      packageName: facts.name,
      manifest: facts.manifest,
      facts: headerFacts(facts, open.length),
      tasks: open.map((t) => ({ id: t.id, title: t.title, status: t.status, phase: t.phase })),
      commands: facts.commands,
      stack: facts.packages.map((p) => ({ name: p.name, group: p.group, version: p.version })),
      source: { auto: autoSource(data, facts, model.map), warnings: facts.warnings },
    };
  }

  /** Same icon as the client-side COPY_ICON in summary.html; the delegated click handler copies data-copy. */
  const COPY_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>' +
    '<path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>';

  /** Same markup as the client-side cmdHTML, so the card's commands look and copy like every other command. */
  function installCommandHtml(run: string): string {
    return (
      `<div class="cmd"><code>${esc(run)}</code>` +
      `<button class="copy" type="button" data-copy="${esc(run)}" aria-label="Copy command: ${esc(run)}">${COPY_ICON}</button></div>`
    );
  }

  /**
   * The Code map card (decision 2). Server-rendered, so it needs no client code. `null` means the
   * status could not be read: no card, because neither "no map" nor "map" would be a true statement.
   */
  export function codeMapHtml(status: FloorplanStatus | null): string {
    if (!status) return '';
    let body: string;
    if (status.state === 'map') {
      const since =
        status.commitsSince !== null && status.commitsSince > 0
          ? `, ${counted(status.commitsSince, 'commit', 'commits')} since`
          : '';
      body =
        `<p>Floorplan map, built ${esc(floorplanBuiltDate(status.builtAt))}, ${counted(status.files, 'file', 'files')}, ` +
        `${counted(status.nodes, 'part', 'parts')}${since}. <a class="maplink" href="../map/">Open map</a></p>`;
    } else if (status.state === 'invalid') {
      body = `<p>Floorplan map unreadable (${esc(status.reason)}). Ask your agent to update the floorplan.</p>`;
    } else {
      body =
        `<p>No code map yet. <a href="${esc(FLOORPLAN_REPO_URL)}">Floorplan</a> draws an interactive map of the codebase. ` +
        'Install the plugin in Claude Code, then ask your agent to "make a floorplan".</p>' +
        `<div class="cmds">${FLOORPLAN_INSTALL_COMMANDS.map(installCommandHtml).join('')}</div>`;
    }
    return `<section class="codemap" aria-label="Code map"><h2>Code map</h2>${body}</section>`;
  }

  /** The only notice left: the page itself could not be rendered. */
  export function noticeHtml(model: SummaryModel): string {
    if (!model.renderError) return '';
    return (
      '<div class="notice notice-error" role="alert"><p>Summary could not be rendered ' +
      `(<code>${esc(model.renderError)}</code>). Showing the automatic facts only.</p></div>`
    );
  }

  /** Fills the summary template (V1). Pure apart from reading the two template files. */
  export function renderSummary(data: DashboardData, model: SummaryModel): string {
    const view = buildSummaryView(data, model);
    return fillTemplate(readTemplate('summary.html'), {
      __SBL_TOKENS_CSS__: tokensCss,
      __PROJECT_NAME__: () => esc(data.project.name),
      __SUMMARY_NOTICE__: () => noticeHtml(model),
      __SUMMARY_CODE_MAP__: () => codeMapHtml(model.map),
      __SBL_SUMMARY_JSON__: () => jsonIsland(view),
    });
  }

  function minimalPage(data: DashboardData, message: string): string {
    return (
      '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
      `<title>${esc(data.project.name)} &middot; Project Summary</title></head>` +
      `<body><p>Summary could not be rendered (<code>${esc(message)}</code>).</p><p><a href="../">Dashboard</a></p></body></html>\n`
    );
  }

  /**
   * Writes the summary page next to the dashboard file and returns its path. Never throws:
   * a failing step degrades to the facts with an error notice, then to a minimal page.
   */
  export function writeSummaryPage(cwd: string, data: DashboardData, dashboardFile: string, deps: SummaryDeps = {}): string {
    const file = summaryFileFor(dashboardFile);
    const progress: SummaryProgress = {};
    let html: string;
    try {
      html = renderSummary(data, buildSummaryModel(cwd, deps, progress));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        html = renderSummary(data, { facts: progress.facts ?? emptyFacts(), map: progress.map ?? null, renderError: message });
      } catch {
        html = minimalPage(data, message);
      }
    }
    try {
      atomicWrite(file, html);
    } catch (err) {
      // the dashboard never depends on the summary page, but the user should know why it is stale
      process.stderr.write(`sbl: could not write the summary page ${file}: ${err instanceof Error ? err.message : String(err)}\n`);
    }
    return file;
  }
  ```

  Notes for the implementer: keep the existing doc comments of `writeSummaryPage` and `emptyFacts` where they still describe the code. `fillTemplate` replaces every placeholder in one pass, so the order of the map keys does not matter. `SummaryFacts.versions` is no longer read by this file; it stays in `summary-facts.ts` (its tests cover it, and removing it is not part of TASK-129).

- [ ] **Step 5: Edit `src/templates/summary.html`** — work from the bottom up so the line numbers below stay valid.
  - **Client script (lines 271–782).** Replace the whole element, from `<script>` on line 271 to `</script>` on line 782, with the following. Every function in it exists today with the same body, except `taskHTML`, `renderAround` and `renderSource`, which lose their diagram branches.

    ```html
    <script>
    (function () {
      'use strict';
      var S = JSON.parse(document.getElementById('sbl-summary').textContent);

      /* ---------------- helpers ---------------- */
      function $(s, r) { return (r || document).querySelector(s); }
      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

      var COPY_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>';
      var CHECK_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>';
      function cmdHTML(c) {
        return '<div class="cmd"><code>' + esc(c.run) + '</code>' + (c.note ? '<small>' + esc(c.note) + '</small>' : '') +
          '<button class="copy" type="button" data-copy="' + esc(c.run) + '" aria-label="Copy command: ' + esc(c.run) + '">' + COPY_ICON + '</button></div>';
      }

      var toastTimer;
      function toast(msg) {
        var t = $('#toast'); t.textContent = msg; t.classList.add('on');
        clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1300);
      }
      function copyText(text, btn) {
        function done(ok) {
          if (btn) {
            btn.setAttribute('data-done', ok ? '1' : '');
            btn.innerHTML = ok ? CHECK_ICON : COPY_ICON;
            setTimeout(function () { btn.setAttribute('data-done', ''); btn.innerHTML = COPY_ICON; }, 1300);
          }
          toast(ok ? 'Copied ✓' : 'Copy not possible');
        }
        function fallback() {
          var ok = false;
          try {
            var ta = document.createElement('textarea');
            ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
          } catch (e) { ok = false; }
          done(ok);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
        } else {
          fallback();
        }
      }

      /* ---------------- head ---------------- */
      function renderHead() {
        $('#head').innerHTML =
          '<div><h1>' + esc(S.project) + (S.packageName && S.packageName !== S.project ? ' <span class="pill" title="from ' + esc(S.manifest) + '">' + esc(S.packageName) + '</span>' : '') + '</h1>' +
          (S.pitchHtml ? '<p class="pitch">' + S.pitchHtml + '</p>' : '') + '</div>' +
          '<dl class="facts">' + S.facts.map(function (f) { return '<div><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>'; }).join('') + '</dl>';
      }

      /* ---------------- profile row + data source ---------------- */
      function phaseText(t) { return t.phase ? t.status + ' · phase/' + t.phase : t.status; }
      function taskHTML(t) {
        return '<li><span class="tid">' + esc(t.id) + '</span><span class="tt">' + esc(t.title) + '</span>' +
          '<span class="ph' + (t.phase === 'verify' ? ' verify' : '') + '">' + esc(phaseText(t)) + '</span></li>';
      }

      function renderAround() {
        var html = '<section class="sec"><h2>Open work <small>' + S.tasks.length + (S.tasks.length === 1 ? ' task' : ' tasks') + '</small></h2>' +
          (S.tasks.length ? '<ul class="tasks">' + S.tasks.map(taskHTML).join('') + '</ul>' : '<p class="empty">No open tasks.</p>') +
          '<h2 class="later">Commands</h2>' +
          (S.commands.length ? S.commands.map(function (g) {
            return '<div class="cgroup"><h3>' + esc(g.group) + '</h3><div class="cmds">' + g.entries.map(cmdHTML).join('') + '</div></div>';
          }).join('') : '<p class="empty">No commands found.</p>') + '</section>';

        var groups = [], byGroup = {};
        S.stack.forEach(function (s) {
          if (!has(byGroup, s.group)) { byGroup[s.group] = []; groups.push(s.group); }
          byGroup[s.group].push(s);
        });
        html += '<section class="sec"><h2>Tech stack <small>' + S.stack.length + (S.stack.length === 1 ? ' entry' : ' entries') + '</small></h2>' +
          (S.stack.length ? '<div class="stack">' + groups.map(function (g) {
            return '<div class="sg">' + esc(g) + '</div>' + byGroup[g].map(function (s) {
              return '<div class="item"><b>' + esc(s.name) + '</b><span class="v">' + esc(s.version) + '</span></div>';
            }).join('');
          }).join('') + '</div>' : '<p class="empty">No dependencies found.</p>') +
          '</section>';

        $('#around').innerHTML = html;
      }

      function renderSource() {
        function list(items, cls) { return '<ul' + (cls ? ' class="' + cls + '"' : '') + '>' + items.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>'; }
        $('#source').innerHTML = '<summary>Data source <span>automatic</span></summary><div class="src">' +
          '<div><h3>Automatic</h3>' + list(S.source.auto) + '</div>' +
          '<div><h3>Warnings</h3>' + (S.source.warnings.length ? list(S.source.warnings, 'warn') : '<p class="empty">None.</p>') + '</div>' +
          '</div>';
      }

      /* ---------------- events ---------------- */
      document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t.closest) return;
        var copy = t.closest('.copy');
        if (copy) copyText(copy.getAttribute('data-copy'), copy);
      });

      /* ---------------- theme ---------------- */
      var themeToggle = document.getElementById('theme-toggle');
      function syncThemeToggle() {
        var mode = document.documentElement.getAttribute('data-theme');
        themeToggle.textContent = mode === 'light' ? '☾' : '☀';
        themeToggle.setAttribute('aria-label', mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      }
      themeToggle.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('sbl-theme', next); } catch (e) { /* private mode */ }
        syncThemeToggle();
      });
      syncThemeToggle();

      /* ---------------- boot ---------------- */
      $('#crumb').textContent = location.pathname;
      renderHead();
      renderAround();
      renderSource();
    })();
    </script>
    ```

    Before replacing, compare `toast`, `copyText`, `renderHead`, the theme block and the icons with the current file and keep the current text wherever it differs in whitespace from the block above; only the removals are intended. The delegated click handler also serves the copy buttons of the server-rendered Code map card.
  - **Body (lines 255–262).** Replace the whole `<section class="canvas" id="canvas" aria-label="Architecture"> … </section>` block with the single line

    ```html
      __SUMMARY_CODE_MAP__
    ```

    The line `__SUMMARY_NOTICE__` above it and `<div class="around" id="around"></div>` below it stay.
  - **CSS, reduced motion (lines 222–225):** delete line 224 (`svg.flowing .edge.hot path { stroke-dasharray:none; }`).
  - **CSS, data source (line 212):** `.src` becomes `grid-template-columns:1fr 1fr;` (two columns; the Curated column is gone).
  - **CSS, profile row (lines 177–203):** the first five rules become

    ```css
      .around { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); gap:26px 36px; margin-top:30px; }
      @media (max-width:980px) { .around { grid-template-columns:1fr 1fr; } }
      @media (max-width:640px) { .around { grid-template-columns:1fr; gap:24px; } }
    ```

    (`.around.reduced` and `.around.two` are deleted.) Delete lines 187–191 (`.specs…`), 198–199 (`.stack button.item…`), 202 (`.stack .item .r`) and 203 (`.stack-hint`). Keep `.sec…`, `.cgroup…`, `.stack`, `.stack .sg`, `.stack .sg:first-child`, `.stack .item`, `.stack .item b`, `.stack .item .v`.
  - **CSS, flow steps (lines 166–175):** delete the block (`.steps…`, `.pflow…`).
  - **CSS, panel (lines 122–164):** rename the section comment to `/* ---------- Commands, tasks ---------- */`. Delete lines 123–144 (`.panel…`, `.ptitle…`, `.pclose…`, `.pgrid…`, `.conn…`), lines 145–147 (`.chips`, `.chips code`, `.pblock`; their only user was the node panel) and lines 162–163 (`.tasks button.tt…`). Keep `.cmds`, `.cmd`, `.cmd code`, `.cmd small`, `.copy…`, the `@media (max-width:520px)` rule, `.tasks li`, `.tid`, `.ph`, `.ph.verify`, `.tt`, `.empty`.
  - **CSS, canvas card (lines 68–120):** delete the whole block including its section comment (`.canvas`, `.toolbar`, `.flows…`, `.chip…`, `.legend…`, `.stage…`, `.zone…`, `.edge…`, `svg.flowing…`, `svg.filtering…`, `@keyframes sbl-dash`, `.node…`) and put the card styles in its place:

    ```css
      /* ---------- Code map card ---------- */
      .codemap { margin:0 0 6px; padding:14px 16px; border:1px solid var(--line); background:var(--surface-2); border-radius:10px; font-size:14px; color:var(--text); }
      .codemap h2 { font-size:15px; margin-bottom:6px; }
      .codemap p { text-wrap:pretty; }
      .codemap p + .cmds { margin-top:10px; }
      .codemap .maplink { margin-left:8px; font-weight:600; white-space:nowrap; }
    ```

  - **CSS, notice (lines 59–66):** keep line 60 (`.notice`) and line 61 (`.notice-error`); delete lines 62–66 (`.notice ul`, `.notice li code`, `.notice p + p`, `.notice-drift`, `.notice p .copy`).
  - Afterwards run `grep -n "canvas\|panel\|stage\|legend\|flows\|\.node\|\.edge\|\.zone\|svg\.\|highlights\|architecture" src/templates/summary.html` — expected: no line except SVG icon markup (`<svg viewBox=…` inside `COPY_ICON` / `CHECK_ICON`). Remove any leftover rule or comment the grep shows.

- [ ] **Step 6: Delete the architecture layer**

  ```bash
  git rm src/dashboard/summary-schema.ts src/dashboard/summary-layout.ts src/dashboard/summary-drift.ts
  git rm test/unit/summary-schema.test.ts test/unit/summary-layout.test.ts test/unit/summary-drift.test.ts test/unit/summary-client.test.ts
  git rm test/fixtures/summary/architecture.kursbuchung.yml test/fixtures/summary/architecture.super-backlog.yml
  grep -rn "summary-schema\|summary-layout\|summary-drift\|parseYamlSubset\|fixtures/summary" src test
  ```

  Expected grep result after the deletions: hits only in `src/lib/yamlmini.ts` and `test/unit/yamlmini.test.ts` (`parseYamlSubset`). Then:
  - If `parseYamlSubset` has no caller left outside `src/lib/yamlmini.ts` and its own test, **keep it** (it is a tested, self-contained parser; removing it is not part of TASK-129) and change the comment at `src/lib/yamlmini.ts:18-19` from "the documented YAML subset used by backlog/docs/architecture.yml (spec 2026-10-09-project-summary-design.md, D7)" to "a documented YAML subset (block and flow collections, scalars, block scalars, comments). Its first user, the summary page's architecture.yml, was replaced by the Floorplan map in 1.11.0; the parser stays as a library function."
  - If `test/fixtures/summary/` still holds other files, leave them; if it is empty, the directory disappears with the `git rm`.

- [ ] **Step 7: Regenerate the snapshot** — `npx vitest run test/unit/summary-render.test.ts -u` — expected: PASS, 1 snapshot written, 2 obsolete snapshots removed. Open `test/unit/__snapshots__/summary-render.test.ts.snap` and confirm it holds exactly one entry (`buildSummaryView > matches the snapshot 1`) without the keys `architecture`, `layout`, `curated`, `role`, `nodes`, `node`. If `git status` shows `test/unit/__snapshots__/dashboard-render.test.ts.snap` as modified, that is an end-of-line change only: `git checkout -- test/unit/__snapshots__/dashboard-render.test.ts.snap`.

- [ ] **Step 8: Verify** — `npm run build && npm test && npx tsc --noEmit` — expected: PASS, no test file imports a deleted module. `npm run lint` — expected: clean (no unused imports in `summary-render.test.ts` or `serve.test.ts`).

- [ ] **Step 9: Browser check (TASK-129 AC: card in all three states, light and dark, 375 px)** — start the preview `sbl-dashboard` (`.claude/launch.json`, port 6428) and open `/p/super-backlog/summary/`:
  1. **Map state** (the repo has the spike map in `floorplan/`): the card shows "Floorplan map, built 2026-11-28, 165 files, 11 parts", with "… commits since" because HEAD moved; **Open map** opens `/p/super-backlog/map/`. No diagram, no "Highlights" section, no Curated column under Data source. Console without errors.
  2. **Missing state:** rename `floorplan/graph.json` to `floorplan/graph.json.off`, reload the summary page (the hub regenerates because the stamp changed): the card shows the explanation, both install commands with working copy buttons (toast "Copied ✓") and the Floorplan link. Rename the file back.
  3. **Invalid state:** copy `floorplan/graph.json` to the scratchpad, write `{` into `floorplan/graph.json`, reload: one neutral line "Floorplan map unreadable (not valid JSON). Ask your agent to update the floorplan.", no warning colors. Restore the file from the scratchpad copy and reload: the map state is back.
  4. In the map state: toggle the theme (light and dark) and resize to 375 px width: the card text wraps, **Open map** stays on one line, the profile row is one column, no horizontal scrolling.

  Take one screenshot of the map state for the final summary. Stop the preview afterwards. `floorplan/` is self-ignored, so none of this shows up in `git status`.

- [ ] **Step 10: Commit**

  ```bash
  git add -A src/dashboard src/templates/summary.html src/lib/yamlmini.ts test/unit test/integration/serve.test.ts test/fixtures
  git status --short   # no .claude/launch.json, no .playwright-mcp/, no design-demos/
  git commit -m "feat(summary): facts page with a Code map card"
  ```

---

### Task 6 (TASK-132): Docs and dogfood

**Files:**

- Rewrite: `docs/guide/project-summary.md`
- Modify: `README.md:44-45`, `README.md:66`, `README.md:83`, `docs/guide/quickstart.md:42`, `docs/guide/quickstart.md:58-59`, `docs/guide/quickstart.md:94`, `docs/guide/harness-support.md:12`, `cspell.json` (`words`)
- Delete: `backlog/docs/architecture.yml`
- Refresh (generated, never hand-edited): `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`, `.opencode/skill/`
- Replace: `docs/assets/project-summary.png` (1440 × 1000 px, as before)
- Test: `test/docs.test.ts` (unchanged; it requires the strings `sbl doctor` and `sbl summary` in `README.md`)

**Interfaces:**

- Consumes: the user-visible strings of Tasks 1–5 (status lines, card texts, install commands, route `/p/<slug>/map/`, stub output). The guide quotes them; when a quoted string differs from the code, the code wins and the guide is corrected.
- Produces: nothing for other tasks.

- [ ] **Step 1: README** — replace four lines in `README.md`.
  - Line 44 becomes:

    ```markdown
    | `sbl doctor` | Check Node, PowerShell policy, the `backlog` CLI, phase-label hygiene and the Floorplan map status. |
    ```

  - Line 45 becomes:

    ```markdown
    | `sbl summary` | Deprecated: prints the Floorplan map status (the summary page's `architecture.yml` was replaced by Floorplan). |
    ```

  - Line 66 becomes:

    ```markdown
    | `.opencode/skill/` + `.claude/skills/` | Glue skills: `spec-to-backlog`, `task-review-gate`, `backlog-status-report` |
    ```

  - Line 83 becomes:

    ```markdown
    Next to the dashboard, every project gets a summary page with project facts, tech stack, commands, open work and a link to the project's [Floorplan](https://github.com/haydenschmitty/floorplan) code map: [docs/guide/project-summary.md](docs/guide/project-summary.md).
    ```

- [ ] **Step 2: Quickstart** — replace four passages in `docs/guide/quickstart.md`.
  - Line 42, the sentence "After a real init, `sbl` prints a next step to ask your agent for the summary page's `architecture.yml` while the file is missing." becomes:

    ```markdown
    After a real init for Claude Code, `sbl` prints an optional next step: install the Floorplan plugin for an interactive code map (see [project summary page](./project-summary)).
    ```

    The rest of the paragraph (before and after that sentence) stays as it is.
  - Line 58 becomes:

    ```markdown
    | `sbl doctor` | Check Node, PowerShell policy, the `backlog` CLI, phase-label hygiene, and the Floorplan map status. |
    ```

  - Line 59 becomes:

    ```markdown
    | `sbl summary` | Deprecated: prints the Floorplan map status. |
    ```

  - Line 94 becomes:

    ```markdown
    Each project also gets a [project summary page](./project-summary) at `/p/<slug>/summary/`: project facts, tech stack, commands and open work at a glance, plus a link to the project's Floorplan code map when one was built.
    ```

- [ ] **Step 3: Harness support** — in `docs/guide/harness-support.md` line 12 becomes:

  ```markdown
  - The glue skills (spec-to-backlog, backlog-status-report, task-review-gate) are installed as files at `.opencode/skill/<skill>/SKILL.md`.
  - The code map on the [project summary page](./project-summary) comes from the Floorplan plugin, which runs in Claude Code and Codex. A project that is only used with OpenCode gets the summary page without a map.
  ```

- [ ] **Step 4: Rewrite `docs/guide/project-summary.md`** — replace the whole file with:

  ````markdown
  ---
  type: how-to
  ---

  # Project summary page

  Every project registered with the dashboard hub gets a second page next to the
  dashboard: a management summary at `/p/<slug>/summary/`. The dashboard is about
  work in progress; the summary answers what the project is, what it is built
  with and where the open work sits. The picture of the code itself comes from
  [Floorplan](https://github.com/haydenschmitty/floorplan), an agent plugin that
  draws an interactive map of the codebase; the summary page links to that map.

  ## Open the page

  ```bash
  sbl dashboard
  ```

  Use the **Summary** tab under the project name in the dashboard sidebar, or open
  `http://localhost:6428/p/<slug>/summary/` directly. The summary page has tabs
  back to the **Dashboard** and to the full-page **Backlog** browser. Both pages
  share the theme toggle and reload automatically when anything under `backlog/`
  changes. On Windows under Node 24 live reload is disabled due to a libuv bug,
  as for the dashboard (see
  [Troubleshooting](troubleshooting.md#windows--node-24-sbl-dashboard-disables-live-reload));
  refresh the browser tab manually.

  ![Project summary page](../assets/project-summary.png)

  ## What the page shows

  Everything on the page is computed by the hub; there is no file to maintain.

  - **Project facts:** name, version and license from `package.json`,
    `composer.json` or a WordPress theme/plugin header; lines of code and test
    files; runtime and development dependencies; releases (git tags such as
    `v1.2.0`); CI workflows.
  - **Code map:** a card with the state of the project's Floorplan map and a
    link to it (see below).
  - **Tech stack** from the manifests, **commands** from the manifest scripts
    and the **open tasks** from the backlog.
  - **Data source:** a collapsible section at the bottom that lists where the
    numbers come from and any warnings from collecting them.

  ## The Code map card

  The card has three states.

  | State | What the card shows |
  | --- | --- |
  | A map was built | "Floorplan map, built 2026-11-28, 165 files, 11 parts", the number of commits since the map was built when there are any, and the link **Open map**. |
  | No map yet | A short explanation and the two install commands with copy buttons. |
  | The map cannot be read | One line with the reason, for example "Floorplan map unreadable (not valid JSON)", and the advice to ask your agent to update the floorplan. |

  The date is the UTC day the map was built. "Commits since" counts the commits
  between the commit the map was built from and the current `HEAD`. It is
  computed when the page is generated, so it is as fresh as the rest of the
  page: the hub regenerates the page when the backlog changes and when the map
  file changed since the last time the page was served.

  ## Get a map

  Floorplan is a plugin for Claude Code and Codex. super-backlog does not
  install it and never starts it; it only reads what the plugin wrote. For
  Claude Code:

  ```bash
  claude plugin marketplace add haydenschmitty/floorplan
  claude plugin install floorplan@floorplan
  ```

  For Codex:

  ```bash
  codex plugin marketplace add haydenschmitty/floorplan
  codex plugin add floorplan@floorplan
  ```

  Start a new session and ask your agent to "make a floorplan". The agent reads
  the codebase and writes the map into the `floorplan/` directory of the
  project. Reload the summary page: the card now shows the map. The card itself
  offers the two Claude Code commands with copy buttons.

  After larger changes, ask the agent to "update the floorplan". The workflow
  block asks the agent to do this on its own when a merge changed the structure
  of a project that already has a map. The agent never creates a map unasked.

  The map is personal: `floorplan/` contains its own `.gitignore`, so the map
  is not committed and every checkout builds its own.

  ## Open the map

  **Open map** leads to `/p/<slug>/map/`. The hub serves exactly one file there,
  the self-contained map page `floorplan/index.html`. Parts, connections, guided
  flows and the search work as usual.

  Two features need Floorplan's own server and are off under the hub: the
  **Ask** bar and saving flows. For those, start the server that ships with the
  map and open the address it prints:

  ```bash
  node floorplan/serve.mjs
  ```

  ## Check the map from the terminal

  `sbl doctor` reports the map in its check 5:

  | Situation | Line |
  | --- | --- |
  | No map | `[skip] no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)` |
  | Map built from the current commit | `[ok] floorplan map current (built 2026-11-28, 165 files, 11 parts)` |
  | Map older than the current commit | `[ok] floorplan map built 2026-11-28, 3 commits behind HEAD (165 files, 11 parts)` |
  | Map cannot be read | `[warn] floorplan/graph.json unreadable (not valid JSON)` |

  A missing or older map never changes the exit code of `sbl doctor`; the map
  is optional.

  ## Migrating from `architecture.yml`

  Up to version 1.10 the summary page drew its own architecture diagram from a
  curated file, `backlog/docs/architecture.yml`, written by the
  `architecture-summary` skill. Floorplan replaces both.

  - `backlog/docs/architecture.yml` is no longer read. `sbl doctor` points at a
    leftover file with a `[skip]` line; delete it when you no longer need it.
    super-backlog never deletes it for you.
  - `sbl update` removes the `architecture-summary` skill from `.claude/skills/`
    and `.opencode/skill/` and updates the workflow block.
  - `sbl summary` is deprecated. It prints a notice and the map status and
    always exits with `0`; old arguments such as `--check` are accepted and
    ignored. Remove a `sbl summary --check` step from CI when convenient: it no
    longer checks anything.
  - There is no replacement for the drift check. The Code map card and
    `sbl doctor` show how many commits the map is behind instead.

  ## When something is wrong

  - **The card says the map is unreadable:** ask your agent to update the
    floorplan. The rest of the page is not affected.
  - **`/p/<slug>/map/` answers "no floorplan map":** the project has no
    `floorplan/index.html`. Build a map first.
  - **The card still shows an old state:** reload the summary page. The hub
    picks up a new or rebuilt map on the next page load.
  - **Unexpected render error:** the page shows the facts it could collect and
    the error message. The dashboard is never affected.
  ````

  Before saving, compare three quoted strings with the code and correct the guide where they differ: the card sentence (`codeMapHtml` in `src/dashboard/summary-render.ts`), the four doctor lines (`floorplanStatusLine` in `src/lib/floorplan.ts`; the bracket padding in real output is `[ok]   ` / `[skip] ` / `[warn] `, the table shows the bare labels) and the 404 text (`MAP_NOT_FOUND` in `src/dashboard/hub.ts`). Open `floorplan/index.html` through the hub once more and confirm that the feature names used above (Ask bar, guided flows, search) match the labels in the map's UI; use the UI's labels where they differ.

- [ ] **Step 5: Spell-check word** — add `"haydenschmitty"` to the `words` array in `cspell.json` (after `"harness"`, the list is roughly alphabetical per block).

- [ ] **Step 6: Dogfood, delete the curated file**

  ```bash
  git rm backlog/docs/architecture.yml
  ```

  `backlog/docs/` held only this file, so the directory disappears. This is the repo's own file; user projects keep theirs (Global Constraints).

- [ ] **Step 7: Dogfood, refresh the managed files**

  ```bash
  npm run build && node dist/bin.js update --no-self
  git status --short
  ```

  Expected in `git status`: `AGENTS.md` and `CLAUDE.md` modified (block marker `SUPER-BACKLOG:1.10.3` or the current `package.json` version, rule 7 now reads "Keep the code map current …"), `.claude/skills/architecture-summary/SKILL.md` and `.opencode/skill/architecture-summary/SKILL.md` deleted. The three remaining glue skills may show a changed `managed-by` version line; that is expected. Nothing else under `.claude/` or `.opencode/` changes; if `package.json`, `opencode.json` or a hook file shows up as modified, inspect the diff and keep it only when it is the regular output of `sbl update` (no manual edits).

  Then `node dist/bin.js doctor` — expected: check 5 `[ok]   floorplan map …`, **no** `[skip] backlog/docs/architecture.yml is no longer used` line any more, exit 0. And `node dist/bin.js summary --check` — expected: the deprecation line, `map status: floorplan map …`, exit 0.

- [ ] **Step 8: Dogfood, update the map (rule 7)** — this branch removed modules (`summary-schema`, `summary-layout`, `summary-drift`) and added `src/lib/floorplan.ts`, so the structure changed. Run the Floorplan skill with "update the floorplan" and `FLOORPLAN_NO_PROMPTS=1` set. Do not accept any prompt to join a waitlist or to send data. Afterwards `node dist/bin.js doctor` reports `floorplan map current (built <today>, <n> files, <m> parts)`. The map stays uncommitted (`floorplan/` is self-ignored). If the skill is not available in the session, skip this step and say so in the final report (rule 7).

- [ ] **Step 9: Retake the screenshot** — start the preview `sbl-dashboard` (`.claude/launch.json`, port 6428), open `/p/super-backlog/summary/` once in the browser pane and check the page (Code map card in the map state, light theme). Then capture with headless Edge at the size of the old image:

  ```bash
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless --disable-gpu --hide-scrollbars --window-size=1440,1000 --virtual-time-budget=4000 --screenshot="$(pwd -W)/docs/assets/project-summary.png" http://localhost:6428/p/super-backlog/summary/
  node -e "const b=require('fs').readFileSync('docs/assets/project-summary.png');console.log(b.readUInt32BE(16),b.readUInt32BE(20))"
  ```

  Expected: the second command prints `1440 1000`. Open the PNG with the Read tool and confirm it shows the header, the Code map card with the **Open map** link and the profile row, in the light theme, without a diagram. If Edge is installed under `/c/Program Files/Microsoft/Edge/Application/`, use that path. Stop the preview afterwards.

- [ ] **Step 10: Verify the docs**

  ```bash
  npm run lint
  npx vitest run test/docs.test.ts
  npx vitepress build docs
  grep -rn "architecture-summary\|architecture\.yml\|architecture diagram" README.md docs --include=*.md --exclude-dir=superpowers
  ```

  Expected: lint clean (a cspell report is fixed by rewording, or by adding a real proper noun to `cspell.json`), docs test PASS, VitePress build without dead links, and the grep shows hits only in the section "Migrating from `architecture.yml`" of `docs/guide/project-summary.md` and in the `sbl summary` row of `README.md`.

- [ ] **Step 11: Commit**

  ```bash
  git add README.md docs/guide/project-summary.md docs/guide/quickstart.md docs/guide/harness-support.md docs/assets/project-summary.png cspell.json AGENTS.md CLAUDE.md .claude/skills .opencode/skill
  git status --short   # backlog/docs/architecture.yml staged as deleted; no .claude/launch.json, no .playwright-mcp/, no design-demos/
  git commit -m "docs: Floorplan integration and dogfood"
  ```

---

## Final verification and hand-over

- [ ] **Step 1: Full verification on the branch tip**

  ```bash
  npm run build && npm test && npm run lint && npx tsc --noEmit
  npx vitepress build docs
  grep -rn "summary-schema\|summary-layout\|summary-drift\|INIT_SUMMARY_HINT\|SUMMARY_PROMPTS\|skill-architecture-summary" src test scripts
  grep -rn "architecture-summary" src test
  git status --short
  ```

  Expected: everything green; the first grep prints nothing; the second prints only the legacy cleanup in `src/init/execute.ts` (and `src/commands/uninstall.ts` if it lists the legacy skill directories) with their tests; `git status` shows only the untracked `.claude/launch.json`, `.playwright-mcp/` and `design-demos/`. If a snapshot file shows an end-of-line change, restore it (`git checkout -- test/unit/__snapshots__/`).

- [ ] **Step 2: Acceptance criteria and phases** — for each of TASK-127 to TASK-132 check every acceptance criterion against the branch (`npx backlog task view <ID> --plain`), tick them with `npx backlog task edit <ID> --check-ac <n>`, add the verification evidence as notes (`--append-notes`: commands run, test counts, the browser observations of Tasks 4 and 5) and advance with `node dist/bin.js phase <ID> verify`. Commit the task files: `git add backlog/tasks && git commit -m "chore(backlog): Floorplan integration verified (TASK-127 to TASK-132)"`.

- [ ] **Step 3: Whole-branch review** — one review of `git diff master...HEAD` on a Top-tier model that is not Fable (Opus, `model` passed explicitly), with the spec and this plan's Global Constraints as the lens. Fix Critical and Important findings in one follow-up commit and rerun Step 1.

- [ ] **Step 4: Pull request** — `git push -u origin feat/floorplan-integration`, then `gh pr create --base master --title "feat: Floorplan replaces the architecture summary layer" --body-file <scratchpad>/pr-body-floorplan.md < /dev/null`. The body lists the six tasks, the user-visible changes (Code map card, `/p/<slug>/map/`, doctor check 5, deprecated `sbl summary`, removed skill, migration note), the verification output and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. After opening: `mcp__ccd_pr__get_status` (bind with `bind_pr` if needed); no CI polling.

- [ ] **Step 5: Release approval (human)** — the PR contains `feat` commits; merging it lets release-please open the release PR for **1.11.0**. Ask the user for the release approval before the PR is merged. No `automerge` label and no merge before that approval.

- [ ] **Step 6: After the merge** — `node dist/bin.js phase <ID> done` for TASK-127 to TASK-132, set the tasks Done and archive them through the backlog CLI on a `chore` branch with its own PR (never a direct push to `master`).
