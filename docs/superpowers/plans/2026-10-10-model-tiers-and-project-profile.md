# Model Tiers and Project Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the managed block's three-tier routing section with the four-tier "Model tiers and delegation" rule, and add a per-project profile of critical areas (`backlog/docs/critical-areas.md`) with its skill, doctor check and init hint.

**Architecture:** The block text and the new skill are static Markdown templates under `src/templates/`, rendered and installed by the existing `sbl init` / `sbl update` machinery. A small reader `src/lib/critical-areas.ts` parses the profile's Status line; doctor check 6 and the init hint use it. No router code changes.

**Tech Stack:** TypeScript ESM (Node ≥ 20), Vitest, markdownlint + cspell (`npm run lint`), VitePress docs.

**Spec:** `docs/superpowers/specs/2026-10-10-model-tiers-and-project-profile-design.md` — read it for the full rationale; every exact string below is copied from it.

## Global Constraints

- Block section heading is exactly `### Model tiers and delegation`; the heading `### Model routing for subagents` disappears everywhere (templates, tests, docs).
- Tier names are **Light / Standard / Strong / Top**; Claude Code examples are `haiku` / `sonnet` / `opus` / strongest available (e.g. Fable).
- Rule 6 and rule 8 wording verbatim from the spec (quoted in Task 1).
- `src/templates/workflow-block.md` keeps the pipeline table as its only table whose rows start with `| <number> |` (`test/unit/dashboard-render.test.ts:592-598` parses it); the closing line stays `Add project-specific human gates below the block.`
- The profile path is `backlog/docs/critical-areas.md`; `sbl` never writes or edits it.
- `provisional` (case-insensitive) on the `Status:` line is the only machine-readable marker.
- Doctor check 6: missing file is `[skip]`, not `[warn]`; provisional or missing Status line is `[warn]`; otherwise `[ok]`.
- Both init hints print only on a real (non-dry-run) init, each only while its file is missing, profile hint before summary hint.
- Tests never touch the real `~/.super-backlog` hub or registry and never write to the real clipboard.
- Never hand-edit this repo's `AGENTS.md`, `CLAUDE.md` or installed skills; refresh them with `node dist/bin.js update --no-self`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Do not commit `test/unit/__snapshots__/*.snap` (EOL-only noise) or the untracked `.playwright-mcp/` and `design-demos/`.
- Verification before every commit: `npm test` (runs the build first) and `npm run lint`.

---

### Task 1: Block section, rules 6 and 8, pointer template

**Files:**
- Modify: `src/templates/workflow-block.md:30-49`
- Modify: `src/templates/claude-pointer.md:5-7`
- Test: `test/unit/templates.test.ts:35-53, 86-89`
- Test: `test/e2e/update.e2e.test.ts:65, 117, 122, 128, 167-168`

**Interfaces:**
- Consumes: nothing.
- Produces: the block text that Task 4's docs describe and Task 5 installs into this repo's `AGENTS.md`.

- [ ] **Step 1: Update the template tests to the new wording**

In `test/unit/templates.test.ts` replace the `carries the harness-neutral model routing rule` test (lines 35-46) and the rule-7 ordering assertion (line 52) with:

```ts
  it('carries the four-tier delegation rule', () => {
    expect(t).toContain('### Model tiers and delegation');
    expect(t).not.toContain('Model routing for subagents');
    expect(t).toMatch(/regardless of the session model/);
    for (const tier of ['**Light**', '**Standard**', '**Strong**', '**Top**']) {
      expect(t).toContain(tier);
    }
    expect(t).toMatch(/When unsure between two tiers, take the higher one\./);
    expect(t).toMatch(/Set the model explicitly on every dispatch/);
    expect(t).toMatch(/Delegate only when it pays off/);
    expect(t).toMatch(/do not retry on the same tier/);
    expect(t).toMatch(/"Independent\s+check"/);
    expect(t).toContain('`backlog/docs/critical-areas.md`');
    expect(t).toContain('6. Delegate by tier — every subtask goes to the cheapest model that solves it reliably (see "Model tiers and delegation" below).');
    expect(t).toContain('- Claude Code: the Agent tool\'s `model` parameter — light `haiku`, standard');
    expect(t).toContain('`sonnet`, strong `opus`, top = the strongest available model (e.g. Fable).');
    expect(t).toContain('OpenCode:');
    expect(t).toContain('Other harnesses:');
  });
  it('binds rule 8: respect the project profile, only with consent', () => {
    expect(t).toContain(
      '8. Respect the project profile — read `backlog/docs/critical-areas.md` at session start; its entries override the tier rule. If the file is missing, offer once, before the first non-trivial task, to run the project-profile skill. Never run it without the user\'s consent.',
    );
    expect(t.indexOf('8. Respect the project profile')).toBeGreaterThan(t.indexOf('7. Keep the project summary current'));
    expect(t.indexOf('8. Respect the project profile')).toBeLessThan(t.indexOf('### Model tiers and delegation'));
  });
```

Change line 52 of the rule-7 test to:

```ts
    expect(t.indexOf('7. Keep the project summary current')).toBeLessThan(t.indexOf('8. Respect the project profile'));
```

In the `claude-pointer.md` describe block replace the second test (lines 86-89) with:

```ts
  it('points at the delegation section, the profile and the explicit model parameter', () => {
    expect(p).toContain('"Model tiers and delegation"');
    expect(p).toContain('`backlog/docs/critical-areas.md`');
    expect(p).toContain("Agent tool's `model` explicitly");
  });
```

- [ ] **Step 2: Run the template tests to see them fail**

Run: `npx vitest run test/unit/templates.test.ts`
Expected: FAIL — `### Model tiers and delegation` not found, rule 8 missing, pointer assertion fails.

- [ ] **Step 3: Rewrite the block section**

In `src/templates/workflow-block.md` replace line 30 with:

```markdown
6. Delegate by tier — every subtask goes to the cheapest model that solves it reliably (see "Model tiers and delegation" below).
```

Insert after line 31 (rule 7):

```markdown
8. Respect the project profile — read `backlog/docs/critical-areas.md` at session start; its entries override the tier rule. If the file is missing, offer once, before the first non-trivial task, to run the project-profile skill. Never run it without the user's consent.
```

Replace everything from `### Model routing for subagents` up to (not including) `Project-specific human gates are intentionally out of scope for this block.` with:

```markdown
### Model tiers and delegation

Goal: the best result at the lowest token cost. Every subtask goes to the
cheapest model that solves it reliably, regardless of the session model:
hand simpler work to a subagent on a cheaper model, and harder work to a
subagent on a stronger model when the session runs on a lower tier.

Tiers (see the examples below for current model names; otherwise use the
closest available equivalents):

- **Light** — purely mechanical: searching, listing, extracting, reformatting.
- **Standard** — clearly specified routine work: research, summaries,
  routine code, tests, documentation.
- **Strong** — demanding work with clear boundaries: complex implementation,
  debugging, reviews.
- **Top** — analysis, design, architecture, interpreting ambiguous results,
  every decision where a mistake is costly or hard to reverse, and everything
  `backlog/docs/critical-areas.md` lists as critical.

When unsure between two tiers, take the higher one. In this pipeline:
brainstorming, specs, plans and the final whole-branch review are Top;
per-task reviews and debugging are Strong; fully specified plan steps,
tests and docs are Standard; lookups and Backlog.md CLI bookkeeping are Light.

Delegate only when it pays off: the task is self-contained, can be briefed
completely in a few sentences, and is large enough (many files or sources,
much intermediate output). Do small things and anything that needs the whole
conversation context yourself — there the handover costs more than it saves.

When delegating:

- Brief with goal, required context, limits, done criterion and return
  format. Set the model explicitly on every dispatch; never rely on
  inheriting the session model.
- Returns stay brief: result plus evidence (paths, sources, numbers), no raw
  data or logs.
- Start independent tasks in parallel; never redo delegated work yourself.

Quality: responsibility for the result stays with you. Check returns before
using them, the more carefully the costlier a mistake would be. If a result
falls short, do not retry on the same tier — go one tier up or take over
yourself. Anything `backlog/docs/critical-areas.md` lists under "Independent
check" is additionally checked, before use, by a subagent on Strong or higher
that did not see the work being produced.

If the harness has no subagents or no per-dispatch model choice, work
directly and without mentioning it.

Examples (current as of this super-backlog release):

- Claude Code: the Agent tool's `model` parameter — light `haiku`, standard
  `sonnet`, strong `opus`, top = the strongest available model (e.g. Fable).
- OpenCode: set the tier's model on the subagent, e.g. the `model` field of
  an agent in `.opencode/agents/`.
- Other harnesses: the equivalent per-subagent model setting.

```

Keep the two closing lines (`Project-specific human gates …` / `Add project-specific human gates below the block.`) unchanged.

- [ ] **Step 4: Update the pointer template**

Replace `src/templates/claude-pointer.md` lines 5-7 so the file reads:

```markdown
## Workflow system (managed by super-backlog)

This project uses the combined Backlog.md + Superpowers workflow. Read the
integration block in AGENTS.md (section between SUPER-BACKLOG markers) and follow
it. Tasks are managed exclusively through the `backlog` CLI. Distribute subagent
work by the block's "Model tiers and delegation" section, respect
`backlog/docs/critical-areas.md`, and always pass the Agent tool's `model`
explicitly.
```

- [ ] **Step 5: Update the update E2E test**

In `test/e2e/update.e2e.test.ts`:
- line 65: `.replace(/### Model tiers and delegation[\s\S]*?(?=Project-specific human gates)/, '')`
- line 117: `expect(...).not.toContain('Model tiers and delegation');`
- lines 122, 168: `expect(claude).toContain('"Model tiers and delegation"');`
- lines 128, 167: `expect(agents).toContain('### Model tiers and delegation');`

- [ ] **Step 6: Run the tests and lint**

Run: `npm test` then `npm run lint`
Expected: all green, including `test/unit/dashboard-render.test.ts` (phase table unchanged) and `test/e2e/update.e2e.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/templates/workflow-block.md src/templates/claude-pointer.md test/unit/templates.test.ts test/e2e/update.e2e.test.ts
git commit -m "feat(block): four-tier delegation rule and project-profile rule 8

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Profile reader and doctor check 6

**Files:**
- Create: `src/lib/critical-areas.ts`
- Create: `test/unit/critical-areas.test.ts`
- Modify: `src/commands/doctor.ts:4-32, 182-184`
- Test: `test/unit/doctor.test.ts:28-42` (deps) plus a new describe block
- Test: `test/e2e/doctor.e2e.test.ts:35-55`

**Interfaces:**
- Consumes: `emit`, `DoctorDeps` and the check-5 pattern in `src/commands/doctor.ts`.
- Produces:
  ```ts
  export const CRITICAL_AREAS_PATH = 'backlog/docs/critical-areas.md';
  export type CriticalAreasState =
    | { status: 'missing' }
    | { status: 'present'; provisional: boolean; stamp: string | null };
  export function readCriticalAreas(cwd: string): CriticalAreasState;
  ```
  and `DoctorDeps.readCriticalAreas?: (cwd: string) => CriticalAreasState`. Task 3 imports `CRITICAL_AREAS_PATH`.

- [ ] **Step 1: Write the failing reader tests**

Create `test/unit/critical-areas.test.ts`:

```ts
// test/unit/critical-areas.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CRITICAL_AREAS_PATH, readCriticalAreas } from '../../src/lib/critical-areas.js';

let cwd: string;
const file = (): string => join(cwd, ...CRITICAL_AREAS_PATH.split('/'));
const write = (text: string): void => {
  mkdirSync(join(cwd, 'backlog', 'docs'), { recursive: true });
  writeFileSync(file(), text);
};

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sbl-critical-areas-'));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe('readCriticalAreas', () => {
  it('exports the profile path', () => {
    expect(CRITICAL_AREAS_PATH).toBe('backlog/docs/critical-areas.md');
  });

  it('reports a missing file', () => {
    expect(readCriticalAreas(cwd)).toEqual({ status: 'missing' });
  });

  it('reads the Status line as the stamp', () => {
    write('# Critical areas\n\nStatus: 2026-10-10, created with Fable 5.1\n\nAlways on the top tier:\n- Payments: refunds\n');
    expect(readCriticalAreas(cwd)).toEqual({
      status: 'present',
      provisional: false,
      stamp: '2026-10-10, created with Fable 5.1',
    });
  });

  it('flags provisional regardless of case', () => {
    write('# Critical areas\r\nStatus: 2026-10-10, created with Sonnet, PROVISIONAL\r\n');
    expect(readCriticalAreas(cwd)).toEqual({
      status: 'present',
      provisional: true,
      stamp: '2026-10-10, created with Sonnet, PROVISIONAL',
    });
  });

  it('returns a null stamp without a Status line', () => {
    write('# Critical areas\n\nAlways on the top tier:\n- Payments\n');
    expect(readCriticalAreas(cwd)).toEqual({ status: 'present', provisional: false, stamp: null });
  });

  it('never throws on a directory at the path', () => {
    mkdirSync(file(), { recursive: true });
    expect(readCriticalAreas(cwd)).toEqual({ status: 'present', provisional: false, stamp: null });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/unit/critical-areas.test.ts`
Expected: FAIL — module `src/lib/critical-areas.js` not found.

- [ ] **Step 3: Implement the reader**

Create `src/lib/critical-areas.ts`:

```ts
// src/lib/critical-areas.ts
// Reads backlog/docs/critical-areas.md, the per-project profile of areas that
// always run on the top tier (spec 2026-10-10). Only the Status line is parsed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CRITICAL_AREAS_PATH = 'backlog/docs/critical-areas.md';

export type CriticalAreasState =
  | { status: 'missing' }
  | { status: 'present'; provisional: boolean; stamp: string | null };

/** Never throws: an unreadable file (for example a directory) is present with a null stamp. */
export function readCriticalAreas(cwd: string): CriticalAreasState {
  const path = join(cwd, ...CRITICAL_AREAS_PATH.split('/'));
  if (!existsSync(path)) return { status: 'missing' };
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { status: 'present', provisional: false, stamp: null };
  }
  const line = text.split(/\r?\n/).find((l) => l.startsWith('Status:'));
  if (line === undefined) return { status: 'present', provisional: false, stamp: null };
  const stamp = line.slice('Status:'.length).trim();
  return { status: 'present', provisional: /\bprovisional\b/i.test(stamp), stamp };
}
```

- [ ] **Step 4: Run the reader tests**

Run: `npx vitest run test/unit/critical-areas.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing doctor tests**

In `test/unit/doctor.test.ts` add to the `makeDeps` defaults (after `detectDrift: ...`):

```ts
    readCriticalAreas: () => ({ status: 'present', provisional: false, stamp: '2026-10-10, created with Fable 5.1' }),
```

Append a new describe block at the end of the file:

```ts
describe('check 6: critical-areas.md', () => {
  it('passes on a profile with a stamp', () => {
    const d = makeDeps();
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines).toContain('[ok]   backlog/docs/critical-areas.md present (2026-10-10, created with Fable 5.1)');
  });

  it('is skipped when the file is absent and keeps exit 0', () => {
    const d = makeDeps({ readCriticalAreas: () => ({ status: 'missing' }) });
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines).toContain('[skip] backlog/docs/critical-areas.md not present (ask your agent to run the project-profile skill)');
  });

  it('warns and exits 4 on a provisional profile', () => {
    const d = makeDeps({ readCriticalAreas: () => ({ status: 'present', provisional: true, stamp: '2026-10-10, created with Sonnet, provisional' }) });
    expect(runDoctor('/proj', d)).toBe(4);
    expect(d.lines).toContain('[warn] backlog/docs/critical-areas.md is provisional – revise it on the top tier (project-profile skill)');
  });

  it('warns and exits 4 without a Status line', () => {
    const d = makeDeps({ readCriticalAreas: () => ({ status: 'present', provisional: false, stamp: null }) });
    expect(runDoctor('/proj', d)).toBe(4);
    expect(d.lines).toContain('[warn] backlog/docs/critical-areas.md has no Status line – run the project-profile skill');
  });

  it('turns a throwing reader into a warning', () => {
    const d = makeDeps({ readCriticalAreas: () => { throw new Error('boom'); } });
    expect(runDoctor('/proj', d)).toBe(4);
    expect(d.lines).toContain('[warn] backlog/docs/critical-areas.md check failed (boom)');
  });
});
```

Note the `[ok]` mark is `'[ok]  '` (two trailing spaces) plus one separator space, so the ok line starts with `[ok]   ` (three spaces); the other marks are followed by one space.

- [ ] **Step 6: Run the doctor tests to see them fail**

Run: `npx vitest run test/unit/doctor.test.ts`
Expected: FAIL — `readCriticalAreas` is not a known dep / check 6 lines missing.

- [ ] **Step 7: Implement check 6**

In `src/commands/doctor.ts` add the import after line 14:

```ts
import { CRITICAL_AREAS_PATH, readCriticalAreas, type CriticalAreasState } from '../lib/critical-areas.js';
```

Add to `DoctorDeps` after `detectDrift`:

```ts
  /** Seam for check 6; defaults to reading backlog/docs/critical-areas.md. */
  readCriticalAreas?: (cwd: string) => CriticalAreasState;
```

Insert before `log(\`doctor summary: ...\`)` (currently line 184):

```ts
  // check 6: per-project profile of critical areas (spec 2026-10-10). A
  // missing file is a skip so existing projects keep their exit code.
  let profile: CriticalAreasState | null = null;
  try {
    profile = (deps.readCriticalAreas ?? readCriticalAreas)(cwd);
  } catch (err) {
    emit('warn', `${CRITICAL_AREAS_PATH} check failed (${err instanceof Error ? err.message : String(err)})`);
  }
  if (profile !== null) {
    if (profile.status === 'missing') {
      emit('skip', `${CRITICAL_AREAS_PATH} not present (ask your agent to run the project-profile skill)`);
    } else if (profile.provisional) {
      emit('warn', `${CRITICAL_AREAS_PATH} is provisional – revise it on the top tier (project-profile skill)`);
    } else if (profile.stamp === null) {
      emit('warn', `${CRITICAL_AREAS_PATH} has no Status line – run the project-profile skill`);
    } else {
      emit('ok', `${CRITICAL_AREAS_PATH} present (${profile.stamp})`);
    }
  }
```

The `–` in the warn lines is an en dash (U+2013), like the check-5 drift line.

- [ ] **Step 8: Make the doctor E2E tolerate the new skip line**

`expectCleanExceptDrift` in `test/e2e/doctor.e2e.test.ts` only forbids `[warn]`, so a `[skip]` from check 6 already passes. Add one assertion inside it, after `expect(rest).toContain('[ok]');`:

```ts
  expect(rest).toMatch(/backlog\/docs\/critical-areas\.md (present|not present)/);
```

(This repo gets its profile in Task 5; until then the line is the skip line.)

- [ ] **Step 9: Run the tests and lint**

Run: `npm test` then `npm run lint`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/lib/critical-areas.ts test/unit/critical-areas.test.ts src/commands/doctor.ts test/unit/doctor.test.ts test/e2e/doctor.e2e.test.ts
git commit -m "feat(doctor): check 6 reads the critical-areas profile

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Skill template, skill installation, init hint

**Files:**
- Create: `src/templates/skill-project-profile.md`
- Modify: `src/init/execute.ts:164`
- Modify: `src/commands/init.ts:14, 34-36, 197`
- Test: `test/unit/glue-skills.test.ts:65-76` plus a new describe block
- Test: `test/integration/init-preflight.test.ts:7, 192-239`

**Interfaces:**
- Consumes: `CRITICAL_AREAS_PATH` from `src/lib/critical-areas.ts` (Task 2).
- Produces: `export const INIT_PROFILE_HINT` in `src/commands/init.ts`; the skill installed at `.claude/skills/project-profile/SKILL.md` and `.opencode/skill/project-profile/SKILL.md` (Task 5 installs it here).

- [ ] **Step 1: Write the failing skill-template tests**

In `test/unit/glue-skills.test.ts`, inside `describe('all glue skills exist', …)`, rename the test `all four glue skill templates are present` to `all five glue skill templates are present` and add `'skill-project-profile.md'` to its list. Append at the end of the file:

```ts
describe('skill-project-profile.md', () => {
  const t = read('skill-project-profile.md');
  it('has frontmatter with name and description', () => {
    expect(t.startsWith('---')).toBe(true);
    expect(t).toMatch(/^name: project-profile$/m);
    expect(t).toMatch(/^description: .+/m);
  });
  it('writes the profile file in the spec format', () => {
    expect(t).toContain('backlog/docs/critical-areas.md');
    expect(t).toContain('# Critical areas');
    expect(t).toContain('Always on the top tier:');
    expect(t).toContain('Independent check:');
    expect(t).toContain('May go to lower tiers:');
    expect(t).toMatch(/150 words/);
  });
  it('keeps the assessment on the top tier and marks drafts provisional', () => {
    expect(t).toMatch(/top-tier work only/i);
    expect(t).toMatch(/hand both to a subagent on the top tier/i);
    expect(t).toContain('`provisional`');
  });
  it('stops for review and never invents risks', () => {
    expect(t).toMatch(/STOP/);
    expect(t).toMatch(/never invent risks/i);
    expect(t).toMatch(/do not re-check the profile every session/i);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/unit/glue-skills.test.ts`
Expected: FAIL — `skill-project-profile.md` does not exist.

- [ ] **Step 3: Write the skill template**

Create `src/templates/skill-project-profile.md` (frontmatter values must stay plain scalars without `: ` or ` #`, see `test/unit/templates.test.ts:95-118`):

```markdown
---
name: project-profile
description: Create or revise backlog/docs/critical-areas.md, the project profile that names the areas where work always runs on the top tier. Use when the file is missing, the user asks for it, the project changed substantially, a misclassification caused a mistake, or sbl doctor reports the profile as provisional.
---

# Project Profile: name the critical areas of this project

Writes `backlog/docs/critical-areas.md`. The managed AGENTS.md block tells
every agent to read it at session start: everything it lists runs on the top
tier, and everything under "Independent check" is verified by a second
subagent before use. Guide:
<https://adam-s-k-i.github.io/super-backlog/guide/project-profile>.

## When this skill runs

- `backlog/docs/critical-areas.md` is missing (offered once per block rule 8).
- The user asks for it.
- The project changed substantially: new modules, new risks, going live.
- A misclassification caused a mistake.
- A provisional profile can now be judged better, or `sbl doctor` reports it
  as provisional.

## Procedure

1. Tier check. Assessment and wording are top-tier work only. If the session
   runs on a lower tier, hand both to a subagent on the top tier; fact
   gathering (step 2) may go to Light or Standard. If no top-tier model is
   available, write a draft, end the Status line with `provisional`, and tell
   the user once that it should be revised with the strongest model.
2. Targeted overview, no full reading: project description, existing
   instructions (AGENTS.md, CLAUDE.md), README, directory layout, central
   modules, and `backlog/docs/architecture.yml` if present.
3. Guiding question: where would a mistake go unnoticed and be costly or hard
   to reverse? Check at least: money, law, security and credentials, data loss
   and other irreversible actions, external visibility, decision-relevant
   metrics, structural choices with long-term consequences.
4. Look specifically for work that looks like routine but silently determines
   results; the general tier rule does not catch these cases.
5. Name explicitly what may go to lower tiers.
6. If the project is too empty to judge, derive the profile from the user's
   description and mark it `provisional`.
7. Write `backlog/docs/critical-areas.md` in this format, at most 150 words
   below the Status line, 4 to 7 items grouped by risk area (not by activity),
   `Independent check:` only when something is irreversible:

   ```markdown
   # Critical areas

   Status: 2026-10-10, created with Fable 5.1, provisional

   Always on the top tier:
   - Payments: refund flow in src/billing, Stripe webhook handlers
   - Data loss: migrations in db/migrate, anything deleting customer records
   - Credentials: .env handling, OAuth token storage
   - Public release: npm publish, release notes

   Independent check: migrations, release publishing

   May go to lower tiers: UI copy, test fixtures, docs, formatting, lookups
   ```

   The Status line holds the date and the model that wrote the file; append
   `provisional` only in the cases above.
8. Show the file once and STOP until the user approves it. If the file cannot
   be written, print it and ask the user to add it.

## Maintenance

Do not re-check the profile every session. Revise it, on the top tier, only on
the triggers listed under "When this skill runs".

## Boundaries

- Only touch `backlog/docs/critical-areas.md`.
- Never invent risks the project does not show; every item names something
  real in the project.
- Keep the 150-word limit; English heading and keys, body in the language the
  user works in.
- Never downgrade something the user marked as critical.
```

- [ ] **Step 4: Register the skill**

In `src/init/execute.ts` line 164:

```ts
const GLUE_SKILLS = ['spec-to-backlog', 'backlog-status-report', 'task-review-gate', 'architecture-summary', 'project-profile'] as const;
```

- [ ] **Step 5: Run the skill tests**

Run: `npx vitest run test/unit/glue-skills.test.ts test/unit/templates.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing init-hint tests**

In `test/integration/init-preflight.test.ts` change line 7 to:

```ts
import { INIT_PROFILE_HINT, INIT_SUMMARY_HINT, runInit, type ParsedArgs } from '../../src/commands/init.js';
```

Replace the test `ends with the architecture-summary hint while architecture.yml is missing` (lines 192-207) with:

```ts
  it('ends with the profile hint then the summary hint while both files are missing', async () => {
    const cwd = tempCwd('hint');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit(cwd, args(), { preflight: () => okResult(), doctor: () => 0 });
      expect(INIT_PROFILE_HINT).toBe(
        'next step: ask your agent to run the project-profile skill (writes backlog/docs/critical-areas.md, the areas that always run on the top tier)',
      );
      expect(INIT_SUMMARY_HINT).toBe(
        'next step: ask your agent to run the architecture-summary skill (writes backlog/docs/architecture.yml for the summary page)',
      );
      const lines = spy.mock.calls.map((c) => String(c[0]));
      expect(lines.slice(-2)).toEqual([INIT_PROFILE_HINT, INIT_SUMMARY_HINT]);
      expect(lines.findIndex((l) => l.startsWith('super-backlog init complete'))).toBeLessThan(lines.indexOf(INIT_PROFILE_HINT));
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('prints no profile hint when critical-areas.md exists', async () => {
    const cwd = tempCwd('hint-profile-present');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit(cwd, args(), {
        preflight: () => okResult(),
        doctor: (c) => {
          mkdirSync(join(c, 'backlog', 'docs'), { recursive: true });
          writeFileSync(join(c, 'backlog', 'docs', 'critical-areas.md'), '# Critical areas\n\nStatus: today\n');
          return 0;
        },
      });
      const lines = spy.mock.calls.map((c) => String(c[0]));
      expect(lines).not.toContain(INIT_PROFILE_HINT);
      expect(lines).toContain(INIT_SUMMARY_HINT);
    } finally {
      spy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });
```

Extend the existing `prints no hint on --dry-run` test with one line after its existing assertion:

```ts
      expect(spy.mock.calls.map((c) => String(c[0]))).not.toContain(INIT_PROFILE_HINT);
```

- [ ] **Step 7: Run it to see it fail**

Run: `npx vitest run test/integration/init-preflight.test.ts`
Expected: FAIL — `INIT_PROFILE_HINT` is not exported.

- [ ] **Step 8: Implement the hint**

In `src/commands/init.ts` add after line 14:

```ts
import { CRITICAL_AREAS_PATH } from '../lib/critical-areas.js';
```

After `INIT_SUMMARY_HINT` (line 36) add:

```ts
/** spec 2026-10-10: printed before the summary hint while the project has no critical-areas profile. */
export const INIT_PROFILE_HINT =
  'next step: ask your agent to run the project-profile skill (writes backlog/docs/critical-areas.md, the areas that always run on the top tier)';
```

Replace line 197 with:

```ts
    if (!existsSync(join(cwd, ...CRITICAL_AREAS_PATH.split('/')))) console.log(INIT_PROFILE_HINT);
    if (!existsSync(join(cwd, ...ARCHITECTURE_PATH.split('/')))) console.log(INIT_SUMMARY_HINT);
```

- [ ] **Step 9: Run the tests and lint**

Run: `npm test` then `npm run lint`
Expected: all green. If cspell flags a word in the new template, add it to the project's cspell word list (`cspell.json` or `.cspell.json` at the repo root) rather than rewording the spec text.

- [ ] **Step 10: Commit**

```bash
git add src/templates/skill-project-profile.md src/init/execute.ts src/commands/init.ts test/unit/glue-skills.test.ts test/integration/init-preflight.test.ts
git commit -m "feat(init): project-profile skill and critical-areas init hint

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Include the cspell word list file in `git add` if Step 9 changed it.)

---

### Task 4: Docs

**Files:**
- Create: `docs/guide/project-profile.md`
- Modify: `docs/.vitepress/config.mts:26-27`
- Modify: `docs/guide/harness-support.md:17, 20-24`
- Modify: `docs/guide/quickstart.md:42, 58`
- Modify: `README.md:44, 92`

**Interfaces:**
- Consumes: the block text (Task 1), check 6 lines (Task 2), the skill and hint (Task 3).
- Produces: nothing code-facing.

- [ ] **Step 1: Write the new guide page**

Create `docs/guide/project-profile.md`:

```markdown
# Project profile

`backlog/docs/critical-areas.md` names the parts of a project where a mistake
would go unnoticed and be costly or hard to reverse. The managed `AGENTS.md`
block tells every agent to read it at session start: whatever it lists always
runs on the top model tier, and whatever it lists under "Independent check" is
verified by a second subagent before the result is used. See
[Harness support](harness-support#model-tiers-and-delegation-all-harnesses)
for the tier rule itself.

## Format

English heading and keys, body in the language you work in, at most 150 words
below the Status line, grouped by risk area rather than by activity:

```markdown
# Critical areas

Status: 2026-10-10, created with Fable 5.1, provisional

Always on the top tier:
- Payments: refund flow in src/billing, Stripe webhook handlers
- Data loss: migrations in db/migrate, anything deleting customer records
- Credentials: .env handling, OAuth token storage
- Public release: npm publish, release notes

Independent check: migrations, release publishing

May go to lower tiers: UI copy, test fixtures, docs, formatting, lookups
```

- `Always on the top tier:` holds 4 to 7 items with concrete examples.
- `Independent check:` lists irreversible operations; leave the line out when
  there are none.
- `May go to lower tiers:` names uncritical kinds of work so that not
  everything gets escalated.
- `provisional` at the end of the Status line means the profile was drafted
  below the top tier or from a description only and should be revised on the
  top tier. It is the only part of the file that `sbl` reads.

## Creating it

Let your agent write it. `sbl init` and `sbl update` install the
`project-profile` skill for Claude Code and OpenCode, and the block's rule 8
makes the agent offer it once while the file is missing — it never runs
without your consent. The skill does the assessment on the top tier (or hands
it to a top-tier subagent), gathers facts from your instructions, README,
layout and central modules, writes the file and stops for your review. While
the file is missing, `sbl init` ends with a hint to ask your agent for it.

## Keeping it current

The profile is not re-checked every session. Ask for a revision when the
project changes substantially (new modules, new risks, going live), when a
misclassification caused a mistake, or when a provisional profile can now be
judged better.

```bash
sbl doctor
```

Check 6 reads the file: `[skip]` while it is missing, `[warn]` (exit 4) when
the Status line says `provisional` or is absent, `[ok]` otherwise. `sbl` never
writes or edits the file.
```

- [ ] **Step 2: Add the page to the sidebar**

In `docs/.vitepress/config.mts` insert after line 26 (`Project summary`):

```ts
          { text: 'Project profile', link: '/guide/project-profile' },
```

- [ ] **Step 3: Update harness-support.md**

Line 17: replace `and its model-routing rule` with `, its delegation rule and the project profile`.

Replace lines 20-24 with:

```markdown
## Model tiers and delegation (all harnesses)

The managed `AGENTS.md` block carries a harness-neutral "Model tiers and delegation" section. Every subtask goes to the cheapest model that solves it reliably, picked from four tiers: **Light** (mechanical: searching, listing, extracting), **Standard** (clearly specified routine work: research, routine code, tests, docs), **Strong** (complex implementation, debugging, reviews) and **Top** (analysis, design, architecture, decisions where a mistake is costly, and everything the [project profile](project-profile) lists). When unsure, the agent takes the higher tier. The section also says when delegation pays off, how to brief a subagent (goal, context, limits, done criterion, return format), that returns stay brief, that a result that falls short goes one tier up instead of being retried, and that anything the profile lists under "Independent check" is verified by a second subagent on Strong or higher. Short examples name the per-harness setting: for Claude Code the Agent tool's `model` parameter (`haiku`, `sonnet`, `opus`, strongest available), for OpenCode the agent's `model` field.

The rule applies regardless of the session model and is always on. Projects that want different behavior add their own rule below the block. It is independent of the opt-in model router (`sbl models`).
```

- [ ] **Step 4: Update quickstart.md**

Replace line 42 with:

```markdown
Every initialized project also gets a binding delegation rule in its `AGENTS.md` block: every subtask goes to the cheapest of four model tiers that solves it reliably, and the project's `backlog/docs/critical-areas.md` names what always stays on the top tier. After a real init, `sbl` prints a next step to ask your agent for that profile (and for the summary page's `architecture.yml`) while the files are missing. This rule is independent of the opt-in router.
```

Replace line 58 with:

```markdown
| `sbl doctor` | Check Node, PowerShell policy, the `backlog` CLI, phase-label hygiene, the summary page's `architecture.yml`, and the `critical-areas.md` project profile. |
```

- [ ] **Step 5: Update README.md**

Line 44:

```markdown
| `sbl doctor` | Check Node, PowerShell policy, the `backlog` CLI, phase-label hygiene, `architecture.yml` and the `critical-areas.md` project profile. |
```

Line 92: replace `[Design doc](docs/superpowers/specs/2026-08-26-sbl-model-router-design.md).` with `Independent of the block's always-on delegation rule, see [Harness support](https://adam-s-k-i.github.io/super-backlog/guide/harness-support).`

- [ ] **Step 6: Lint and build the docs**

Run: `npm run lint`
Expected: PASS (markdownlint and cspell; add new words to the cspell word list if flagged).
Run: `npx vitepress build docs` (only if `vitepress` is in `node_modules/.bin`; otherwise skip and say so in the report)
Expected: build succeeds, no dead-link error.

- [ ] **Step 7: Commit**

```bash
git add docs/guide/project-profile.md docs/.vitepress/config.mts docs/guide/harness-support.md docs/guide/quickstart.md README.md
git commit -m "docs: project profile guide and four-tier delegation rule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Dogfood this repository

**Files:**
- Modify (via CLI only): `AGENTS.md`, `CLAUDE.md`, `.claude/skills/*/SKILL.md`, `.opencode/skill/*/SKILL.md`
- Create: `backlog/docs/critical-areas.md`
- Modify: `backlog/docs/architecture.yml:36, 58`
- Test: `test/e2e/doctor.e2e.test.ts` (runs against the repo root)

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: a clean `sbl doctor` (check 6 `[ok]`) and `sbl summary --check` on this repo.

This task is the controller's own job on the top tier (the profile assessment is top-tier work by the spec); do not dispatch it to a lower tier.

- [ ] **Step 1: Refresh the managed glue**

Run: `npm run build` then `node dist/bin.js update --no-self`
Expected: exit 0 or 4; `AGENTS.md` now contains `### Model tiers and delegation` and rule 8, `CLAUDE.md` names the new section, and `.claude/skills/project-profile/SKILL.md` plus `.opencode/skill/project-profile/SKILL.md` exist. Check with:

```bash
grep -n "Model tiers and delegation\|8. Respect the project profile" AGENTS.md CLAUDE.md && ls .claude/skills/project-profile .opencode/skill/project-profile
```

- [ ] **Step 2: Write this repo's profile**

Follow the installed `project-profile` skill on the top tier. Expected content (adjust to what the codebase shows; stay within 150 words below the Status line; `Status: 2026-10-10, created with Fable 5.1` without `provisional`):

```markdown
# Critical areas

Status: 2026-10-10, created with Fable 5.1

Always on the top tier:
- Release and publish: release-please config, release workflow, anything that changes what `npm publish` ships
- Managed blocks in user repos: `src/lib/markers.ts`, `src/lib/pointer.ts`, `injectBlock`/`refreshPointer` — a wrong edit destroys user content in AGENTS.md or CLAUDE.md
- Ownership and uninstall: `src/lib/ownership.ts`, `src/commands/uninstall.ts` — deleting files that are not ours
- Hub registry and guard hook: `~/.super-backlog` registry writes, `src/guard/`, hook installation into `.claude/settings.json`
- Model-router installs: files written into user `.claude/` and `.opencode/` directories

Independent check: release and publish, uninstall paths, marker and pointer rewrites

May go to lower tiers: dashboard rendering, docs, template wording, test scaffolding, backlog bookkeeping
```

Show the file to the user and STOP for approval before committing (skill step 8).

- [ ] **Step 3: Update architecture.yml**

In `backlog/docs/architecture.yml`:
- line 36 (`cli` node `files`): append `src/lib/critical-areas.ts` so the list ends `…, src/lib/preflight.ts, src/lib/critical-areas.ts]`.
- line 58 (`executor` node `files`): append `src/templates/skill-project-profile.md` so the list reads `[src/init/execute.ts, src/lib/atomic.ts, src/templates/, src/templates/skill-project-profile.md]`.

- [ ] **Step 4: Verify**

Run:

```bash
node dist/bin.js doctor
node dist/bin.js summary --check
npm test
npm run lint
```

Expected: doctor prints `[ok]   backlog/docs/critical-areas.md present (2026-10-10, created with Fable 5.1)` and exits 0 or 4 only for the check-5 drift line; `summary --check` exits 0; tests and lint green.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CLAUDE.md .claude/skills .opencode/skill backlog/docs/critical-areas.md backlog/docs/architecture.yml
git commit -m "chore: dogfood four-tier block, project profile and refreshed glue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Do not stage `test/unit/__snapshots__/*.snap`, `.playwright-mcp/` or `design-demos/`.
