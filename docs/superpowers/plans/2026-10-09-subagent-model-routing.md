# Subagent Model Routing Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every project set up by super-backlog carries a binding, harness-neutral rule to delegate less demanding work to subagents on cheaper models, and `sbl init`/`sbl update` keep both the AGENTS.md block and the CLAUDE.md pointer current.

**Architecture:** The rule lives as a new subsection in the managed AGENTS.md workflow block (`src/templates/workflow-block.md`), linked from a new binding rule 6. It reaches existing projects through the existing `inject-agents-block` action. The CLAUDE.md pointer template gains one sentence. `applyClaudePointer` changes from write-once to refresh-in-place, driven by a new pure helper module `src/lib/pointer.ts` that `uninstall` shares.

**Tech Stack:** TypeScript (ESM, Node >= 20), Vitest, tsc. e2e tests run against `dist/` (build first).

**Spec:** `docs/superpowers/specs/2026-10-09-subagent-model-routing-design.md`

## Global Constraints

- Rule text, binding rule 6 and pointer text are copied **verbatim** from the spec (sections "Rule text", "Pointer text").
- `src/templates/workflow-block.md` must contain no table rows of the shape `| <number> |` other than the nine pipeline rows (`test/unit/dashboard-render.test.ts` reads them).
- Templates contain no `TBD` or `TODO`.
- Always on: no flag, no config key, no opt-out.
- The model router (`sbl models`, `sbl-worker` agents) is not touched.
- CLAUDE.md creation/append behaviour is unchanged; only an existing pointer section is now refreshed.
- Content under any heading other than the pointer heading is never modified.
- Branch `feat/subagent-model-routing`. Local commits only — never `git push`.
- Never hand-edit Backlog task markdown; use the `backlog` CLI (`npx --no-install backlog` on this machine).
- Windows/PowerShell: no `&&`; run commands one per line. e2e tests need `npm run build` first.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/templates/workflow-block.md` | Managed AGENTS.md block | Add binding rule 6 and the "Model routing for subagents" subsection |
| `src/templates/claude-pointer.md` | CLAUDE.md pointer section | Add the routing sentence |
| `src/lib/pointer.ts` | **New.** Pure pointer-section logic: heading regex, section lookup, refresh | Create |
| `src/init/execute.ts` | Applies actions | `applyClaudePointer` uses `refreshPointer`; `POINTER_HEADING_RE` moves to `src/lib/pointer.ts` |
| `src/commands/uninstall.ts` | Uninstall | `removePointerSection` uses `findPointerSection`; import regex from `src/lib/pointer.ts` |
| `test/unit/templates.test.ts` | Template assertions | Routing rule + pointer assertions |
| `test/unit/pointer.test.ts` | **New.** Unit tests for `src/lib/pointer.ts` | Create |
| `test/e2e/update.e2e.test.ts` | `sbl update` e2e | Stale pointer + block refresh, idempotency, uninstall after refresh |
| `docs/guide/harness-support.md`, `docs/guide/quickstart.md`, `README.md` | User docs | Describe the rule and the pointer refresh |
| `AGENTS.md`, `CLAUDE.md` (repo root) | Dogfood | Refresh via local build; remove hand-written routing sections (M9) |

---

### Task 1: Routing rule in the workflow block and pointer templates

**Files:**
- Modify: `src/templates/workflow-block.md:23-32`
- Modify: `src/templates/claude-pointer.md` (whole file)
- Test: `test/unit/templates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the block text contains `### Model routing for subagents` and the line `6. Delegate by tier — …`. The pointer template contains `"Model routing for subagents"` and exactly one heading line. Task 2's e2e tests assert on these strings.

- [ ] **Step 1: Write the failing tests**

In `test/unit/templates.test.ts`, add inside `describe('workflow-block.md', …)` after the `'maps phases to labels and mandates sbl phase'` test:

```ts
  it('carries the harness-neutral model routing rule', () => {
    expect(t).toContain('### Model routing for subagents');
    expect(t).toMatch(/regardless of which model the current session runs on/);
    for (const tier of ['**Light**', '**Standard**', '**Top**']) {
      expect(t).toContain(tier);
    }
    expect(t).toMatch(/Set the model explicitly on every dispatch/);
    expect(t).toMatch(/^6\. Delegate by tier/m);
    expect(t).toContain('Claude Code:');
    expect(t).toContain('OpenCode:');
    expect(t).toContain('Other harnesses:');
  });
  it('keeps the project-gates note as the closing line', () => {
    expect(t.trimEnd().endsWith('Add project-specific human gates below the block.')).toBe(true);
  });
```

Replace the `describe('claude-pointer.md', …)` block with:

```ts
describe('claude-pointer.md', () => {
  const p = read('claude-pointer.md');
  it('points at the AGENTS.md block', () => {
    expect(p).toMatch(/AGENTS\.md/);
  });
  it('points at the model routing section and the explicit model parameter', () => {
    expect(p).toContain('"Model routing for subagents"');
    expect(p).toContain("Agent tool's `model` explicitly");
  });
  it('is a single section (refresh ends the section at the next heading)', () => {
    expect(p.match(/^#{1,6}\s/gm)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run test/unit/templates.test.ts`
Expected: FAIL in `carries the harness-neutral model routing rule` and `points at the model routing section and the explicit model parameter`. All other tests PASS.

- [ ] **Step 3: Update `src/templates/workflow-block.md`**

Replace lines 23–32 (from `### Binding rules` to the end of the file) with:

```markdown
### Binding rules

1. No task, no code — trivial edits only on explicit user instruction.
2. Plan before code — implementation starts only after an approved written plan.
3. Task status changes always go through the CLI backed by verification evidence, never from memory.
4. Skills take precedence over habit whenever a matching skill exists.
5. Phase transitions only via `sbl phase <id> <phase>`, always at a gate passage — never edit phase labels by hand.
6. Delegate by tier — less demanding work goes to subagents on cheaper models (see "Model routing for subagents" below).

### Model routing for subagents

Applies always, regardless of which model the current session runs on.

1. Delegate less demanding work to a subagent on a cheaper model instead of doing it on the top tier. Set the model explicitly on every dispatch; never rely on inheriting the session model.
2. Pick the tier by complexity:
   - **Light**: routine, mechanical work (searches and file reading, running tests, lint/format/typo fixes, doc and changelog edits, Backlog.md CLI bookkeeping, fully specified plan steps).
   - **Standard**: moderately complex work (plan tasks that need judgement, per-task reviews, debugging with a clear reproduction, non-trivial refactors).
   - **Top**: only where its depth is needed (brainstorming and design, specs and plans, final whole-branch reviews, problems a cheaper tier could not solve).
3. When unsure, start one tier lower and escalate if the result falls short.
4. If the harness has no subagents or no per-dispatch model choice, this rule does not apply.

Examples (current as of this super-backlog release):

- Claude Code: the Agent tool's `model` parameter: light `sonnet`, standard `opus`, top = the strongest available model (e.g. Fable).
- OpenCode: set a cheaper model on the subagent, e.g. the `model` field of an agent in `.opencode/agents/`.
- Other harnesses: the equivalent per-subagent model setting.

Project-specific human gates are intentionally out of scope for this block.
Add project-specific human gates below the block.
```

- [ ] **Step 4: Replace `src/templates/claude-pointer.md`**

Whole file content:

```markdown
## Workflow system (managed by super-backlog)

This project uses the combined Backlog.md + Superpowers workflow. Read the
integration block in AGENTS.md (section between SUPER-BACKLOG markers) and follow
it. Tasks are managed exclusively through the `backlog` CLI. Distribute subagent
work by the block's "Model routing for subagents" section and always pass the
Agent tool's `model` explicitly.
```

- [ ] **Step 5: Run the template and dashboard-render tests**

Run: `npx vitest run test/unit/templates.test.ts test/unit/dashboard-render.test.ts`
Expected: PASS, including `stays consistent with the injected workflow-block.md phase table`.

If the test run rewrote line endings in `test/unit/__snapshots__/dashboard-render.test.ts.snap`, revert it with `git checkout -- test/unit/__snapshots__/dashboard-render.test.ts.snap`.

- [ ] **Step 6: Lint the templates**

Run: `npx markdownlint-cli2 src/templates/workflow-block.md src/templates/claude-pointer.md`
Run: `npx cspell --no-progress src/templates/workflow-block.md src/templates/claude-pointer.md`
Expected: no findings. If cspell flags a word that is spelled correctly (e.g. a product name), add it to the project's cspell word list. Do not change the rule wording.

- [ ] **Step 7: Commit**

```bash
git add src/templates/workflow-block.md src/templates/claude-pointer.md test/unit/templates.test.ts
git commit -m "feat(templates): add harness-neutral model routing rule to the workflow block" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Refresh the CLAUDE.md pointer in place

**Files:**
- Create: `src/lib/pointer.ts`
- Modify: `src/init/execute.ts:40` (remove `POINTER_HEADING_RE`), `src/init/execute.ts:155-164` (`applyClaudePointer`)
- Modify: `src/commands/uninstall.ts:7` (imports), `src/commands/uninstall.ts:49-63` (`removePointerSection`)
- Test: `test/unit/pointer.test.ts` (create), `test/e2e/update.e2e.test.ts`

**Interfaces:**
- Consumes: the pointer template from Task 1 (one heading; contains `"Model routing for subagents"`). The block subsection from Task 1 (`### Model routing for subagents`, `6. Delegate by tier`).
- Produces (`src/lib/pointer.ts`):
  - `export const POINTER_HEADING_RE: RegExp`, the same regex as today: `/^##\s+Workflow system \(managed by super-backlog\)\s*$/m`.
  - `export interface PointerSection { start: number; end: number }`. These are line indices into `content.split('\n')`: `start` is the heading line, and `end` is exclusive (the next heading of any level, or `lines.length`).
  - `export function findPointerSection(lines: string[]): PointerSection | null`
  - `export interface PointerRefresh { action: 'created' | 'replaced' | 'unchanged'; content: string }`
  - `export function refreshPointer(current: string, template: string): PointerRefresh`

- [ ] **Step 1: Write the failing unit tests**

Create `test/unit/pointer.test.ts`:

```ts
// test/unit/pointer.test.ts
import { describe, expect, it } from 'vitest';

import { findPointerSection, POINTER_HEADING_RE, refreshPointer } from '../../src/lib/pointer.js';

const HEADING = '## Workflow system (managed by super-backlog)';
const TPL = `${HEADING}\n\nNew pointer text.\n`;
const crlf = (s: string): string => s.replace(/\n/g, '\r\n');

describe('POINTER_HEADING_RE', () => {
  it('matches the heading line (also with a trailing CR) but not prose mentioning it', () => {
    expect(POINTER_HEADING_RE.test(HEADING)).toBe(true);
    expect(POINTER_HEADING_RE.test(`${HEADING}\r`)).toBe(true);
    expect(POINTER_HEADING_RE.test('Our Workflow system (managed by super-backlog) is great')).toBe(false);
  });
});

describe('findPointerSection', () => {
  it('returns null without a pointer heading', () => {
    expect(findPointerSection(['# Notes', '', 'text'])).toBeNull();
  });
  it('ends at the next heading of any level', () => {
    expect(findPointerSection(['# Top', HEADING, '', 'body', '', '### Deep', 'x'])).toEqual({ start: 1, end: 5 });
  });
  it('runs to the end when no heading follows', () => {
    expect(findPointerSection([HEADING, '', 'body', ''])).toEqual({ start: 0, end: 4 });
  });
  it('picks the first pointer heading', () => {
    expect(findPointerSection([HEADING, 'a', HEADING, 'b'])).toEqual({ start: 0, end: 2 });
  });
});

describe('refreshPointer', () => {
  it('creates the pointer in an empty file', () => {
    expect(refreshPointer('', TPL)).toEqual({ action: 'created', content: TPL });
  });

  it('appends after existing content separated by one blank line (as before)', () => {
    expect(refreshPointer('# Notes\n', TPL)).toEqual({ action: 'created', content: `# Notes\n\n${TPL}` });
    expect(refreshPointer('# Notes', TPL).content).toBe(`# Notes\n\n${TPL}`);
    expect(refreshPointer('# Notes\n\n', TPL).content).toBe(`# Notes\n\n${TPL}`);
  });

  it('reports unchanged for an identical pointer and returns the input untouched', () => {
    const current = `# Notes\n\n${TPL}\n## Other\n\nkeep\n`;
    expect(refreshPointer(current, TPL)).toEqual({ action: 'unchanged', content: current });
  });

  it('treats a CRLF-only difference in the file as identical', () => {
    const current = crlf(`# Notes\n\n${TPL}`);
    expect(refreshPointer(current, TPL)).toEqual({ action: 'unchanged', content: current });
  });

  it('treats a CRLF template like an LF one', () => {
    expect(refreshPointer(`# Notes\n\n${TPL}`, crlf(TPL)).action).toBe('unchanged');
  });

  it('replaces a stale pointer and keeps content under other headings', () => {
    const current = `# Notes\n\nintro\n\n${HEADING}\n\nOld pointer text.\n\n## Other\n\nkeep me\n`;
    expect(refreshPointer(current, TPL)).toEqual({
      action: 'replaced',
      content: `# Notes\n\nintro\n\n${TPL}\n## Other\n\nkeep me\n`,
    });
  });

  it('replaces a stale pointer at the end of the file', () => {
    const current = `# Notes\n\n${HEADING}\n\nOld pointer text.\n`;
    expect(refreshPointer(current, TPL)).toEqual({ action: 'replaced', content: `# Notes\n\n${TPL}` });
  });

  it('keeps CRLF line endings when replacing before another heading', () => {
    const current = crlf(`# Notes\n\n${HEADING}\n\nOld pointer text.\n\n## Other\n\nkeep me\n`);
    expect(refreshPointer(current, TPL)).toEqual({
      action: 'replaced',
      content: crlf(`# Notes\n\n${TPL}\n## Other\n\nkeep me\n`),
    });
  });

  it('keeps CRLF line endings when replacing at the end of the file', () => {
    const current = crlf(`# Notes\n\n${HEADING}\n\nOld.\n`);
    expect(refreshPointer(current, TPL).content).toBe(crlf(`# Notes\n\n${TPL}`));
  });

  it('replaces user text written inside the pointer section (documented contract)', () => {
    const current = `${HEADING}\n\nOld pointer text.\n\nmy own note\n`;
    expect(refreshPointer(current, TPL).content).toBe(TPL);
  });

  it('refreshes only the first pointer section', () => {
    const current = `${HEADING}\n\nOld.\n\n${HEADING}\n\nSecond.\n`;
    expect(refreshPointer(current, TPL).content).toBe(`${TPL}\n${HEADING}\n\nSecond.\n`);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run test/unit/pointer.test.ts`
Expected: FAIL with a module-resolution error for `../../src/lib/pointer.js`.

- [ ] **Step 3: Create `src/lib/pointer.ts`**

```ts
// src/lib/pointer.ts
/** Heading of the CLAUDE.md pointer section owned by super-backlog. */
export const POINTER_HEADING_RE = /^##\s+Workflow system \(managed by super-backlog\)\s*$/m;

const ANY_HEADING_RE = /^#{1,6}\s/;

/** Line indices into `content.split('\n')`; `end` is exclusive. */
export interface PointerSection {
  start: number;
  end: number;
}

export interface PointerRefresh {
  action: 'created' | 'replaced' | 'unchanged';
  content: string;
}

/** First pointer section: from its heading up to the next heading of any level (or the end). */
export function findPointerSection(lines: string[]): PointerSection | null {
  const start = lines.findIndex((line) => POINTER_HEADING_RE.test(line));
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (ANY_HEADING_RE.test(lines[i])) return { start, end: i };
  }
  return { start, end: lines.length };
}

/**
 * Appends the pointer when missing, replaces a stale pointer section and keeps an
 * identical one. Line endings are ignored when comparing and kept when replacing.
 */
export function refreshPointer(current: string, template: string): PointerRefresh {
  const body = template.replace(/\r\n/g, '\n').trimEnd();
  const lines = current.split('\n');
  const section = findPointerSection(lines);
  if (section === null) {
    const sep = current.length === 0 ? '' : current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
    return { action: 'created', content: `${current}${sep}${body}\n` };
  }
  const existing = lines
    .slice(section.start, section.end)
    .map((line) => line.replace(/\r$/, ''))
    .join('\n')
    .trimEnd();
  if (existing === body) return { action: 'unchanged', content: current };
  const cr = current.includes('\r\n') ? '\r' : '';
  const atEof = section.end === lines.length;
  const replacement = [...body.split('\n').map((line) => `${line}${cr}`), atEof ? '' : cr];
  return {
    action: 'replaced',
    content: [...lines.slice(0, section.start), ...replacement, ...lines.slice(section.end)].join('\n'),
  };
}
```

- [ ] **Step 4: Run the unit tests and confirm they pass**

Run: `npx vitest run test/unit/pointer.test.ts`
Expected: PASS (all 16 tests).

- [ ] **Step 5: Write the failing e2e tests**

In `test/e2e/update.e2e.test.ts`:

1. Change the helpers import to:

```ts
import { CLI_PATH, runCli, scaffoldAndInit } from './helpers.js';
```

2. Below `fabricateLocalBacklogBin`, add:

```ts
const OLD_POINTER = [
  '## Workflow system (managed by super-backlog)',
  '',
  'This project uses the combined Backlog.md + Superpowers workflow. Read the',
  'integration block in AGENTS.md (section between SUPER-BACKLOG markers) and follow',
  'it. Tasks are managed exclusively through the `backlog` CLI.',
  '',
].join('\n');

/** Rewinds CLAUDE.md and AGENTS.md to the pre-routing-rule glue, with user content around the pointer. */
function ageGlue(dir: string): void {
  writeFileSync(
    join(dir, 'CLAUDE.md'),
    `# Project notes\n\nkeep me above\n\n${OLD_POINTER}\n## Local rules\n\nkeep me below\n`,
  );
  const agentsPath = join(dir, 'AGENTS.md');
  const aged = readFileSync(agentsPath, 'utf8')
    .replace(/### Model routing for subagents[\s\S]*?(?=Project-specific human gates)/, '')
    .replace(/^6\. Delegate by tier.*\r?\n/m, '');
  writeFileSync(agentsPath, aged);
}
```

3. Inside the `describe` block, after the `'is idempotent: …'` test, add:

```ts
  it('refreshes a stale CLAUDE.md pointer and AGENTS.md block, then stays stable', () => {
    freshScaffold();
    ageGlue(dir);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).not.toContain('Model routing for subagents');

    expect(runUpdate(dir).status).toBe(4);

    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(claude).toContain('"Model routing for subagents"');
    expect(claude).toContain('keep me above');
    expect(claude).toContain('## Local rules');
    expect(claude).toContain('keep me below');
    expect(claude.match(/^## Workflow system \(managed by super-backlog\)/gm)).toHaveLength(1);
    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('### Model routing for subagents');
    expect(agents).toMatch(/^6\. Delegate by tier/m);

    // second run: nothing left to change
    expect(runUpdate(dir).status).toBe(4);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toBe(claude);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toBe(agents);
  });

  it('uninstall after a pointer refresh removes pointer and block cleanly', () => {
    freshScaffold();
    ageGlue(dir);
    runUpdate(dir);

    const out = runCli(dir, ['uninstall']);

    expect(out).toContain('removed: CLAUDE.md pointer section');
    expect(out).toContain('removed: AGENTS.md managed block');
    expect(out).not.toMatch(/^\s+- (CLAUDE\.md pointer section|AGENTS\.md managed block)$/m);
    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(claude).not.toMatch(/Workflow system \(managed by super-backlog\)/);
    expect(claude).toContain('keep me above');
    expect(claude).toContain('## Local rules');
    expect(claude).toContain('keep me below');
  });
```

- [ ] **Step 6: Build and confirm the refresh test fails**

Run: `npm run build`
Run: `npx vitest run test/e2e/update.e2e.test.ts`
Expected: FAIL in `refreshes a stale CLAUDE.md pointer and AGENTS.md block, then stays stable`, at the assertion `toContain('"Model routing for subagents"')`, because the old pointer is still kept as is. The uninstall test may already pass. The four existing tests PASS.

- [ ] **Step 7: Switch `applyClaudePointer` to `refreshPointer`**

In `src/init/execute.ts`:

- Delete line 40: `export const POINTER_HEADING_RE = /^##\s+Workflow system \(managed by super-backlog\)\s*$/m;`
- Add the import, keeping the alphabetical order of the `../lib/*` imports (after `../lib/opencode.js`, before `../lib/ownership.js`):

```ts
import { refreshPointer } from '../lib/pointer.js';
```

- Replace `applyClaudePointer` (lines 155–164) with:

```ts
function applyClaudePointer(cwd: string): boolean {
  const path = join(cwd, 'CLAUDE.md');
  const current = readTextIfExists(path) ?? '';
  const result = refreshPointer(current, readTemplate('claude-pointer.md'));
  if (result.action === 'unchanged') return false;
  atomicWrite(path, result.content);
  return true;
}
```

- [ ] **Step 8: Make uninstall use the shared helper**

In `src/commands/uninstall.ts`:

- Change line 7 to `import { findGitDir } from '../init/execute.js';`.
- Add the following after the `../lib/ownership.js` import (keep the order alphabetical):

```ts
import { findPointerSection, POINTER_HEADING_RE } from '../lib/pointer.js';
```

- Replace `removePointerSection` (lines 49–63) with:

```ts
function removePointerSection(content: string): { content: string; removed: boolean } {
  const lines = content.split('\n');
  const section = findPointerSection(lines);
  if (section === null) return { content, removed: false };
  const kept = [...lines.slice(0, section.start), ...lines.slice(section.end)];
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
  return { content: kept.length > 0 ? `${kept.join('\n')}\n` : '', removed: true };
}
```

`verifyRemnants` keeps using `POINTER_HEADING_RE` unchanged (now imported from `../lib/pointer.js`).

- [ ] **Step 9: Confirm nothing else imports the old export**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: no errors. If any file still imports `POINTER_HEADING_RE` from `init/execute.js`, point it at `../lib/pointer.js`.

- [ ] **Step 10: Build and run the affected tests**

Run: `npm run build`
Run: `npx vitest run test/unit/pointer.test.ts test/e2e/update.e2e.test.ts test/e2e/uninstall.e2e.test.ts test/integration/uninstall-hardening.test.ts`
Expected: PASS for all of them, including both anchor-regression tests in `uninstall.e2e.test.ts`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/pointer.ts src/init/execute.ts src/commands/uninstall.ts test/unit/pointer.test.ts test/e2e/update.e2e.test.ts
git commit -m "feat(init): refresh a stale CLAUDE.md pointer section on init and update" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Docs, dogfood refresh and full verification

**Files:**
- Modify: `docs/guide/harness-support.md:17`, `docs/guide/harness-support.md:30`, plus a new section after the Claude Code section
- Modify: `docs/guide/quickstart.md:40`
- Modify: `README.md:64`
- Modify (via `sbl update` from the local build, then by hand for M9): `AGENTS.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: the built CLI from Tasks 1–2 (`node dist/bin.js update`).
- Produces: docs for the Docs-Gate; this repo dogfoods the managed rule.

- [ ] **Step 1: Update `docs/guide/harness-support.md`**

Replace line 17:

```markdown
- A one-line pointer section is written to `CLAUDE.md` referencing the managed block in `AGENTS.md`.
```

with:

```markdown
- A short pointer section is written to `CLAUDE.md`. It references the managed block in `AGENTS.md` and its model-routing rule. `sbl init` and `sbl update` refresh this section whenever its text differs from the current kit version. Put your own CLAUDE.md content under its own heading, because text inside the pointer section is replaced.
```

Insert this new section before `## What is file-based vs. delegated`:

```markdown
## Model routing rule (all harnesses)

The managed `AGENTS.md` block carries a harness-neutral "Model routing for subagents" section. It tells every agent to delegate less demanding work to subagents on cheaper models, picked by complexity (light, standard, top). The rule applies regardless of the session model, and the agent must set the model explicitly on every dispatch. Short examples name the per-harness setting: for Claude Code the Agent tool's `model` parameter, for OpenCode the agent's `model` field.

The rule is always on. Projects that want different behaviour add their own rule below the block. It is independent of the opt-in model router (`sbl models`).
```

Replace the table row:

```markdown
| `CLAUDE.md` pointer | file-based append | recognized heading |
```

with:

```markdown
| `CLAUDE.md` pointer | file-based append, refreshed in place | recognized heading; the section ends at the next heading |
```

- [ ] **Step 2: Update `docs/guide/quickstart.md`**

After line 40 (`Add --models to also enable …`), insert a blank line and:

```markdown
Every initialized project also gets a binding model-routing rule in its `AGENTS.md` block: agents delegate less demanding work to subagents on cheaper models, picked by complexity. This rule is independent of the opt-in router.
```

- [ ] **Step 3: Update `README.md`**

Replace line 64:

```markdown
| `AGENTS.md` / `CLAUDE.md` | Workflow block with pipeline, gates, and phase rules |
```

with:

```markdown
| `AGENTS.md` / `CLAUDE.md` | Workflow block with pipeline, gates, phase rules, and the model-routing rule for subagents |
```

- [ ] **Step 4: Lint the docs**

Run: `npx markdownlint-cli2 docs/guide/harness-support.md docs/guide/quickstart.md README.md`
Run: `npx cspell --no-progress docs/guide/harness-support.md docs/guide/quickstart.md README.md`
Expected: no findings.

- [ ] **Step 5: Commit the docs**

```bash
git add docs/guide/harness-support.md docs/guide/quickstart.md README.md
git commit -m "docs: describe the model routing rule and the CLAUDE.md pointer refresh" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Dogfood: refresh this repo with the local build**

Run: `npm run build`
Run: `node dist/bin.js update --no-self`
Expected: exit 0 or 4 (4 = success with warnings). The `super-backlog update complete - …` line reports at least 2 applied actions.

Run: `git status --short` and `git diff --stat`
Expected:
- `AGENTS.md`: the block marker changes from `SUPER-BACKLOG:1.3.1` to the current package version and the block now contains `### Model routing for subagents`.
- `CLAUDE.md`: the pointer section now contains the routing sentence. The hand-written `## Model routing for subagents (binding, always applies)` section below it is still there.
- `.claude/skills/*` and `.opencode/skill/*` may be refreshed too; that is expected.

If any other tracked file changed (for example `package.json`), stop and report it instead of committing.

- [ ] **Step 7: Remove the hand-written routing sections (spec M9)**

- `AGENTS.md`: delete everything from the line `## Model routing for subagents (project-specific, binding)` to the end of the file. The file must still end with rule 7 of "Git and delivery rules" followed by a single newline.
- `CLAUDE.md`: delete everything from the line `## Model routing for subagents (binding, always applies)` to the end of the file. The file must still end with the pointer section followed by a single newline.

Run: `git diff AGENTS.md CLAUDE.md`
Expected: the only changes are the refreshed block, the refreshed pointer and the two removed sections. The "Git and delivery rules" section and the BACKLOG.MD GUIDELINES block are unchanged.

- [ ] **Step 8: Prove the dogfood state is stable**

Run: `node dist/bin.js update --no-self`
Run: `git diff --stat AGENTS.md CLAUDE.md`
Expected: the diff is identical to Step 7. The second update did not re-add anything, and the routing sections did not reappear.

- [ ] **Step 9: Commit the dogfood refresh**

```bash
git add AGENTS.md CLAUDE.md .claude/skills .opencode/skill
git commit -m "chore(dogfood): refresh managed glue and drop the hand-written routing sections" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(If `.opencode/skill` does not exist in this repo, leave it out of `git add`.)

- [ ] **Step 10: Full verification**

Run: `npx tsc -p tsconfig.json --noEmit`
Run: `npm test`
Run: `npm run lint`
Expected: tsc reports no errors, and every test passes (skipped tests unchanged from master). Lint reports no findings. If the test run rewrote `test/unit/__snapshots__/dashboard-render.test.ts.snap` line endings, revert with `git checkout -- test/unit/__snapshots__/dashboard-render.test.ts.snap`.

Run: `git status --short`
Expected: clean except the pre-existing untracked `design-demos/`.

---

## Self-review notes

- Spec coverage:
  - M1, M2 and M4 are covered by Task 1 Step 3.
  - M3 holds: no flag or config is added anywhere.
  - M5 is covered by Task 1 Step 4.
  - M6 is covered by Task 2 (shared helper, CRLF-tolerant comparison, line endings kept, other headings untouched).
  - M7 holds: the append path is unchanged and tested in the `appends after existing content` case.
  - M8 holds: no router files are touched.
  - M9 is covered by Task 3 Steps 6–9.
  - The Testing section is covered by Task 1 Steps 1 and 5 and Task 2 Steps 1 and 5.
  - The Docs section is covered by Task 3 Steps 1–3.
- Error handling:
  - Duplicate heading: the "first section" test.
  - User text inside the pointer: the "documented contract" test.
  - Unreadable file: still flows through `readTextIfExists`/`atomicWrite` as before.
