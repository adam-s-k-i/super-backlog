# CRLF-aware Managed Writes + 1.6.0 Upgrade Note — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Managed writes into `AGENTS.md` and `CLAUDE.md` keep the file's line endings, and the docs tell 1.3.2–1.5.0 users how to get past the silent `sbl update` exit.

**Origin:** Follow-ups from the final whole-branch review of `feat/subagent-model-routing` (approved by the user in chat on 2026-10-09: "Ja, bitte die vorgeschlagenen Folgeaufgaben anlegen und umsetzen"). The design is small and fixed by the review, so this plan doubles as the design record.

**Architecture:** One shared helper `detectEol` (`src/lib/eol.ts`) decides the file's line ending (`\r\n` when the file contains any CRLF, otherwise `\n`) — the same rule `refreshPointer` already uses for its replace branch. `injectBlock`/`stripOwned` (`src/lib/markers.ts`) and the create branch of `refreshPointer` (`src/lib/pointer.ts`) write with that ending. Block comparison stays byte-exact, so a block that was written LF into a CRLF file (mixed endings, produced by ≤1.5.0) is replaced once and is stable afterwards.

**Tech Stack:** TypeScript ESM, Node ≥20, Vitest; e2e tests run against `dist/` (`npm run build` first; `npm test` runs the build via pretest).

## Global Constraints

- Work on branch `feat/subagent-model-routing`; never push.
- Template text may arrive with CRLF (Windows checkout with autocrlf) — always normalize it to LF before re-joining with the detected ending.
- An empty or LF-only file keeps LF output byte-for-byte as today (existing unit tests in `test/unit/markers.test.ts` and `test/unit/pointer.test.ts` must stay green unchanged).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Use "behavior" (US spelling) in docs — cspell runs in `npm run lint`.

---

### Task 1: CRLF-aware managed writes

**Files:**
- Create: `src/lib/eol.ts`
- Modify: `src/lib/markers.ts`, `src/lib/pointer.ts`
- Test: `test/unit/markers.test.ts`, `test/unit/pointer.test.ts`, `test/e2e/update.e2e.test.ts`

**Interfaces:**
- Produces: `export function detectEol(text: string): '\r\n' | '\n'` in `src/lib/eol.ts`. `injectBlock`, `stripOwned`, `refreshPointer` keep their signatures.

- [ ] **Step 1: Write the failing unit tests** — append to `test/unit/markers.test.ts` (add `const crlf = (s: string): string => s.replace(/\n/g, '\r\n');` and `const LONE_LF = /(?<!\r)\n/;` near the top):

```ts
describe('injectBlock with CRLF files', () => {
  it('writes the block with CRLF into a CRLF file', () => {
    const r = injectBlock('# T\r\n', '1.0.0', BLOCK);
    expect(r.action).toBe('created');
    expect(r.content).toBe(crlf(`# T\n${markerStart('1.0.0')}\n${BLOCK}\n${MARKER_END}\n`));
  });

  it('is unchanged on re-inject into the same CRLF file', () => {
    const once = injectBlock(crlf('# T\n\nbody\n'), '1.0.0', BLOCK).content;
    expect(injectBlock(once, '1.0.0', BLOCK)).toEqual({ action: 'unchanged', content: once });
  });

  it('heals an LF block inside a CRLF file once, then stays stable', () => {
    const mixed = `# T\r\n\r\n${markerStart('1.0.0')}\n${BLOCK}\n${MARKER_END}\r\n\r\n## After\r\n`;
    const healed = injectBlock(mixed, '1.0.0', BLOCK);
    expect(healed.action).toBe('replaced');
    expect(healed.content).not.toMatch(LONE_LF);
    expect(healed.content.endsWith('\r\n\r\n## After\r\n')).toBe(true);
    expect(injectBlock(healed.content, '1.0.0', BLOCK).action).toBe('unchanged');
  });

  it('normalizes a CRLF template before writing', () => {
    expect(injectBlock('# T\n', '1.0.0', crlf(BLOCK)).content).not.toContain('\r');
    expect(injectBlock('# T\r\n', '1.0.0', crlf(BLOCK)).content).not.toMatch(LONE_LF);
  });
});

describe('stripOwned with CRLF files', () => {
  it('removes the block and its trailing CRLF without leaving a blank line', () => {
    const doc = injectBlock('# H\r\n', '1.0.0', BLOCK).content;
    expect(stripOwned(doc)).toEqual({ content: '# H\r\n', removed: true });
  });
});
```

and append to the `refreshPointer` describe in `test/unit/pointer.test.ts`:

```ts
  it('appends with CRLF into a CRLF file', () => {
    expect(refreshPointer('# Notes\r\n', TPL)).toEqual({ action: 'created', content: crlf(`# Notes\n\n${TPL}`) });
    expect(refreshPointer('# Notes\r\n\r\n', TPL).content).toBe(crlf(`# Notes\n\n${TPL}`));
    expect(refreshPointer('a\r\n# Notes', TPL).content).toBe(`a\r\n# Notes${crlf(`\n\n${TPL}`)}`);
  });
```

- [ ] **Step 2: Run them, expect failures**

Run: `npx vitest run test/unit/markers.test.ts test/unit/pointer.test.ts`
Expected: the new CRLF tests FAIL (LF written into CRLF content); all older tests PASS.

- [ ] **Step 3: Implement**

`src/lib/eol.ts`:

```ts
// src/lib/eol.ts
/** Line ending to write into an existing file: CRLF when it already contains one, else LF. */
export function detectEol(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}
```

`src/lib/markers.ts` — import `detectEol` from `./eol.js`, then replace `injectBlock` and `stripOwned` with:

```ts
export function injectBlock(content: string, version: string, block: string): InjectResult {
  const nl = detectEol(content);
  const body = block.replace(/\r\n/g, '\n');
  const fresh = `${markerStart(version)}\n${body}\n${MARKER_END}`.split('\n').join(nl);
  const span = ownedSpan(content);
  if (!span) {
    const sep = content.length === 0 ? '' : content.endsWith('\n') ? '' : nl;
    return { content: content + sep + fresh + nl, action: 'created' };
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
  const before = content.slice(0, span.start);
  let after = content.slice(span.end);
  if (before.endsWith('\n')) {
    if (after.startsWith('\r\n')) after = after.slice(2);
    else if (after.startsWith('\n')) after = after.slice(1);
  }
  return { content: before + after, removed: true };
}
```

`src/lib/pointer.ts` — import `detectEol` from `./eol.js`; in `refreshPointer` compute `const nl = detectEol(current);` at the top, replace the create branch with:

```ts
  if (section === null) {
    const sep =
      current.length === 0 ? '' : current.endsWith(`${nl}${nl}`) ? '' : current.endsWith('\n') ? nl : `${nl}${nl}`;
    return { action: 'created', content: `${current}${sep}${body.split('\n').join(nl)}${nl}` };
  }
```

and replace `const cr = current.includes('\r\n') ? '\r' : '';` with `const cr = nl === '\r\n' ? '\r' : '';`.

- [ ] **Step 4: Run the unit tests, expect PASS**

Run: `npx vitest run test/unit/markers.test.ts test/unit/pointer.test.ts`
Expected: all PASS.

- [ ] **Step 5: Add the e2e test** — in `test/e2e/update.e2e.test.ts`, inside the `describe('sbl update (SBL_SKIP_INSTALL + SBL_FORCE_OFFLINE)'` block after the "refreshes a stale CLAUDE.md pointer…" test:

```ts
  it('keeps CRLF line endings in AGENTS.md and CLAUDE.md and is byte-stable on the second run', () => {
    freshScaffold();
    ageGlue(dir);
    for (const name of ['AGENTS.md', 'CLAUDE.md']) {
      const p = join(dir, name);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
    }

    expect(runUpdate(dir).status).toBe(4);

    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(agents).toContain('### Model routing for subagents');
    expect(claude).toContain('"Model routing for subagents"');
    expect(agents).not.toMatch(/(?<!\r)\n/);
    expect(claude).not.toMatch(/(?<!\r)\n/);

    expect(runUpdate(dir).status).toBe(4);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toBe(agents);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toBe(claude);
  });
```

- [ ] **Step 6: Full verification**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: all green. If the test run rewrites `test/unit/__snapshots__/dashboard-render.test.ts.snap` with line-ending-only changes, revert it with `git checkout -- <file>`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/eol.ts src/lib/markers.ts src/lib/pointer.ts test/unit/markers.test.ts test/unit/pointer.test.ts test/e2e/update.e2e.test.ts
git commit -m "fix(init): keep the file's line endings when writing the managed block and pointer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Docs — line endings and the 1.3.2–1.5.0 upgrade path

**Files:**
- Modify: `docs/guide/harness-support.md`, `docs/guide/troubleshooting.md`

- [ ] **Step 1: harness-support.md** — in the table row for `AGENTS.md` workflow block, change the "Managed how" cell to `start/end markers; written with the file's line endings`, and in the `CLAUDE.md` pointer row to `recognized heading; the section ends at the next heading; written with the file's line endings`.

- [ ] **Step 2: troubleshooting.md** — insert this section directly before `## Exit codes`:

```markdown
## `sbl update` exits without output (1.3.2 – 1.5.0)

In versions 1.3.2 through 1.5.0, `sbl update` can end silently with exit code 0 during its self-update check: nothing is printed and no project files are refreshed. The check is fixed in the following release, but an affected version cannot update itself past the bug.

Install the latest version once by hand, then run the update again:

    npm install -g super-backlog@latest
    sbl update

To refresh a project's files without the self-update check, run `sbl update --no-self`.
```

(Use a fenced `bash` block for the two commands instead of the indented block if markdownlint requires it.)

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add docs/guide/harness-support.md docs/guide/troubleshooting.md
git commit -m "docs: describe line-ending handling and the manual upgrade from 1.3.2-1.5.0" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
