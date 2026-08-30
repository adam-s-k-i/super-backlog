# Explicit Pipeline Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pipeline phase of every Backlog task explicit (`phase/spec` → `phase/plan` → `phase/impl` → `phase/verify` labels), managed by a validated `sbl phase` command, rendered truthfully in the dashboard, and resumed by the extended task-review-gate skill.

**Architecture:** Phase state lives in Backlog.md labels (exactly one `phase/*` label per task). A pure library (`src/lib/phase.ts`) defines the phase set and transition validation; a thin command (`src/commands/phase.ts`) swaps labels via the existing `backlog` CLI; the dashboard derives phase from labels it already receives in `task list --json`; doctor gains a hygiene check; the workflow-block and glue-skill templates teach the convention.

**Tech Stack:** TypeScript ESM, Node >= 20, zero runtime deps, `cross-spawn` (already present), vitest.

**Spec:** `docs/superpowers/specs/2026-08-30-pipeline-phase-design.md` — read it first; the plan argues from it.

## Global Constraints

- No push, no npm release, no rollout of `sbl update` beyond this repo — the user acceptance gate (spec R1–R4) blocks all of that. Work happens on the current local branch.
- Phase labels are exactly: `phase/spec`, `phase/plan`, `phase/impl`, `phase/verify`. `done` is a pseudo-target that removes the label.
- Exactly one `phase/*` label per task; all other labels are never touched.
- Never edit Backlog task markdown directly — always drive the `backlog` CLI (`resolveBacklogBin` + `runCapture` from `src/lib/run.ts`).
- Exit codes (HELP legend): `0 ok | 1 usage/detection failure | 2 ownership or merge refusal | 3 upstream command failure | 4 success with warnings`. Upstream backlog failure inside `sbl phase` = 3.
- Commit style: conventional scoped (`feat(phase):`, `test(phase):`, `docs(phase):`, `chore(phase):`). Run `npm test` before every commit that touches `src/` or `test/`.
- Test runner: `npx vitest run <file>` for single files; `npm test` = build + full suite (always green before a commit).
- No comments in source files beyond what existing files do (top-of-file path comment only).

---

### Task 1: Pure phase library `src/lib/phase.ts`

**Files:**
- Create: `src/lib/phase.ts`
- Test: `test/unit/phase.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (used by Tasks 2, 3, 4):
  ```ts
  export const PHASES: readonly ['spec', 'plan', 'impl', 'verify'];
  export type Phase = 'spec' | 'plan' | 'impl' | 'verify';
  export type PhaseTarget = Phase | 'done';
  export const PHASE_LABEL_PREFIX = 'phase/';
  export function phaseLabel(p: Phase): string;                    // 'phase/' + p
  export function extractPhaseLabels(labels: readonly string[]): string[];
  export function derivePhase(labels: readonly string[]): Phase | null;
  export interface TransitionPlan { remove: string | null; add: string | null; }
  export type TransitionResult =
    | { ok: true; plan: TransitionPlan }
    | { ok: false; reason: 'unknown-phase' | 'no-phase' | 'multiple-phases' };
  export function isPhaseTarget(v: string): v is PhaseTarget;
  export function planTransition(labels: readonly string[], target: PhaseTarget): TransitionResult;
  ```

- [ ] **Step 1: Write the failing tests**

Create `test/unit/phase.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  PHASES,
  derivePhase,
  extractPhaseLabels,
  isPhaseTarget,
  phaseLabel,
  planTransition,
} from '../../src/lib/phase.js';

describe('phase constants', () => {
  it('defines the four task phases', () => {
    expect(PHASES).toEqual(['spec', 'plan', 'impl', 'verify']);
    expect(phaseLabel('spec')).toBe('phase/spec');
  });
  it('recognizes valid targets including done', () => {
    for (const t of ['spec', 'plan', 'impl', 'verify', 'done']) expect(isPhaseTarget(t)).toBe(true);
    expect(isPhaseTarget('plans')).toBe(false);
    expect(isPhaseTarget('')).toBe(false);
  });
});

describe('extractPhaseLabels / derivePhase', () => {
  it('keeps only phase/* labels, ignoring others', () => {
    expect(extractPhaseLabels(['feature', 'phase/plan', 'ci'])).toEqual(['phase/plan']);
  });
  it('derivePhase returns the first phase or null (lenient display)', () => {
    expect(derivePhase(['feature', 'phase/impl'])).toBe('impl');
    expect(derivePhase(['feature'])).toBeNull();
    expect(derivePhase([])).toBeNull();
  });
});

describe('planTransition', () => {
  it('sets spec on a task without a phase label', () => {
    expect(planTransition(['feature'], 'spec')).toEqual({
      ok: true,
      plan: { remove: null, add: 'phase/spec' },
    });
  });
  it('advances spec -> plan, preserving other labels untouched', () => {
    expect(planTransition(['feature', 'phase/spec'], 'plan')).toEqual({
      ok: true,
      plan: { remove: 'phase/spec', add: 'phase/plan' },
    });
  });
  it('done removes the label only', () => {
    expect(planTransition(['phase/verify'], 'done')).toEqual({
      ok: true,
      plan: { remove: 'phase/verify', add: null },
    });
  });
  it('same-phase transition is a self-replacing no-op plan', () => {
    expect(planTransition(['phase/impl'], 'impl')).toEqual({
      ok: true,
      plan: { remove: 'phase/impl', add: 'phase/impl' },
    });
  });
  it('rejects unknown phase values', () => {
    expect(planTransition(['phase/spec'], 'deploy' as never)).toEqual({
      ok: false,
      reason: 'unknown-phase',
    });
  });
  it('rejects non-spec transitions on a task with no phase label', () => {
    for (const target of ['plan', 'impl', 'verify', 'done'] as const) {
      expect(planTransition(['feature'], target)).toEqual({ ok: false, reason: 'no-phase' });
    }
  });
  it('rejects tasks carrying two phase labels', () => {
    expect(planTransition(['phase/spec', 'phase/impl'], 'plan')).toEqual({
      ok: false,
      reason: 'multiple-phases',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/phase.test.ts`
Expected: FAIL — cannot find module `../../src/lib/phase.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/phase.ts`:

```ts
// src/lib/phase.ts
export const PHASES = ['spec', 'plan', 'impl', 'verify'] as const;

export type Phase = (typeof PHASES)[number];
export type PhaseTarget = Phase | 'done';

export const PHASE_LABEL_PREFIX = 'phase/';

const PHASE_LABELS: readonly string[] = PHASES.map((p) => PHASE_LABEL_PREFIX + p);

export function phaseLabel(p: Phase): string {
  return PHASE_LABEL_PREFIX + p;
}

export function isPhaseTarget(v: string): v is PhaseTarget {
  return v === 'done' || (PHASES as readonly string[]).includes(v);
}

export function extractPhaseLabels(labels: readonly string[]): string[] {
  return labels.filter((l) => l.startsWith(PHASE_LABEL_PREFIX));
}

export function derivePhase(labels: readonly string[]): Phase | null {
  const found = labels.find((l) => (PHASE_LABELS as readonly string[]).includes(l));
  return found ? (found.slice(PHASE_LABEL_PREFIX.length) as Phase) : null;
}

export interface TransitionPlan {
  remove: string | null;
  add: string | null;
}

export type TransitionResult =
  | { ok: true; plan: TransitionPlan }
  | { ok: false; reason: 'unknown-phase' | 'no-phase' | 'multiple-phases' };

export function planTransition(labels: readonly string[], target: PhaseTarget): TransitionResult {
  if (!isPhaseTarget(target)) return { ok: false, reason: 'unknown-phase' };
  const phaseLabels = extractPhaseLabels(labels);
  if (phaseLabels.length > 1) return { ok: false, reason: 'multiple-phases' };
  const current = phaseLabels[0] ?? null;
  if (current === null && target !== 'spec') return { ok: false, reason: 'no-phase' };
  const remove = current;
  const add = target === 'done' ? null : phaseLabel(target);
  return { ok: true, plan: { remove, add } };
}
```

Note: `planTransition` keeps unknown `phase/xyz` labels in play (they surface as `multiple-phases` only when paired with a known one, or as `no-phase`-style drift that doctor catches). That is intentional: the CLI must never silently delete labels it does not own.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/phase.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/phase.ts test/unit/phase.test.ts
git commit -m "feat(phase): pure phase-label model and transition validation"
```

---

### Task 2: `sbl phase` command

**Files:**
- Create: `src/commands/phase.ts`
- Modify: `src/cli.ts` (register `phase` case + HELP entry)
- Test: `test/unit/phase-command.test.ts`

**Interfaces:**
- Consumes: `planTransition`, `derivePhase`, `isPhaseTarget`, `PHASES` from `../../src/lib/phase.js`; `resolveBacklogBin`, `runCapture`, `RunResult` from `../lib/run.js`.
- Produces:
  ```ts
  export interface PhaseDeps {
    resolveBacklog?: (cwd: string) => string | null;
    run?: (cmd: string, args: string[], cwd: string) => RunResult;
    log?: (line: string) => void;
  }
  export function runPhase(
    cwd: string,
    args: { values: Record<string, unknown>; positionals: string[] },
    deps?: PhaseDeps,
  ): number;
  ```
  CLI surface: `sbl phase <task-id> [spec|plan|impl|verify|done] [--json]`. Query mode (no target) exits 0 and prints the phase or `none`. Transition mode applies the plan via one `backlog task edit <id> --remove-label <old> --add-label <new>` call (`done`/`spec` omit the missing flag).

- [ ] **Step 1: Write the failing tests**

Create `test/unit/phase-command.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runPhase } from '../../src/commands/phase.js';
import type { RunResult } from '../../src/lib/run.js';

interface Call { cmd: string; args: string[]; }

function viewJson(labels: string[]): string {
  return JSON.stringify({ schemaVersion: 1, kind: 'task-view', task: { id: 'TASK-9', labels } });
}

function makeDeps(labels: string[], editStatus = 0) {
  const calls: Call[] = [];
  const out: string[] = [];
  const run = (cmd: string, args: string[]): RunResult => {
    calls.push({ cmd, args });
    if (args.includes('view')) return { status: 0, stdout: viewJson(labels), stderr: '' };
    return { status: editStatus, stdout: '', stderr: editStatus === 0 ? '' : 'edit failed' };
  };
  return {
    deps: { resolveBacklog: () => 'backlog.cmd', run, log: (l: string) => out.push(l) },
    calls,
    out,
  };
}

const args = (positionals: string[], json = false) => ({
  values: json ? { json: true } : {},
  positionals,
});

describe('sbl phase (query mode)', () => {
  it('prints the current phase', () => {
    const { out } = makeDeps(['feature', 'phase/plan']);
    expect(runPhase('/proj', args(['TASK-9']), makeDeps(['feature', 'phase/plan']).deps)).toBe(0);
    expect(out).toContain('phase/plan');
  });
  it('prints none for tasks without a phase label', () => {
    const d = makeDeps(['feature']);
    expect(runPhase('/proj', args(['TASK-9']), d.deps)).toBe(0);
    expect(d.out.some((l) => l.includes('none'))).toBe(true);
  });
  it('supports --json output', () => {
    const d = makeDeps(['phase/spec']);
    expect(runPhase('/proj', args(['TASK-9'], true), d.deps)).toBe(0);
    const jsonLine = d.out.find((l) => l.startsWith('{'));
    expect(jsonLine && JSON.parse(jsonLine)).toEqual({
      id: 'TASK-9',
      phase: 'spec',
      labels: ['phase/spec'],
    });
  });
});

describe('sbl phase (transition mode)', () => {
  it('advances spec -> plan with one edit call swapping labels', () => {
    const d = makeDeps(['feature', 'phase/spec']);
    expect(runPhase('/proj', args(['TASK-9', 'plan']), d.deps)).toBe(0);
    expect(d.calls).toEqual([
      { cmd: 'backlog.cmd', args: ['task', 'view', 'TASK-9', '--json'] },
      { cmd: 'backlog.cmd', args: ['task', 'edit', 'TASK-9', '--remove-label', 'phase/spec', '--add-label', 'phase/plan'] },
    ]);
    expect(d.out.some((l) => l.includes('phase/plan'))).toBe(true);
  });
  it('done removes the label only', () => {
    const d = makeDeps(['phase/verify']);
    expect(runPhase('/proj', args(['TASK-9', 'done']), d.deps)).toBe(0);
    expect(d.calls[1].args).toEqual([
      'task', 'edit', 'TASK-9', '--remove-label', 'phase/verify',
    ]);
  });
  it('rejects unknown targets with exit 1', () => {
    const d = makeDeps(['phase/spec']);
    expect(runPhase('/proj', args(['TASK-9', 'deploy']), d.deps)).toBe(1);
    expect(d.calls).toHaveLength(1);
  });
  it('rejects transition when the task has no phase label (except spec)', () => {
    const d = makeDeps(['feature']);
    expect(runPhase('/proj', args(['TASK-9', 'impl']), d.deps)).toBe(1);
    expect(d.out.some((l) => /phase/.test(l))).toBe(true);
  });
  it('points at sbl doctor on multiple phase labels', () => {
    const d = makeDeps(['phase/spec', 'phase/impl']);
    expect(runPhase('/proj', args(['TASK-9', 'plan']), d.deps)).toBe(1);
    expect(d.out.some((l) => l.includes('sbl doctor'))).toBe(true);
  });
  it('exits 3 when the upstream edit fails', () => {
    const d = makeDeps(['phase/spec'], 1);
    expect(runPhase('/proj', args(['TASK-9', 'plan']), d.deps)).toBe(3);
  });
});

describe('sbl phase (environment failures)', () => {
  it('exits 1 when the backlog CLI cannot be resolved', () => {
    const d = makeDeps([]);
    expect(runPhase('/proj', args(['TASK-9']), { ...d.deps, resolveBacklog: () => null })).toBe(1);
  });
  it('exits 1 on invalid view JSON', () => {
    const d = makeDeps([]);
    const bad = {
      ...d.deps,
      run: (): RunResult => ({ status: 0, stdout: 'not json', stderr: '' }),
    };
    expect(runPhase('/proj', args(['TASK-9']), bad)).toBe(1);
  });
  it('exits 1 when the task id is missing', () => {
    const d = makeDeps([]);
    expect(runPhase('/proj', args([]), d.deps)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/phase-command.test.ts`
Expected: FAIL — cannot find module `../../src/commands/phase.js`.

- [ ] **Step 3: Write the command**

Create `src/commands/phase.ts`:

```ts
// src/commands/phase.ts
import { derivePhase, isPhaseTarget, planTransition, extractPhaseLabels } from '../lib/phase.js';
import { resolveBacklogBin, runCapture, type RunResult } from '../lib/run.js';

export interface PhaseDeps {
  resolveBacklog?: (cwd: string) => string | null;
  run?: (cmd: string, args: string[], cwd: string) => RunResult;
  log?: (line: string) => void;
}

interface TaskViewShape {
  task?: { id?: string; labels?: unknown };
}

function readLabels(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw) as TaskViewShape;
    const labels = parsed?.task?.labels;
    if (!Array.isArray(labels)) return null;
    return labels.filter((l): l is string => typeof l === 'string');
  } catch {
    return null;
  }
}

export function runPhase(
  cwd: string,
  args: { values: Record<string, unknown>; positionals: string[] },
  deps: PhaseDeps = {},
): number {
  const resolveBacklog = deps.resolveBacklog ?? resolveBacklogBin;
  const run = deps.run ?? runCapture;
  const log = deps.log ?? ((line: string) => console.log(line));

  const id = args.positionals[0];
  const target = args.positionals[1];
  const json = args.values['json'] === true;

  if (!id || (target !== undefined && !isPhaseTarget(target))) {
    log(`usage: sbl phase <task-id> [${['spec', 'plan', 'impl', 'verify', 'done'].join('|')}] [--json]`);
    return 1;
  }

  const bin = resolveBacklog(cwd);
  if (!bin) {
    log('error: backlog CLI not found - run sbl init or npm install first');
    return 1;
  }

  const view = run(bin, ['task', 'view', id, '--json'], cwd);
  if (view.status !== 0) {
    log(`error: backlog task view ${id} failed (exit ${view.status})`);
    if (view.stderr.trim()) log(view.stderr.trim());
    return 1;
  }
  const labels = readLabels(view.stdout);
  if (labels === null) {
    log(`error: unreadable task view JSON for ${id}`);
    return 1;
  }

  const phase = derivePhase(labels);

  if (target === undefined) {
    if (json) {
      log(JSON.stringify({ id, phase, labels: extractPhaseLabels(labels) }));
    } else {
      log(phase ? `${id}: phase/${phase}` : `${id}: none`);
    }
    return 0;
  }

  const result = planTransition(labels, target);
  if (!result.ok) {
    if (result.reason === 'multiple-phases') {
      log(`error: ${id} carries multiple phase labels (${extractPhaseLabels(labels).join(', ')}) - run sbl doctor`);
    } else if (result.reason === 'no-phase') {
      log(`error: ${id} has no phase label - start with: sbl phase ${id} spec`);
    } else {
      log(`error: unknown phase "${target}"`);
    }
    return 1;
  }

  const { remove, add } = result.plan;
  if (remove === null && add === null) {
    log(`${id}: no phase label present, nothing to do`);
    return 0;
  }

  const editArgs = ['task', 'edit', id];
  if (remove) editArgs.push('--remove-label', remove);
  if (add) editArgs.push('--add-label', add);
  const edit = run(bin, editArgs, cwd);
  if (edit.status !== 0) {
    log(`error: backlog task edit failed (exit ${edit.status})`);
    if (edit.stderr.trim()) log(edit.stderr.trim());
    return 3;
  }

  log(add ? `${id}: ${add}` : `${id}: phase label removed (done)`);
  return 0;
}
```

- [ ] **Step 4: Register the command in `src/cli.ts`**

In `runCli`'s `switch (command)`, after the `doctor` case (src/cli.ts:149-150), add:

```ts
case 'phase': {
  const parsed = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
    },
  });
  return runPhase(process.cwd(), {
    values: parsed.values as Record<string, string | boolean | undefined>,
    positionals: parsed.positionals,
  });
}
```

Add the import alongside the other command imports:

```ts
import { runPhase } from './commands/phase.js';
```

- [ ] **Step 5: Update the HELP text in `src/cli.ts`**

In the exported `HELP` template string (src/cli.ts:17-57): add to the commands list

```
  phase <task-id> [spec|plan|impl|verify|done]
                                  show or advance the task's pipeline phase
```

and add an options block matching the existing style (copy the `dashboard` options block formatting):

```
  phase options:
    --json                       print query result as JSON
```

Exit codes legend already covers 1 and 3 — no change needed.

- [ ] **Step 6: Run tests**

Run: `npx vitest run test/unit/phase-command.test.ts test/unit/cli-contract.test.ts test/unit/command-smoke.test.ts`
Expected: PASS. If `cli-contract.test.ts` or `command-smoke.test.ts` enumerate commands, add `phase` to their inventories in the same commit.

- [ ] **Step 7: Commit**

```bash
git add src/commands/phase.ts src/cli.ts test/unit/phase-command.test.ts test/unit/cli-contract.test.ts test/unit/command-smoke.test.ts
git commit -m "feat(phase): sbl phase command with validated label transitions"
```

---

### Task 3: Doctor hygiene check (new `fail` status)

**Files:**
- Modify: `src/commands/doctor.ts`
- Test: `test/unit/doctor.test.ts` (extend)

**Interfaces:**
- Consumes: `extractPhaseLabels`, `PHASES` from `../lib/phase.js`.
- Produces: `DoctorDeps` gains `readTaskLabels?: (cwd: string) => Array<{ id: string; status: string; labels: string[] }> | null`; `Status` gains `'fail'`; exit code `1` when any `fail` was emitted (before the warn→4 rule).

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/doctor.test.ts` (keep its existing `makeDeps` helper; it builds a deps object with a `log` capture array and `lines`):

```ts
describe('check 4: phase label hygiene', () => {
  const PHASE_FIXTURES: Array<{ id: string; status: string; labels: string[] }> = [
    { id: 'TASK-1', status: 'To Do', labels: ['feature', 'phase/spec'] },
    { id: 'TASK-2', status: 'In Progress', labels: ['phase/impl'] },
  ];

  function phaseDeps(rows: Array<{ id: string; status: string; labels: string[] }> | null) {
    return makeDeps({ readTaskLabels: () => rows });
  }

  it('ok when labels are clean', () => {
    const d = phaseDeps(PHASE_FIXTURES);
    expect(runDoctor('/proj', d.deps)).toBe(0);
    expect(d.lines.some((l) => l.includes('phase label hygiene clean (2 tasks)'))).toBe(true);
  });

  it('warns on In Progress without phase label (legacy)', () => {
    const d = phaseDeps([{ id: 'TASK-3', status: 'In Progress', labels: ['feature'] }]);
    expect(runDoctor('/proj', d.deps)).toBe(4);
    expect(d.lines.some((l) => l.includes('TASK-3: In Progress without phase label'))).toBe(true);
    expect(d.lines.some((l) => l.includes('fix: sbl phase TASK-3 spec'))).toBe(true);
  });

  it('fails on multiple phase labels', () => {
    const d = phaseDeps([{ id: 'TASK-4', status: 'To Do', labels: ['phase/spec', 'phase/impl'] }]);
    expect(runDoctor('/proj', d.deps)).toBe(1);
    expect(d.lines.some((l) => l.includes('[fail]') && l.includes('TASK-4: multiple phase labels'))).toBe(true);
  });

  it('fails on unknown phase label values', () => {
    const d = phaseDeps([{ id: 'TASK-5', status: 'To Do', labels: ['phase/deploy'] }]);
    expect(runDoctor('/proj', d.deps)).toBe(1);
    expect(d.lines.some((l) => l.includes('TASK-5: unknown phase label phase/deploy'))).toBe(true);
    expect(d.lines.some((l) => l.includes('backlog task edit TASK-5 --remove-label phase/deploy'))).toBe(true);
  });

  it('skips when task labels are unreadable', () => {
    const d = phaseDeps(null);
    expect(runDoctor('/proj', d.deps)).toBe(0);
    expect(d.lines.some((l) => l.includes('[skip]') && l.includes('phase label hygiene'))).toBe(true);
  });
});
```

If the existing `makeDeps` does not accept overrides for new keys, extend its parameter type accordingly (it takes `Partial<DoctorDeps>` already).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/doctor.test.ts`
Expected: FAIL — `readTaskLabels` unknown / hygiene lines missing.

- [ ] **Step 3: Implement the check**

In `src/commands/doctor.ts`:

1. Extend the status vocabulary and counting:

```ts
type Status = 'ok' | 'warn' | 'skip' | 'fail';

const MARK: Record<Status, string> = { ok: '[ok]  ', warn: '[warn]', skip: '[skip]', fail: '[fail]' };
```

Update `emit` so `fail` increments `failCount` (new variable beside `okCount`/`warnCount`/`skipCount`), and update the summary + return:

```ts
log(`doctor summary: ${okCount} ok, ${warnCount} warn, ${skipCount} skip, ${failCount} fail`);
if (failCount > 0) return 1;
return warnCount > 0 ? 4 : 0;
```

2. Add to `DoctorDeps` and defaults:

```ts
export interface DoctorDeps {
  platform?: string;
  nodeVersion?: string;
  executor?: Executor;
  resolveBacklog?: (cwd: string) => string | null;
  readTaskLabels?: (cwd: string) => Array<{ id: string; status: string; labels: string[] }> | null;
  log?: (line: string) => void;
}
```

Default implementation (module-local, above `runDoctor`):

```ts
function defaultReadTaskLabels(
  cwd: string,
  resolveBacklog: (cwd: string) => string | null,
): Array<{ id: string; status: string; labels: string[] }> | null {
  const bin = resolveBacklog(cwd);
  if (!bin) return null;
  const res = runCapture(bin, ['task', 'list', '--json'], cwd);
  if (res.status !== 0) return null;
  try {
    const parsed = JSON.parse(res.stdout) as { tasks?: unknown };
    if (!Array.isArray(parsed.tasks)) return null;
    const rows: Array<{ id: string; status: string; labels: string[] }> = [];
    for (const t of parsed.tasks) {
      if (typeof t !== 'object' || t === null) continue;
      const id = (t as { id?: unknown }).id;
      const status = (t as { status?: unknown }).status;
      const labels = (t as { labels?: unknown }).labels;
      if (typeof id !== 'string' || typeof status !== 'string') continue;
      rows.push({
        id,
        status,
        labels: Array.isArray(labels) ? labels.filter((l): l is string => typeof l === 'string') : [],
      });
    }
    return rows;
  } catch {
    return null;
  }
}
```

(Add `runCapture` to the existing `../lib/run.js` import.)

3. Add check 4 after check 3:

```ts
// check 4: phase label hygiene
const readTaskLabels = deps.readTaskLabels ?? ((c: string) => defaultReadTaskLabels(c, resolveBacklog));
const taskRows = readTaskLabels(cwd);
if (taskRows === null) {
  emit('skip', 'phase label hygiene (task labels unreadable - backlog CLI unavailable)');
} else {
  const known = new Set(PHASES.map((p) => `phase/${p}`));
  let problems = 0;
  let legacy = 0;
  for (const row of taskRows) {
    const phaseLabels = extractPhaseLabels(row.labels);
    const unknown = phaseLabels.filter((l) => !known.has(l));
    if (phaseLabels.length > 1) {
      problems += 1;
      emit('fail', `${row.id}: multiple phase labels (${phaseLabels.join(', ')})`, [
        `fix: sbl phase ${row.id} <phase> after removing the stale label`,
      ]);
    }
    for (const l of unknown) {
      problems += 1;
      emit('fail', `${row.id}: unknown phase label ${l}`, [
        `fix: backlog task edit ${row.id} --remove-label ${l}`,
      ]);
    }
    if (unknown.length === 0 && phaseLabels.length === 0 && row.status === 'In Progress') {
      legacy += 1;
      emit('warn', `${row.id}: In Progress without phase label (legacy inventory)`, [
        `fix: sbl phase ${row.id} spec`,
      ]);
    }
  }
  if (problems === 0 && legacy === 0) {
    emit('ok', `phase label hygiene clean (${taskRows.length} tasks)`);
  }
}
```

Import `extractPhaseLabels` and `PHASES` from `../lib/phase.js`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/doctor.test.ts`
Expected: PASS (existing checks unaffected; new cases pass).

Note: this repo's own backlog has legacy tasks — `node dist/bin.js doctor` locally may now exit 4 with legacy warnings. That is correct behavior and part of acceptance (R3).

- [ ] **Step 5: Commit**

```bash
git add src/commands/doctor.ts test/unit/doctor.test.ts
git commit -m "feat(phase): doctor hygiene checks for phase labels with fail status"
```

---

### Task 4: Dashboard data layer — labels + derived phase

**Files:**
- Modify: `src/dashboard/data.ts`
- Test: `test/unit/dashboard-data.test.ts` (extend)

**Interfaces:**
- Consumes: `derivePhase`, `Phase` from `../lib/phase.js`.
- Produces: `DashboardTask` gains `labels: string[]` and `phase: Phase | null` — later dashboard UI (Task 5) and any consumer of the `sbl-data` island rely on these exact field names.

- [ ] **Step 1: Write the failing tests**

In `test/unit/dashboard-data.test.ts`, extend the `normalizeTasks` describe block (after the existing schema tests around lines 58–83):

```ts
it('maps labels and derives the pipeline phase', () => {
  const [task] = normalizeTasks([
    {
      id: 'TASK-1',
      title: 'T',
      status: 'In Progress',
      labels: ['feature', 'phase/plan'],
    },
  ]);
  expect(task.labels).toEqual(['feature', 'phase/plan']);
  expect(task.phase).toBe('plan');
});

it('defaults labels to [] and phase to null', () => {
  const [task] = normalizeTasks([{ id: 'TASK-2', title: 'T', status: 'To Do' }]);
  expect(task.labels).toEqual([]);
  expect(task.phase).toBeNull();
});

it('is lenient on duplicate phase labels (doctor flags them)', () => {
  const [task] = normalizeTasks([
    { id: 'TASK-3', title: 'T', status: 'To Do', labels: ['phase/spec', 'phase/impl'] },
  ]);
  expect(task.phase).toBe('spec');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/dashboard-data.test.ts`
Expected: FAIL — `labels`/`phase` not present on `DashboardTask`.

- [ ] **Step 3: Implement**

In `src/dashboard/data.ts`:

1. Interface (after `priority?: string;` at data.ts:21):

```ts
  labels: string[];
  phase: Phase | null;
```

2. Import: `import { derivePhase, type Phase } from '../lib/phase.js';`

3. Array-safe string helper (beside `asString`, data.ts:92–96):

```ts
function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
```

4. In `normalizeTasks` (data.ts:143–156) add two lines in the mapping (order does not matter, keep fields grouped with the other scalars):

```ts
    labels: asStrings(t['labels']),
    phase: derivePhase(asStrings(t['labels'])),
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/dashboard-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/data.ts test/unit/dashboard-data.test.ts
git commit -m "feat(phase): dashboard data layer maps labels and derives phase"
```

---

### Task 5: Dashboard UI — stepper badges, task badges, modal chip

**Files:**
- Modify: `src/templates/dashboard.html` (inline `sbl-app` script + no markup shells needed — all mounts exist)
- Test: `test/unit/dashboard-render.test.ts` (extend + snapshot update)

**Interfaces:**
- Consumes: `task.phase` on every entry of the `sbl-data` island's `tasks` array (Task 4); existing `copyCommand`, `actionButton`, `el`, `$` helpers; existing `renderStepper(mount, phases)`, task-row builder, `openDetail(id)`.
- Produces: visible phase badge on stepper steps 5–8 (task counts), phase chip in task rows and the detail modal, copyable `sbl phase <id> <next>` chip in the modal. No new data attributes (`data-cmd`/`data-copy` are forbidden by tests at dashboard-render.test.ts:600–615).

- [ ] **Step 1: Update the render test first (failing)**

In `test/unit/dashboard-render.test.ts`:

1. Extend the module-scope `SAMPLE: DashboardData` fixture (lines 48–74): give one task `labels: ['phase/spec'], phase: 'spec'` and another `labels: [], phase: null`. The type comes from Task 4, so this compiles only after Task 4.

2. Add a new describe block:

```ts
describe('phase rendering', () => {
  it('exposes phase on tasks in the data island', () => {
    const island = JSON.parse(islandOf(html, 'sbl-data'));
    const withPhase = island.tasks.find((t: { phase: string | null }) => t.phase === 'spec');
    expect(withPhase).toBeTruthy();
    expect(withPhase.labels).toContain('phase/spec');
  });
  it('client script computes phase counts and drives stepper badges', () => {
    const script = appScript();
    expect(script).toContain('phaseCounts');
    expect(script).toContain('sbl phase ');
  });
  it('never reintroduces command data attributes', () => {
    expect(html).not.toContain('data-cmd=');
    expect(html).not.toContain('data-copy=');
  });
});
```

3. Raise the app-script budget cap (lines 302–322) from `1109` to `1180` — update the number in `expect(lines).toBeLessThanOrEqual(1180);` and the comment beside it to `// raised for pipeline-phase badges + modal chip (approved feature work)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/dashboard-render.test.ts`
Expected: FAIL — `phaseCounts` missing from app script; snapshot will also drift after Step 3 (expected).

- [ ] **Step 3: Implement in `src/templates/dashboard.html`**

All changes inside `<script id="sbl-app">`:

1. Phase constants + counts (place near the top, right after the `sbl-phases` island parsing around lines 1364–1370):

```js
var PHASE_ORDER = ['spec', 'plan', 'impl', 'verify'];
var PHASE_STEP = { spec: 5, plan: 6, impl: 7, verify: 8 };
var NEXT_PHASE = { spec: 'plan', plan: 'impl', impl: 'verify', verify: 'done' };
var phaseCounts = { spec: 0, plan: 0, impl: 0, verify: 0 };
data.tasks.forEach(function (t) {
  if (t.phase && phaseCounts[t.phase] !== undefined) phaseCounts[t.phase] += 1;
});
```

2. Stepper badges — inside `renderStepper(mount, phases)` (lines 1327–1362), when building each step button, after the existing label content is appended:

```js
var phaseKey = Object.keys(PHASE_STEP).find(function (k) { return PHASE_STEP[k] === p.n; });
if (phaseKey && phaseCounts[phaseKey] > 0) {
  b.appendChild(el('span', 'step-count', String(phaseCounts[phaseKey])));
}
```

Add the matching CSS to the existing `<style>` block (near the `.step` rules; reuse token variables as neighboring rules do):

```css
.step .step-count { margin-left: .5rem; padding: 0 .45rem; border-radius: 999px;
  font: 600 .68rem/1.5 var(--mono); background: color-mix(in oklab, var(--accent) 18%, transparent); }
```

3. Task rows — in the row builder that sets `tr.setAttribute('data-task', task.id)` (around line 762), append a phase chip cell before the status cell (reuse the `status-chip` classes with `data-tone="accent"`):

```js
if (task.phase) {
  var pc = el('span', 'status-chip', 'phase/' + task.phase);
  pc.setAttribute('data-tone', 'accent');
  /* insert pc into the first cell alongside the task id, following the status-chip pattern used for status */
}
```

Concretely: build it the same way the existing status chip is built in that row and place it next to the id text.

4. Detail modal — in `openDetail(id)` (lines 1535–1576), two additions:

a) Phase row in `metaGrid(task)` (lines 1496–1511): add a cell

```js
cell('Phase', task.phase ? 'phase/' + task.phase : '-');
```

following the exact `metaGrid` cell construction used for Priority.

b) After the existing `backlog task edit` copy button (lines 1565–1572), add the advance chip — only when the task has a phase:

```js
if (task.phase) {
  var advanceCmd = 'sbl phase ' + t.id.replace(/^task-/i, '') + ' ' + NEXT_PHASE[task.phase];
  var adv = actionButton(advanceCmd, 'copy: advance to ' + (NEXT_PHASE[task.phase] === 'done' ? 'done' : 'phase/' + NEXT_PHASE[task.phase]));
  adv.addEventListener('click', function () { copyCommand(adv, advanceCmd); });
  content.appendChild(adv);
}
```

(Match how the edit-command button wires `copyCommand`; the closure pattern above is required — no data attributes.)

- [ ] **Step 4: Update the snapshot and run tests**

Run: `npx vitest run test/unit/dashboard-render.test.ts -u`
Expected: PASS with updated snapshot (`__snapshots__/dashboard-render.test.ts.snap`). Inspect the snapshot diff — it must only contain phase-related additions.

- [ ] **Step 5: Full suite check**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/templates/dashboard.html test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(phase): dashboard stepper badges, task phase chips, modal advance chip"
```

---

### Task 6: Templates — workflow block + glue skills

**Files:**
- Modify: `src/templates/workflow-block.md`
- Modify: `src/templates/skill-spec-to-backlog.md`
- Modify: `src/templates/skill-task-review-gate.md`
- Test: `test/unit/templates.test.ts`, `test/unit/glue-skills.test.ts` (extend)

**Interfaces:**
- Consumes: nothing from code tasks (pure template text), but references the `sbl phase` command from Task 2.
- Produces: refreshed template content; installed copies refresh later via `sbl update` (do NOT touch `.opencode/skill/` or `.claude/skills/` here — Task 7 refreshes them through the CLI).

- [ ] **Step 1: Write the failing template tests**

In `test/unit/templates.test.ts`, inside the `workflow-block.md` describe, add:

```ts
it('maps phases to labels and mandates sbl phase', () => {
  for (const label of ['phase/spec', 'phase/plan', 'phase/impl', 'phase/verify']) {
    expect(t).toContain(label);
  }
  expect(t).toContain('sbl phase');
  expect(t).toMatch(/only via `sbl phase`/);
});
```

In `test/unit/glue-skills.test.ts`, extend the `skill-spec-to-backlog.md` describe:

```ts
it('creates tasks with the spec phase label', () => {
  expect(t).toContain('phase/spec');
  expect(t).toContain('sbl phase');
});
```

and the `skill-task-review-gate.md` describe:

```ts
it('is the session entry with per-phase resume behavior', () => {
  expect(t).toContain('sbl phase');
  expect(t).toMatch(/resume/i);
  expect(t).toMatch(/phase\/(spec|plan|impl|verify)/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/templates.test.ts test/unit/glue-skills.test.ts`
Expected: FAIL — new assertions missing.

- [ ] **Step 3: Update `src/templates/workflow-block.md`**

Replace the pipeline table with (keeps all nine phases and existing wording, adds the label column):

```markdown
| # | Phase | Phase label | Gate to pass |
|---|-------|-------------|--------------|
| 1 | Idea | — | User states a need; capture it before doing anything else |
| 2 | Brainstorming | — | Explore intent, requirements and design before any creative work |
| 3 | Design gate | — | Human approves the design document |
| 4 | Spec-to-backlog | `phase/spec` set at creation | Decompose the approved design into reviewed tasks with acceptance criteria |
| 5 | Review gate | `phase/spec` | Human reviews specs and acceptance criteria before any code exists |
| 6 | Plan-before-code | `phase/plan` | A written implementation plan is approved by the human |
| 7 | TDD implementation | `phase/impl` | Failing test first, then code; one task per session/PR |
| 8 | Verification & final summary | `phase/verify` | Run tests/lint/typecheck; verification evidence before success claims |
| 9 | Merge & archive | label removed (`done`) | Merge the branch, then close/archive the task via the backlog CLI |
```

Append binding rule 5 (after rule 4):

```markdown
5. Phase transitions only via `sbl phase <id> <phase>`, always at a gate passage — never edit phase labels by hand.
```

- [ ] **Step 4: Update `src/templates/skill-spec-to-backlog.md`**

In Procedure step 3, extend the create command:

```markdown
   backlog task create "Title" -d "<goal/context>" --ac "<criterion 1>" --ac "<criterion 2>" --type feature --label feature -l "phase/spec" --ref "<path/to/plan-doc>"
```

Add a new step after step 4:

```markdown
5. Every created task starts at `phase/spec`. Later phase changes happen only via `sbl phase <id> <phase>` at gate passages — never by editing labels manually.
```

Renumber the old STOP step to 6. In Boundaries add:

```markdown
- Phase labels are set with creation and advanced only via `sbl phase`.
```

- [ ] **Step 5: Rewrite `src/templates/skill-task-review-gate.md`**

Full replacement (frontmatter unchanged):

```markdown
---
name: task-review-gate
description: Enforce the human review checkpoint before implementation starts. Use at session start on an existing task, right after spec-to-backlog created tasks, or when the user asks to implement a specific task: present the task, its pipeline phase and acceptance criteria, and wait for explicit approval before any code.
---

# Task Review Gate: session entry, review gate, resume

Human checkpoint between reviewed specs and the first line of code — and the
re-entry point for every session that continues a running task.

## When this skill runs

1. At the start of a session that works on an existing task (resume).
2. Right after spec-to-backlog created tasks (review specs + acceptance criteria).
3. When the user asks to implement a specific task (restate scope before starting).

## Procedure

1. Load the task: `backlog task view <ID> --plain`.
2. Load the phase: `sbl phase <ID>` (prints `phase/spec|plan|impl|verify` or `none`).
3. Present compactly: goal, every acceptance criterion, dependencies, the
   recorded plan if one exists, and the current phase.
4. STOP and wait for the user's explicit approval. Silence or a topic change
   is NOT approval.
5. After approval, resume per phase:
   - `phase/spec` — review gate passed: advance with `sbl phase <ID> plan`,
     then start the plan-before-code pass.
   - `phase/plan` — plan recorded and approved: advance with
     `sbl phase <ID> impl` once the human approves the plan, then TDD.
   - `phase/impl` — refresh context from the recorded plan and implementation
     notes, then continue TDD where it stopped.
   - `phase/verify` — collect verification evidence (tests/lint/typecheck),
     write the final summary, then `sbl phase <ID> done` at archival.
   - `none` — a task without a phase label is either legacy (offer
     `sbl phase <ID> spec`) or not yet started (walk the review gate first).
6. Set the task In Progress via the backlog CLI when work starts.

## Boundaries

- Never approve the gate yourself; vague consent is not approval.
- Phase changes only via `sbl phase` — never edit labels by hand.
- Trivial edits stay exempt only on explicit user instruction.
- If acceptance criteria look wrong or incomplete, send the user back to task
  editing instead of starting.
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run test/unit/templates.test.ts test/unit/glue-skills.test.ts`
Expected: PASS (the pre-existing assertions — `STOP and wait`, `explicit approval`, `never approve the gate yourself`, `backlog task view`, four rules, nine phases — all still hold against the new content).

- [ ] **Step 7: Commit**

```bash
git add src/templates/workflow-block.md src/templates/skill-spec-to-backlog.md src/templates/skill-task-review-gate.md test/unit/templates.test.ts test/unit/glue-skills.test.ts
git commit -m "feat(phase): teach phase labels in workflow block and glue skills"
```

---

### Task 7: E2E against a real backlog + docs + dogfood refresh

**Files:**
- Create: `test/e2e/phase.e2e.test.ts`
- Create: `docs/guide/pipeline-phases.md`
- Modify: `README.md` (short subsection), VitePress sidebar config (locate via `docs/.vitepress/config.*`), possibly `test/unit/check-pack-list` fixtures if the pack inventory enumerates new files
- Modify (via CLI, not by hand): `AGENTS.md`, `.opencode/skill/`, `.claude/skills/` — refreshed by the local `update` run below

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: green e2e against the real `backlog` CLI, user-facing docs, refreshed own-repo glue files, and the acceptance handoff.

- [ ] **Step 1: Write the e2e test**

Create `test/e2e/phase.e2e.test.ts` (the repo's own `node_modules/.bin/backlog` is the real upstream CLI; prepending it to PATH makes `resolveBacklogBin`'s `where` fallback find it inside the temp project):

```ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', '..', 'dist', 'bin.js');
const REPO = join(__dirname, '..', '..');
const BIN_DIR = join(REPO, 'node_modules', '.bin');

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function scaffold(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'sbl-phase-e2e-'));
  dirs.push(cwd);
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'phase-e2e', private: true }));
  return cwd;
}

function run(cwd: string, cmd: 'backlog' | 'sbl', args: string[]): string {
  const env = {
    ...process.env,
    SBL_SKIP_INSTALL: '1',
    SBL_SKIP_UPDATE_CHECK: '1',
    PATH: BIN_DIR + sep + (process.env.PATH ?? ''),
  };
  if (cmd === 'backlog') {
    return execFileSync(process.execPath, [join(BIN_DIR, 'backlog'), ...args], {
      cwd, env, encoding: 'utf8',
    });
  }
  return execFileSync(process.execPath, [CLI, ...args], { cwd, env, encoding: 'utf8' });
}

function labelsOf(cwd: string, id: string): string[] {
  const out = run(cwd, 'backlog', ['task', 'view', id, '--json']);
  const parsed = JSON.parse(out) as { task: { labels: string[] } };
  return parsed.task.labels;
}

describe('sbl phase e2e (real backlog CLI)', () => {
  it('walks spec -> plan -> impl -> verify -> done', () => {
    const cwd = scaffold();
    run(cwd, 'backlog', ['init', '--defaults']);
    run(cwd, 'backlog', ['task', 'create', 'Phase walker', '-l', 'phase/spec', '--plain']);
    expect(labelsOf(cwd, 'task-1')).toContain('phase/spec');

    expect(run(cwd, 'sbl', ['phase', 'task-1'])).toContain('phase/spec');
    run(cwd, 'sbl', ['phase', 'task-1', 'plan']);
    expect(labelsOf(cwd, 'task-1')).toContain('phase/plan');
    expect(labelsOf(cwd, 'task-1')).not.toContain('phase/spec');

    run(cwd, 'sbl', ['phase', 'task-1', 'impl']);
    run(cwd, 'sbl', ['phase', 'task-1', 'verify']);
    run(cwd, 'sbl', ['phase', 'task-1', 'done']);
    expect(labelsOf(cwd, 'task-1')).toEqual([]);
  });

  it('rejects transitions on tasks without a phase label', () => {
    const cwd = scaffold();
    run(cwd, 'backlog', ['init', '--defaults']);
    run(cwd, 'backlog', ['task', 'create', 'Bare', '--plain']);
    let status = 0;
    try {
      run(cwd, 'sbl', ['phase', 'task-1', 'impl']);
    } catch (err) {
      status = (err as { status?: number }).status ?? 1;
    }
    expect(status).toBe(1);
  });
});
```

Notes: `backlog init --defaults` in a temp dir creates `backlog/config.yml` non-interactively (same call `sbl init` uses); task ids start at `task-1`. If `backlog init` needs git or declines in the temp dir, add `git init` via `execFileSync('git', ['init'], { cwd })` in `scaffold` (the e2e helper `scaffoldProject` in `test/e2e/helpers.ts` does exactly this — mirror it).

- [ ] **Step 2: Run the e2e test**

Run: `npm test`
Expected: PASS. If the pack-list gate (`check-pack-list`) fails because it enumerates files, add the new paths (`docs/guide/pipeline-phases.md`) to its fixture in the same commit.

- [ ] **Step 3: Write `docs/guide/pipeline-phases.md`**

```markdown
---
type: explanation
---

# Pipeline phases

Tasks carry their pipeline phase as a Backlog label — exactly one of
`phase/spec`, `phase/plan`, `phase/impl`, `phase/verify` per task. The label
answers "where does this task stand between review gate and archive?" without
reconstructing context from chat history.

## Lifecycle

| Label | Meaning | Advance when |
|---|---|---|
| `phase/spec` | Created from an approved design; review gate open | Human approved specs + acceptance criteria |
| `phase/plan` | Plan being written or awaiting approval | Human approved the written plan |
| `phase/impl` | TDD implementation running | Implementation complete |
| `phase/verify` | Verification & final summary | Tests/lint green, summary recorded |
| *(removed)* | Done / archived | Merge + archive complete |

## Commands

- `sbl phase TASK-1` — show the current phase
- `sbl phase TASK-1 plan` — advance (or `done` to remove the label)
- `sbl doctor` — reports missing, duplicate, or unknown phase labels

Phase transitions happen at gate passages, driven by the agent or copied from
the dashboard's task-modal chip. Never edit phase labels by hand.

## Dashboard

The Feature Cycle stepper shows live task counts on phases 5–8; the tasks
table and detail modal show a phase chip per task.
```

- [ ] **Step 4: Register the docs page + README mention**

1. Add the page to the VitePress sidebar config under the existing Guides group (open `docs/.vitepress/config.*`, mirror neighboring entries exactly): text `Pipeline phases`, link `/guide/pipeline-phases`.
2. In `README.md`, after the "Model router (opt-in)" section, add:

```markdown
## Pipeline phases

Tasks carry their pipeline phase as a label (`phase/spec` → `phase/plan` → `phase/impl` → `phase/verify`), managed by `sbl phase <task-id> [phase|done]` and checked by `sbl doctor`. The dashboard stepper, task table, and task modal render the live phase. Details: [docs/guide/pipeline-phases.md](docs/guide/pipeline-phases.md).
```

- [ ] **Step 5: Dogfood refresh of this repo's own glue files**

Run:

```bash
npm run build
node ./dist/bin.js update --no-self
```

Expected: `AGENTS.md` block marker advances to the current package version and contains the new phase table + rule 5; `.opencode/skill/` and `.claude/skills/` copies of `spec-to-backlog` and `task-review-gate` match the new templates. Verify:

```bash
git diff --stat
git diff AGENTS.md
```

Then run the full suite once more (`npm test`) — the glue-skills test's "installed backlog-status-report skills" block reads installed copies, so they must stay consistent.

- [ ] **Step 6: Commit**

```bash
git add test/e2e/phase.e2e.test.ts docs/guide/pipeline-phases.md docs/.vitepress README.md AGENTS.md .opencode .claude
git commit -m "feat(phase): e2e coverage, pipeline-phases guide, dogfood refresh"
```

---

## Manual acceptance checklist (user gate — spec R3/R4)

Hand this to the user after Task 7; no automated task may claim it:

1. `node ./dist/bin.js phase task-62 spec` → then `... plan` → observe label swap via `npx backlog task view task-62 --plain`.
2. `node ./dist/bin.js doctor` → legacy warnings for existing In-Progress-without-phase tasks are expected and correct.
3. `node ./dist/bin.js dashboard --no-open` → open `http://127.0.0.1:6428/p/super-backlog/` → stepper badges on phases 5–8, phase chips in the tasks table and modal, `sbl phase ...` copy chip works, SSE reload after a phase change.
4. Walk one real task through spec → plan with the extended task-review-gate skill text.
5. Decision (R4): ship (merge/push/release as a new kit version) or discard (delete the local branch) — the user decides, nobody else.

## Self-Review (completed during planning)

- Spec coverage: P1/P2 → Task 1; P3/P4/P5 → Task 2; P10/P11 → Task 3; P9 (data) → Task 4; P9 (UI) → Task 5; P2/P6/P7/P8 → Tasks 6–7; P12 → markers.ts `START_RE` is version-tolerant (verified: `src/lib/markers.ts:2`) and Task 7 Step 5 exercises the real `update` path against this repo's stale `0.1.0` block; R1–R4 → Global Constraints + acceptance checklist.
- Placeholders: none — every step carries executable code or exact text.
- Type consistency: `Phase`/`PhaseTarget`/`TransitionResult` identical across Tasks 1–3; `DashboardTask.labels/phase` field names consistent between Tasks 4 and 5; `readTaskLabels` signature consistent between doctor deps and its default impl.
