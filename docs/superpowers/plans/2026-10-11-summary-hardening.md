# Summary Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close TASK-93..97, the review findings on the project summary
chain:

- Reject ambiguous YAML with line-numbered errors.
- Split the schema validator and the layout engine into named steps without
  changing their output.
- Harden the file and git reads, the temporary pages and the write errors.
- Replace brittle tests with structural and DOM-level ones.

**Architecture:** No new modules besides tests. The changes, by file:

- `src/lib/yamlmini.ts` gains one shared plain-scalar check.
- `src/dashboard/summary-schema.ts` and `src/dashboard/summary-layout.ts` are
  split into section and step functions. The first commit of each split is a
  pure refactor.
- `src/lib/run.ts` gets a buffer limit and an error code, which
  `src/dashboard/summary-facts.ts` uses to word git failures.
- `src/dashboard/render.ts` exports `tokensCss()` and a single-pass
  `fillTemplate()`. Both page renderers use them.
- `src/dashboard/hub.ts` removes its temporary pages.
- `src/commands/doctor.ts` guards the load call.
- The client mirror in `src/templates/summary.html` grows by `segHitsBox`,
  `scoreBox` and `zoneLabelBox`.

**Tech Stack:**

- TypeScript (ESM, Node >= 20), built with `tsc -p tsconfig.json`.
- Vitest 5 (`test/**/*.test.ts`). New devDependency: `happy-dom@20.14.6`, used
  by one test file only.
- Lint: markdownlint-cli2 and cspell on `**/*.md`; `docs/superpowers/**` is
  excluded.
- Windows-first: CRLF repo files, PowerShell 5.1 has no `&&`, and the Bash tool
  uses POSIX syntax.

**Spec:** `docs/superpowers/specs/2026-10-11-summary-hardening-design.md`.
Its error texts are verbatim requirements.

## Global Constraints

- **Worktree:** work only in
  `C:\Users\adamh\github\super-backlog\.worktrees\summary-hardening` on branch
  `fix/summary-hardening`. Never `cd` to the main checkout, never commit to
  `master` and never push (a push to master releases).
- **Backlog files:** never hand-edit `backlog/tasks/*.md`. Read tasks with
  `npx backlog task view TASK-<n> --plain`. AC checkboxes and phase changes
  belong to the controller. Never hand-edit `AGENTS.md`, `CLAUDE.md` or
  `.claude/skills`.
- **Commits:** use Conventional Commits, stage files explicitly by path (never
  `git add -A` or `git add .`), and add the trailer as a second `-m`:
  `git commit -m "<type>(<scope>): <subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- **Refactor commits** (Task 2 step 2, Task 4 step 2) keep the output
  byte-identical. They must pass with the existing tests unmodified: run
  `git diff --stat -- test/` before committing and expect it to be empty.
- **Snapshots:** on Windows, `npm test` rewrites `test/unit/__snapshots__/*.snap`
  with end-of-line-only changes.
  - Check for real changes with
    `git diff --ignore-cr-at-eol --stat -- test/unit/__snapshots__`.
  - Restore EOL-only changes with
    `git checkout -- test/unit/__snapshots__/<file>.snap`.
  - Never commit them. The only intended snapshot change is in Task 5 step 7.
- **Verification before every commit:**
  - Always run `npm test`. Its `pretest` builds, so `dist/` is fresh.
  - Run `npm run lint` when a `.md` file changed.
  - Run `npx vitepress build docs` when the guide changed.
  - Run `npm run build` and then `node dist/bin.js summary --check` when the
    guide, the parser or `backlog/docs/architecture.yml` changed. The check
    must exit 0 or report only drift findings, never a parse or schema error.
- **Test isolation:** no test touches the real `~/.super-backlog`, and no test
  starts a hub on the default port. Hub tests use `port: 0`.
- **Baseline:** 869 passed, 5 skipped. Each task only adds tests (or renames
  one), so the pass count grows monotonically.

## File structure

| File | Task | Change |
| --- | --- | --- |
| `src/lib/yamlmini.ts` | 1 | `plainProblem`, `#` after whitespace only, `-0` → `0`, header comment |
| `test/unit/yamlmini.test.ts` | 1 | new accepted and rejected cases, 10 s bound |
| `docs/guide/project-summary.md` | 1, 4 | YAML subset list (1), check 5 warning list (4) |
| `src/dashboard/summary-schema.ts` | 2 | section readers, `ID_BODY`, `ID_PATTERN_MESSAGE`, `LIMITS.stackPackage`, no cascade, flow fixes |
| `test/unit/summary-schema.test.ts` | 2 | new rule and boundary tests |
| `src/lib/run.ts` | 3 | `RUN_CAPTURE_MAX_BUFFER`, `opts.maxBuffer`, `errorCode` |
| `src/dashboard/summary-facts.ts` | 3 | `byCodeUnit`, stat before read, `gitFailure`, `countWorkflows` |
| `test/unit/run.test.ts` | 3 | ENOBUFS test (create the file if absent) |
| `test/unit/summary-facts.test.ts` | 3 | new tests, one rename |
| `test/unit/summary-facts-io.test.ts` | 3 | new: read-avoidance test with mocked `node:fs` |
| `src/dashboard/summary-layout.ts` | 4 | step functions, clamp and `port-overflow`, label scoring, rounding, comments |
| `src/templates/summary.html` | 4 | mirror gains `segHitsBox`, `scoreBox`, `zoneLabelBox`; `rescoreLabels` uses them |
| `test/unit/summary-layout.test.ts` | 4 | clamp, rounding, rescore and mirror tests |
| `backlog/docs/architecture.yml` | 4 | `dev>cli` label `sbl commands` |
| `src/dashboard/render.ts` | 5 | `tokensCss`, `fillTemplate` |
| `src/dashboard/summary-render.ts` | 5 | progress fallback, `curatedSource(load, renderError)`, stderr log, plurals |
| `src/dashboard/hub.ts` | 5 | `removePageFiles` |
| `src/commands/doctor.ts` | 5 | guarded `loadArchitecture` |
| `test/unit/summary-render.test.ts`, `test/unit/dashboard-render.test.ts`, `test/unit/hub.test.ts`, `test/unit/doctor.test.ts`, `test/integration/serve.test.ts` | 4, 5 | tests |
| `test/unit/summary-client.test.ts` | 5 | new: happy-dom client test |
| `package.json`, `package-lock.json` | 5 | `happy-dom` devDependency |

---

## Task 1: YAML subset rejects ambiguous input (TASK-93)

**Files:**

- Modify `src/lib/yamlmini.ts`: header comment (lines 18-29),
  `parseInlineValue` (quoted tail, about line 240), `plainBlockScalar`
  (about line 252), `resolvePlain` (about line 364), `FlowReader.readTop`
  (about line 393) and `FlowReader.readScalar` (about line 486).
- Modify `test/unit/yamlmini.test.ts`.
- Modify `docs/guide/project-summary.md` (section "YAML subset").

**Interfaces:**

```ts
/** Shared plain-scalar rule for block and flow context; `at` is an index into `raw`. */
function plainProblem(raw: string): { at: number; reason: string } | null;
```

Error reasons, verbatim:

- `plain values must not contain ": " - quote the value` (existing)
- `plain values must not end with ":" - quote the value`
- `plain values must not start with "- " - quote the value or put block sequence items on the next lines`
- `unexpected text after quoted scalar` (existing; now also for `"x"#y`)
- `unexpected text after flow collection` (existing; now also for `[a]#x`)

- [ ] **Step 1: Write the failing tests.** Add to the `rejected constructs`
  describe block of `test/unit/yamlmini.test.ts`:

```ts
  it.each([
    ['a: x:\n', 5, /plain values must not end with ":"/],
    ['a: - x\n', 4, /plain values must not start with "- "/],
    ['a: -\n', 4, /plain values must not start with "- "/],
    ['a: [x:]\n', 5, /plain values must not end with ":"/],
    ['a: [- x]\n', 5, /plain values must not start with "- "/],
    ['a: [a]#x\n', 7, /unexpected text after flow collection/],
    ['a: "x"#y\n', 7, /unexpected text after quoted scalar/],
    ['a: { k: }\n', 9, /empty entry in flow collection/],
    ['a: [a] b\n', 8, /unexpected text after flow collection/],
    ['a: { k: v } x\n', 13, /unexpected text after flow collection/],
    ['a: "x" y\n', 7, /unexpected text after quoted scalar/],
  ])('rejects the ambiguous %j with its column', (text, column, reason) => {
    rejects(text, 1, column, reason);
  });
```

  Add to the `accepted constructs` describe block:

```ts
  it('accepts a "- |" literal block as a sequence item', () => {
    expect(parseYamlSubset('items:\n  - |\n    one\n    two\n  - b\n')).toEqual({ items: ['one\ntwo\n', 'b'] });
  });

  it('accepts quoted mapping keys', () => {
    expect(parseYamlSubset('"a b": 1\n\'c\': 2\n')).toEqual({ 'a b': 1, c: 2 });
  });

  it('reads -0 as 0 (documented normalisation)', () => {
    const v = (parseYamlSubset('a: -0\n') as { a: number }).a;
    expect(Object.is(v, 0)).toBe(true);
  });

  it('strips trailing spaces on literal block lines (documented normalisation)', () => {
    expect(parseYamlSubset('a: |\n  x  \n  y\n')).toEqual({ a: 'x\ny\n' });
  });

  it('still accepts a comment after a space following a quoted scalar and a flow collection', () => {
    expect(parseYamlSubset('a: "x" # c\nb: [1] # c\n')).toEqual({ a: 'x', b: [1] });
  });
```

  Columns are 1-based and point at the offending character:

  | Input | Column points at |
  | --- | --- |
  | `x:` | its `:` |
  | `- x` | the `-` |
  | `[x:]` | the `:` at index 5 |
  | `[- x]` | the `-` at index 5 |
  | `[a]#x` | the `#` |
  | `"x"#y` | the `#` |

  If a column differs by one from the table, check `this.offset`/`offset +`
  arithmetic, not the test. The `{ k: }` and trailing-garbage cases already
  pass; they are AC #2 coverage.

- [ ] **Step 2: Run the tests to see the failures.**

  Run: `npx vitest run test/unit/yamlmini.test.ts`

  Expected: the `x:`, `- x`, `-`, `[x:]`, `[- x]`, `[a]#x` and `"x"#y` cases
  fail, and so does `-0` (it yields `-0`). Everything else passes.

- [ ] **Step 3: Implement the parser changes** in `src/lib/yamlmini.ts`:

  1. Add the helper next to `resolvePlain`:

```ts
/** Shared plain-scalar rule for block and flow context; `at` is an index into `raw`. */
function plainProblem(raw: string): { at: number; reason: string } | null {
  const colon = raw.search(/: /);
  if (colon !== -1) return { at: colon, reason: 'plain values must not contain ": " - quote the value' };
  if (raw === '-' || raw.startsWith('- ')) {
    return { at: 0, reason: 'plain values must not start with "- " - quote the value or put block sequence items on the next lines' };
  }
  if (raw.endsWith(':')) return { at: raw.length - 1, reason: 'plain values must not end with ":" - quote the value' };
  return null;
}
```

  2. In `plainBlockScalar`, replace the two `colon` lines with:

```ts
    const problem = plainProblem(raw);
    if (problem) throw this.err(line, offset + problem.at, problem.reason);
```

  3. In `FlowReader.readScalar`, replace the two `colon` lines with:

```ts
    const problem = plainProblem(raw);
    if (problem) this.fail(start + problem.at, problem.reason);
```

  4. In `parseInlineValue`, replace the quoted-tail check with one that
     accepts `#` only after whitespace:

```ts
      const rest = text.slice(q.end);
      const tail = rest.trimStart();
      if (tail !== '' && !(tail.startsWith('#') && rest.length > tail.length)) {
        throw this.err(line, offset + q.end, 'unexpected text after quoted scalar');
      }
```

  5. In `FlowReader.readTop`, record the position before `this.ws()` and
     require whitespace before a `#`:

```ts
  readTop(): YamlValue {
    const value = this.text[0] === '[' ? this.readSeq(0) : this.readMap();
    const end = this.i;
    this.ws();
    if (this.i < this.text.length && !(this.text[this.i] === '#' && this.i > end)) {
      this.fail(this.i, 'unexpected text after flow collection');
    }
    return value;
  }
```

  6. In `resolvePlain`, change `if (Number.isSafeInteger(n)) return n;` to
     `if (Number.isSafeInteger(n)) return n === 0 ? 0 : n; // -0 reads as 0 (documented)`.

  7. Extend the header comment (lines 18-29) with one sentence after the
     rejected list:

```text
 * Normalisations (documented in the guide): -0 reads as 0, trailing spaces
 * on block-scalar lines are removed, a `#` starts a comment only after
 * whitespace, and plain values must not end with ":" or start with "- ".
```

- [ ] **Step 4: Relax the timing bound** in the `size limit` describe block.
  Replace `expect(elapsed).toBeLessThan(1000);` with:

```ts
    // A quadratic regression on 256 KB takes minutes; 10 s catches it without flaking on slow CI runners.
    expect(elapsed).toBeLessThan(10_000);
```

- [ ] **Step 5: Run the tests to see them pass.**

  Run: `npx vitest run test/unit/yamlmini.test.ts test/unit/summary-schema.test.ts`

  Expected: all tests pass. The schema fixtures and the dogfood file still
  parse.

- [ ] **Step 6: Update the guide.** In `docs/guide/project-summary.md`,
  replace the paragraph after the bullet list in "### YAML subset" (it starts
  with `Quote a value when it contains`) with:

```markdown
Quote a value when it contains a comma inside `{ }` or `[ ]`, a colon
followed by a space, or a `#`, when it ends with a colon, or when it starts
with `- `. A `#` starts a comment only after a space, also after a quoted
value or a flow collection.

The parser rejects, with the line and column of the problem:

- tabs, anchors, aliases, tags, directives and multiple documents;
- empty entries in flow collections, such as `{ k: }` or `[a, , b]`;
- the keys `__proto__`, `constructor` and `prototype`;
- collections nested deeper than 32 levels.

Two values are normalised instead of rejected: `-0` reads as `0`, and trailing
spaces at the end of lines inside `|` and `>` blocks are removed.
```

- [ ] **Step 7: Verify everything.**

  Run, in order:

  - `npm test`: expect all tests to pass. Then restore any EOL-only snapshot
    changes per the Global Constraints.
  - `npm run lint`: expect no errors.
  - `npx vitepress build docs`: expect the build to complete.
  - `node dist/bin.js summary --check`: expect no parse or schema error for
    `backlog/docs/architecture.yml`.

- [ ] **Step 8: Commit.**

```bash
git add src/lib/yamlmini.ts test/unit/yamlmini.test.ts docs/guide/project-summary.md
git commit -m "fix(summary): reject ambiguous YAML subset input with line and column" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Schema validator split and fixes (TASK-94)

**Files:**

- Modify `src/dashboard/summary-schema.ts`. Today `validateArchitecture`
  spans lines 310-654. Its sections start at:

  | Section | Line |
  | --- | --- |
  | grid | 328 |
  | zones | 343 |
  | nodes | 374 |
  | edges | 442 |
  | flows | 483 |
  | highlights | 538 |
  | stack | 569 |
  | commands | 597 |
  | tasks | 623 |
  | final return | 646 |

- Modify `test/unit/summary-schema.test.ts`, for the new tests in step 4 only.

**Interfaces** (module-private, except the existing exports):

```ts
const ID_BODY = '[a-z][a-z0-9-]{0,31}';
const ID_PATTERN_MESSAGE = 'must match ^[a-z][a-z0-9-]{0,31}$';
export const ID_RE = new RegExp(`^${ID_BODY}$`);
const STEP_RE = new RegExp(`^(${ID_BODY})>(${ID_BODY})$`);
// LIMITS gains: stackPackage: 214, // npm's maximum package name length

function readGrid(c: Collector, root: YamlMap): { grid: ArchGrid | null; gridText: string };
function readZones(c: Collector, root: YamlMap, grid: ArchGrid | null, gridText: string): ArchZone[];
function readNodes(c: Collector, root: YamlMap, kinds: Record<string, ArchKind>, grid: ArchGrid | null, gridText: string):
  { nodes: ArchNode[]; nodeIds: ReadonlySet<string> | null };
function readEdges(c: Collector, root: YamlMap, nodeIds: ReadonlySet<string> | null):
  { edges: ArchEdge[]; edgeIds: ReadonlySet<string> | null };
function readFlows(c: Collector, root: YamlMap, edgeIds: ReadonlySet<string> | null): ArchFlow[];
function readHighlights(c: Collector, root: YamlMap, nodeIds: ReadonlySet<string> | null): ArchHighlight[];
function readStack(c: Collector, root: YamlMap, nodeIds: ReadonlySet<string> | null): ArchStackEntry[];
function readCommands(c: Collector, root: YamlMap): Record<string, ArchCommand[]>;
function readTasks(c: Collector, root: YamlMap, nodeIds: ReadonlySet<string> | null, taskIds?: readonly string[]): Record<string, string>;
```

Use the existing type names for the grid. If the grid object has no named
type, add `interface ArchGrid { cols: number; rows: number }` next to
`ArchZone`.

- [ ] **Step 1: Read the code.** Read `validateArchitecture` in full
  (`sed -n 300,660p src/dashboard/summary-schema.ts`) before moving anything.

- [ ] **Step 2: Pure refactor.** Move each section verbatim into its reader.

  - `readGrid`: lines 328-342.
  - `readZones`: lines 343-373.
  - `readNodes`: lines 374-441, returning `{ nodes, nodeIds }` where
    `nodeIds` is still the `Set` (never `null` in this step).
  - `readEdges`: lines 442-482.
  - `readFlows`: lines 483-537.
  - `readHighlights`: lines 538-568.
  - `readStack`: lines 569-596.
  - `readCommands`: lines 597-622.
  - `readTasks`: lines 623-645.

  In the same commit:

  - Introduce `ID_BODY`, `ID_PATTERN_MESSAGE`, the derived `ID_RE`/`STEP_RE`
    and `LIMITS.stackPackage`.
  - Replace the three literal `'must match ^[a-z][a-z0-9-]{0,31}$'` messages
    with `ID_PATTERN_MESSAGE`. Kinds use `` `kind id ${ID_PATTERN_MESSAGE}` ``.
  - Replace `214` in `readStack` with `LIMITS.stackPackage`.

  `validateArchitecture` becomes:

```ts
  const kinds = readKinds(c, root);
  const { grid, gridText } = readGrid(c, root);
  // keep the original call order: pitch, grid, kinds, zones, nodes, edges, flows, highlights, stack, commands, tasks
  const zones = readZones(c, root, grid, gridText);
  const { nodes, nodeIds } = readNodes(c, root, kinds, grid, gridText);
  const { edges, edgeIds } = readEdges(c, root, nodeIds);
  const flows = readFlows(c, root, edgeIds);
  const highlights = readHighlights(c, root, nodeIds);
  const stack = readStack(c, root, nodeIds);
  const commands = readCommands(c, root);
  const tasks = readTasks(c, root, nodeIds, taskIds);
```

  Problem order is observable, so keep the original order. If `readKinds` ran
  after the grid block, call `readGrid` first, exactly as the current code
  does.

  Run: `npm test`. Expect it to pass with `git diff --stat -- test/` empty.
  Then restore EOL-only snapshots and commit:

```bash
git add src/dashboard/summary-schema.ts
git commit -m "refactor(summary): split validateArchitecture into section readers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Write the failing behaviour tests.** Add a describe block
  `validateArchitecture: hardening (TASK-94)` to
  `test/unit/summary-schema.test.ts`:

```ts
describe('validateArchitecture: hardening (TASK-94)', () => {
  const nodeLines = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => `  - { id: n${i}, label: N${i}, kind: core, cell: [${i % 8}, ${Math.floor(i / 8)}] }`);

  it('reports only the size error when nodes exceed the limit (no unknown-node cascade)', () => {
    const r = check([
      'schema: 1',
      'pitch: p',
      'grid: { cols: 8, rows: 8 }',
      'nodes:',
      ...nodeLines(41),
      'edges:',
      '  - { from: n0, to: n1, label: x }',
      'highlights:',
      '  - { node: n0, title: T, text: t }',
      'stack:',
      '  - { name: S, group: G, nodes: [n0] }',
      'tasks:',
      '  TASK-1: n0',
    ]);
    expect(problems(r)).toEqual([{ path: 'nodes', message: 'at most 40 entries (found 41)', level: 'error' }]);
  });

  it('still checks the label of a flow whose id is invalid', () => {
    const r = check([...BASE, 'flows:', `  - { id: Bad_Id, label: ${'x'.repeat(29)}, steps: [a>b] }`]);
    expectError(r, 'flows[0].id', /^must match \^\[a-z\]\[a-z0-9-\]\{0,31\}\$$/);
    expectError(r, 'flows[0].label', /at most 28 characters \(found 29\)/);
  });

  it('does not let a dropped flow consume a default color', () => {
    const r = check([...BASE, 'flows:', '  - { id: gone, label: Gone, steps: [a>c] }', '  - { id: kept, label: Kept, steps: [a>b] }']);
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.architecture.flows.map((f) => [f.id, f.color])).toEqual([['kept', 'accent']]);
  });

  it('warns about unknown keys and ignores them', () => {
    const r = check([...BASE, 'colour: red']);
    expect(r.status).toBe('valid');
    expect(problems(r)).toContainEqual({ path: 'colour', message: 'unknown key, ignored', level: 'warning' });
  });

  it('rejects an invalid node id format', () => {
    expectError(check(withLine('  - { id: a,', '  - { id: 1a, label: Alpha, kind: core, cell: [0, 0] }')), 'nodes[0].id', /must match/);
  });

  it('rejects a bad flow color', () => {
    expectError(check([...BASE, 'flows:', '  - { id: f, label: F, color: red, steps: [a>b] }']), 'flows[0].color', /must be one of accent, ok/);
  });

  it('rejects a non-boolean dashed', () => {
    const lines = [...BASE.slice(0, 3), 'kinds:', '  core: { label: Core, color: accent, dashed: yes }', '  output: { label: Out, color: ok }', '  external: { label: Ext, color: dim }', ...BASE.slice(3)];
    expectError(check(lines), 'kinds.core.dashed', /expected true or false/);
  });

  it('rejects a reversed zone range', () => {
    expectError(check([...BASE, 'zones:', '  - { label: Z, cols: [1, 0], rows: [0, 0] }']), 'zones[0]', /first <= last/);
  });

  it.each([
    ['pitch', (s: string) => withLine('pitch:', `pitch: ${s}`), 'pitch', 400],
    ['node label', (s: string) => withLine('  - { id: a,', `  - { id: a, label: ${s}, kind: core, cell: [0, 0] }`), 'nodes[0].label', 28],
    ['node sub', (s: string) => withLine('  - { id: a,', `  - { id: a, label: A, sub: ${s}, kind: core, cell: [0, 0] }`), 'nodes[0].sub', 32],
    ['edge label', (s: string) => withLine('  - { from: a, to: b', `  - { from: a, to: b, label: ${s} }`), 'edges[0].label', 24],
    ['flow label', (s: string) => [...BASE, 'flows:', `  - { id: f, label: ${s}, steps: [a>b] }`], 'flows[0].label', 28],
    ['zone label', (s: string) => [...BASE, 'zones:', `  - { label: ${s}, cols: [0, 0], rows: [0, 0] }`], 'zones[0].label', 40],
    ['highlight title', (s: string) => [...BASE, 'highlights:', `  - { node: a, title: ${s}, text: t }`], 'highlights[0].title', 60],
    ['stack name', (s: string) => [...BASE, 'stack:', `  - { name: ${s}, group: G, nodes: [a] }`], 'stack[0].name', 40],
    ['stack package', (s: string) => [...BASE, 'stack:', `  - { name: S, group: G, package: ${s}, nodes: [a] }`], 'stack[0].package', 214],
  ])('%s: accepts exactly the limit and rejects one over it', (_name, build, path, max) => {
    expect(problems(check(build('x'.repeat(max)))).filter((p) => p.level === 'error')).toEqual([]);
    expectError(check(build('x'.repeat(max + 1))), path, new RegExp(`at most ${max} characters \\(found ${max + 1}\\)`));
  });

  const groups = (n: number, name = (i: number) => `g${i}`, per = 1): string[] => [
    'commands:',
    ...Array.from({ length: n }, (_, i) => [`  ${name(i)}:`, ...Array.from({ length: per }, (_, j) => `    - { run: cmd${j} }`)]).flat(),
  ];

  it('accepts 6 command groups and rejects 7', () => {
    expect(problems(check([...BASE, ...groups(6)])).filter((p) => p.level === 'error')).toEqual([]);
    expectError(check([...BASE, ...groups(7)]), 'commands', /at most 6 groups \(found 7\)/);
  });

  it('rejects a command group name over 40 characters and accepts exactly 40', () => {
    expect(problems(check([...BASE, ...groups(1, () => 'g'.repeat(40))])).filter((p) => p.level === 'error')).toEqual([]);
    expectError(check([...BASE, ...groups(1, () => 'g'.repeat(41))]), `commands.${'g'.repeat(41)}`, /group name at most 40 characters/);
  });

  it('accepts 8 commands in a group and rejects 9', () => {
    expect(problems(check([...BASE, ...groups(1, undefined, 8)])).filter((p) => p.level === 'error')).toEqual([]);
    expectError(check([...BASE, ...groups(1, undefined, 9)]), 'commands.g0', /at most 8 entries \(found 9\)/);
  });
});
```

  Notes on the test data:

  - In `BASE`, the node line prefix is `'  - { id: a,'` and the first edge
    prefix is `'  - { from: a, to: b'`.
  - `withLine` replaces the first line with the matching prefix.
  - If a boundary row fails at exactly the limit for an unrelated reason,
    such as a 400-character plain value containing `: `, fix the row's data,
    never the limit. `'x'.repeat(n)` contains no special characters.

  Run: `npx vitest run test/unit/summary-schema.test.ts`

  Expected failures: the cascade test (it also lists the `unknown node "n0"`
  errors), the invalid-id label test (no label error) and the dropped-flow
  colour test (it gets `ok`). The rest already pass; they are AC #5
  coverage.

- [ ] **Step 4: Implement the fixes.**

  1. In `readNodes`, before the `c.list` call, record whether the list will
     be read, and return `nodeIds: listed ? nodeIds : null`:

```ts
  const raw = root.nodes;
  const listed = Array.isArray(raw) && raw.length >= LIMITS.nodesMin && raw.length <= LIMITS.nodes;
```

  2. Do the same in `readEdges`, with `edgeIds: listed ? edgeIds : null` for
     `edges` (minimum 1, maximum `LIMITS.edges`). When `nodeIds === null`,
     skip the `unknown node` check: `else if (nodeIds !== null && !nodeIds.has(v))`.
  3. In `readHighlights`, change the check to
     `if (nodeIds !== null && !nodeIds.has(node))`.
  4. In `readStack`, change the check to
     `else if (nodeIds !== null && !nodeIds.has(n)) c.warn(...)`.
  5. In `readTasks`, change the check to
     `if (typeof node !== 'string' || (nodeIds !== null && !nodeIds.has(node)))`.
  6. In `readFlows`:
     - Replace the two early `return`s after the id checks with
       `let idOk = true;` and set `idOk = false` instead of returning. Only
       call `flowIds.add(id)` when the id is valid and new.
     - Replace the colour early `return` with `colorOk = false`.
     - Compute the default colour when the flow is pushed:
       `color ?? FLOW_COLORS[flows.length % FLOW_COLORS.length]`, where
       `color` stays `undefined` unless explicitly given.
     - Gate the missing-edge check: `if (edgeIds !== null && !edgeIds.has(s) && missing === null) missing = s;`.
     - The final guard becomes:

```ts
    if (!idOk || !colorOk || label === undefined || malformed || rawSteps.length === 0) return;
```

     Keep the dropped-flow warning text `no edge ${missing}; flow "${id}" dropped` unchanged.

  Run: `npx vitest run test/unit/summary-schema.test.ts`

  Expected: all tests pass, including the unmodified
  `assigns default flow colors in sequence` test, which still gives
  `['accent', 'violet', 'warn']`.

- [ ] **Step 5: Verify everything.** Run `npm test` and expect all tests to
  pass. Then restore EOL-only snapshots.

- [ ] **Step 6: Commit.**

```bash
git add src/dashboard/summary-schema.ts test/unit/summary-schema.test.ts
git commit -m "fix(summary): stop schema error cascades and keep flow checks and colors consistent" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Facts read files and git defensively (TASK-95)

**Files:**

- Modify `src/lib/run.ts`.
- Modify `src/dashboard/summary-facts.ts`:
  - `listProjectFiles` (lines 198-226)
  - the `add` sort (line 280)
  - the LOC loop (lines 309-326)
  - `releasesNote` (line 330)
  - the workflows block (lines 332-337)
- Modify `test/unit/summary-facts.test.ts`.
- Create `test/unit/summary-facts-io.test.ts`.
- Modify `test/unit/run.test.ts`, creating it if absent; check with
  `ls test/unit/run*.test.ts`.

**Interfaces:**

```ts
// src/lib/run.ts
export const RUN_CAPTURE_MAX_BUFFER = 64 * 1024 * 1024;
export interface RunResult { status: number; stdout: string; stderr: string; /** spawn error code, e.g. 'ENOENT' or 'ENOBUFS' */ errorCode?: string; }
export function runCapture(cmd: string, args: string[], cwd: string, opts: { maxBuffer?: number } = {}): RunResult;

// src/dashboard/summary-facts.ts
export function byCodeUnit(a: string, b: string): number;          // a < b ? -1 : a > b ? 1 : 0
export function gitFailure(r: RunResult): string;                  // see spec TASK-95 #3
export function listProjectFiles(cwd, run): { source: 'git' | 'walk'; files: string[]; note?: string };
function countWorkflows(cwd: string): number;
```

Strings, verbatim:

- `git output exceeds the 64 MB buffer`
- `git unavailable`
- `not a git repository`
- facts warning
  `git ls-files: output exceeds the 64 MB buffer; files counted by a directory walk`

- [ ] **Step 1: Write the failing tests.**

  In `test/unit/run.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { runCapture } from '../../src/lib/run.js';

describe('runCapture buffer limit', () => {
  it('reports ENOBUFS distinctly when the output exceeds maxBuffer', () => {
    const r = runCapture(process.execPath, ['-e', "process.stdout.write('x'.repeat(2048))"], process.cwd(), { maxBuffer: 1024 });
    expect(r.errorCode).toBe('ENOBUFS');
    expect(r.status).toBe(127);
  });

  it('captures normal output with the default buffer', () => {
    const r = runCapture(process.execPath, ['-e', "process.stdout.write('ok')"], process.cwd());
    expect(r).toMatchObject({ status: 0, stdout: 'ok' });
    expect(r.errorCode).toBeUndefined();
  });
});
```

  If the file already exists, add only the describe block and merge the
  imports.

  If cross-spawn returns the ENOBUFS error with a non-null status (it
  normally reports `status: null`), change `runCapture` so that any
  `r.error` with `code === 'ENOBUFS'` maps to status 127. The test stays as
  written.

  In `test/unit/summary-facts.test.ts`:

  - Rename line 88 to
    `it('lets a theme style.css header fill the version composer.json lacks', () => {`.
  - Add `gitFailure` to the import.
  - Add to `collectSummaryFacts: manifests`:

```ts
  it('joins an array license with OR', () => {
    put('package.json', { name: 'demo', license: ['MIT', 'Apache-2.0'] });
    expect(collectSummaryFacts(cwd, { runCapture: noGit }).license).toBe('MIT OR Apache-2.0');
  });

  it('reads a CRLF theme header whose last field shares the line with */', () => {
    put('style.css', '/*\r\nTheme Name: T\r\nVersion: 1.4.0 */\r\n');
    expect(readWordPressHeader(cwd)).toMatchObject({ type: 'theme', name: 'T', version: '1.4.0' });
  });

  it('leads with the WordPress theme when it is the only manifest', () => {
    put('style.css', '/*\nTheme Name: Solo Theme\nVersion: 2.0.0\n*/\n');
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'Solo Theme', version: '2.0.0', manifest: 'wordpress', manifests: ['wordpress'] });
    expect(f.extensions).toEqual(['.php']);
  });

  it('counts JS extensions only for a package.json + composer.json project (first manifest decides)', () => {
    put('package.json', { name: 'front' });
    put('composer.json', { name: 'acme/back' });
    put('src/a.ts', 'a\n');
    put('src/b.php', '<?php\n');
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.extensions).not.toContain('.php');
    expect(f.extensions).toContain('.ts');
    expect(f.sourceFiles).toBe(1);
  });
```

  - Add to `collectSummaryFacts: repository facts`:

```ts
  it('says "not a git repository" when git runs but fails', () => {
    const notRepo = (): RunResult => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
    expect(collectSummaryFacts(cwd, { runCapture: notRepo }).releasesNote).toBe('not a git repository');
  });

  it('reports an ENOBUFS ls-files failure as a warning and walks instead', () => {
    put('package.json', { name: 'demo' });
    put('src/a.ts', 'a\n');
    const big = (_cmd: string, args: string[]): RunResult =>
      args[0] === 'ls-files' ? { status: 127, stdout: '', stderr: 'spawnSync git ENOBUFS', errorCode: 'ENOBUFS' } : { status: 0, stdout: '', stderr: '' };
    const f = collectSummaryFacts(cwd, { runCapture: big });
    expect(f.fileSource).toBe('walk');
    expect(f.sourceFiles).toBe(1);
    expect(f.warnings).toContain('git ls-files: output exceeds the 64 MB buffer; files counted by a directory walk');
  });

  it.each([
    [{ status: 127, stdout: '', stderr: 'spawn git ENOENT', errorCode: 'ENOENT' }, 'git unavailable'],
    [{ status: 127, stdout: '', stderr: '' }, 'git unavailable'],
    [{ status: 127, stdout: '', stderr: '', errorCode: 'ENOBUFS' }, 'git output exceeds the 64 MB buffer'],
    [{ status: 128, stdout: '', stderr: 'fatal' }, 'not a git repository'],
  ] as [RunResult, string][])('gitFailure(%j) = %s', (r, text) => {
    expect(gitFailure(r)).toBe(text);
  });
```

  Create `test/unit/summary-facts-io.test.ts`:

```ts
// test/unit/summary-facts-io.test.ts
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});

const { collectSummaryFacts } = await import('../../src/dashboard/summary-facts.js');

let cwd = '';
afterEach(() => {
  if (cwd) fs.rmSync(cwd, { recursive: true, force: true });
});

it('checks the size with stat and never reads a file that would exceed the byte budget', () => {
  cwd = fs.mkdtempSync(join(tmpdir(), 'sbl-facts-io-'));
  fs.mkdirSync(join(cwd, 'src'));
  fs.writeFileSync(join(cwd, 'package.json'), '{"name":"demo"}');
  const huge = join(cwd, 'src', 'huge.ts');
  fs.writeFileSync(huge, 'x\n'.repeat(50));
  const noGit = () => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });
  const f = collectSummaryFacts(cwd, { runCapture: noGit, maxBytes: 25 });
  expect(f.locApprox).toBe(true);
  expect(f.sourceFiles).toBe(1);
  const readPaths = vi.mocked(fs.readFileSync).mock.calls.map((c) => String(c[0]));
  expect(readPaths).not.toContain(huge);
});
```

  Run: `npx vitest run test/unit/run.test.ts test/unit/summary-facts.test.ts test/unit/summary-facts-io.test.ts`

  Expected failures:

  - ENOBUFS (`errorCode` is undefined)
  - not a git repository (it gets `git unavailable`)
  - the ENOBUFS warning
  - `gitFailure` (not exported)
  - the io test (the huge file is read)

  The license, CRLF, theme-only and extension tests already pass; they are
  AC #5 coverage.

- [ ] **Step 2: Implement `run.ts`.** Pass `maxBuffer` to `spawn.sync` and
  surface the code:

```ts
export const RUN_CAPTURE_MAX_BUFFER = 64 * 1024 * 1024; // git ls-files -z for ~50k paths fits with a wide margin

export function runCapture(cmd: string, args: string[], cwd: string, opts: { maxBuffer?: number } = {}): RunResult {
  const r = spawn.sync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: opts.maxBuffer ?? RUN_CAPTURE_MAX_BUFFER });
  const errorCode = (r.error as NodeJS.ErrnoException | undefined)?.code;
  if (r.error && (r.status === null || r.status === undefined || errorCode === 'ENOBUFS')) {
    return { status: 127, stdout: '', stderr: String(r.error.message), ...(errorCode ? { errorCode } : {}) };
  }
  // ...existing success mapping unchanged
}
```

  Keep the rest of the function as it is. The callers in `phase`, `update`,
  `data`, `summary-drift`, `summary-facts` and `init/execute` stay unchanged,
  because the new parameter is optional.

- [ ] **Step 3: Implement `summary-facts.ts`.**

  1. Add the shared comparator and use it in all three places: the `.sort()`
     on the ls-files output becomes `.sort(byCodeUnit)`, the walk becomes
     `entries.sort((a, b) => byCodeUnit(a.name, b.name))`, and the `add` loop
     becomes `.sort(([a], [b]) => byCodeUnit(a, b))`.

```ts
/** Locale-independent order by UTF-16 code unit, shared by every facts sort. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
```

  2. Add the failure wording:

```ts
/** Wording for a failed git call on the data-source line (spec TASK-95 #3). */
export function gitFailure(r: RunResult): string {
  if (r.errorCode === 'ENOBUFS') return 'git output exceeds the 64 MB buffer';
  if (r.status === 127 || r.errorCode !== undefined) return 'git unavailable';
  return 'not a git repository';
}
```

  3. In `listProjectFiles`, after the `run` call add:

```ts
  const note = r.errorCode === 'ENOBUFS' ? 'git ls-files: output exceeds the 64 MB buffer; files counted by a directory walk' : undefined;
```

     Return `{ source: 'walk', files, ...(note ? { note } : {}) }` from the
     walk path.

  4. In `collectSummaryFacts`, after `const listed = listProjectFiles(cwd, run);`
     add `if (listed.note) warnings.push(listed.note);`.

  5. Replace the LOC read block (from `let buf: Buffer;` to
     `loc += countLines(buf);`) with:

```ts
    const abs = join(cwd, rel);
    let size: number;
    try {
      const st = statSync(abs);
      if (!st.isFile()) continue;
      size = st.size;
    } catch {
      continue; // listed by git but deleted in the work tree
    }
    if (bytes + size > maxBytes) {
      locApprox = true;
      continue;
    }
    let buf: Buffer;
    try {
      buf = readFileSync(abs);
    } catch {
      continue;
    }
    bytes += buf.length;
    loc += countLines(buf);
```

     Add `statSync` to the `node:fs` import.

  6. Replace the `releasesNote` line with
     `const releasesNote = tags.status === 0 ? null : gitFailure(tags);`.

  7. Replace the workflows block with
     `const workflows = countWorkflows(cwd);` and add:

```ts
function countWorkflows(cwd: string): number {
  try {
    return readdirSync(join(cwd, '.github', 'workflows')).filter((f) => /\.ya?ml$/i.test(f)).length;
  } catch {
    return 0; // no workflows directory
  }
}
```

  Run: `npx vitest run test/unit/run.test.ts test/unit/summary-facts.test.ts test/unit/summary-facts-io.test.ts test/unit/summary-render.test.ts`

  Expected: all tests pass. The existing `sets the approximation flag` test
  still gives `loc` 10: a.ts is read with 20 bytes, and b.ts is skipped
  after its stat shows 20 + 20 > 25.

- [ ] **Step 4: Verify everything.** Run `npm test` and expect all tests to
  pass. Then restore EOL-only snapshots.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/run.ts src/dashboard/summary-facts.ts test/unit/run.test.ts test/unit/summary-facts.test.ts test/unit/summary-facts-io.test.ts
git commit -m "fix(summary): stat before reading, bound git output and word git failures precisely" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Layout pipeline, port clamp and label scoring (TASK-96)

**Files:**

- Modify `src/dashboard/summary-layout.ts` (572 lines). Today
  `layoutArchitecture` spans lines 336-571:

  | Part | Lines |
  | --- | --- |
  | nodes | 342-357 |
  | L3 | 359-378 |
  | L4 | 380-471 |
  | polylines | 474-481 |
  | L5 | 483-506 |
  | L6 | 508-537 |
  | edges | 539-558 |
  | zones | 560-564 |
  | ordered | 566-569 |

- Modify `src/templates/summary.html`: the mirror block at about lines
  432-483, `segHit` after it, and `rescoreLabels` at about line 497.
- Modify `test/unit/summary-layout.test.ts`.
- Modify `backlog/docs/architecture.yml`: the `dev` → `cli` edge.
- Modify `docs/guide/project-summary.md`: the check 5 warning list.
- Modify `test/unit/doctor.test.ts`: the port-overflow detail line.

**Interfaces:**

```ts
// module-private step functions (refactor, step 2)
function placeNodes(input: LayoutInput): WorkNode[];                                    // lines 342-346
function chooseRoutes(input: LayoutInput, nodes: readonly WorkNode[]): WorkEdge[];     // byId/occupied/free/clearH/clearV + L3, lines 347-378
interface Port { ed: WorkEdge; end: 's' | 't'; key: number; tie: string }               // hoisted from L4
interface SidePorts { node: WorkNode; side: Side; list: Port[]; offsets: number[] }
function sortKey(side: Side, node: WorkNode, other: WorkNode, isStraight: boolean): number;  // was `key`
function collectSides(work: readonly WorkEdge[]): Map<string, Port[]>;                 // addPort loop
function groupStraightSides(work: readonly WorkEdge[], sides: Map<string, Port[]>): Map<string, { keys: string[]; edges: WorkEdge[] }>;  // union-find
function straightOffsets(groups: Map<string, { keys: string[]; edges: WorkEdge[] }>, sides: Map<string, Port[]>): Map<WorkEdge, number>;
function sideOffsets(list: Port[], straightOff: Map<WorkEdge, number>): number[];      // sorts `list` in place; offsets in list order
function placeSidePorts(sp: SidePorts): void;                                           // writes sx/sy/tx/ty
function assignPorts(work: readonly WorkEdge[], nodes: readonly WorkNode[]): LayoutWarning[];  // L4; [] until step 4
interface Routed { ed: WorkEdge; points: Point[]; segs: Segment[]; seg: Segment }
function routePolylines(work: readonly WorkEdge[]): Routed[];
interface LabelChoice { candidates: LabelSlot[]; slot: number; score: number; tw: number }
function placeLabels(routed: readonly Routed[], nodes: readonly WorkNode[], width: number, height: number):
  { labels: Map<string, LabelChoice>; placed: Box[] };                                 // L5
function diagnose(routed: readonly Routed[], labels: Map<string, LabelChoice>): { warnings: LayoutWarning[]; crossings: number; collisions: number };
function buildEdges(routed: readonly Routed[], labels: Map<string, LabelChoice>, placed: readonly Box[]): LayoutEdge[];
function layoutZones(input: LayoutInput): LayoutZone[];
function readingOrder(nodes: readonly WorkNode[]): LayoutNode[];

// behaviour changes (step 4)
export type LayoutWarningCode = 'route-fallback' | 'label-collision' | 'crossing' | 'port-overflow';  // extend LayoutWarning.code
const PORT_INSET = 8;
const MIN_PORT_GAP = 6;
export function zoneLabelBox(z: LayoutZone, tw: number): Box;   // { x0: z.x + 10, y0: z.y + 4, x1: z.x + 12 + tw, y1: z.y + 21 }
export function scoreBox(box: Box, ctx: { width: number; height: number; nodeBoxes: readonly Box[]; placed: readonly Box[];
  foreignSegments: readonly Segment[]; zoneLabels?: readonly Box[] }): number;          // +2 per zone label hit
function placeLabels(routed, nodes, zones: readonly LayoutZone[], width, height);      // gains zones
```

`port-overflow` message, verbatim: `${n} connections on the ${left|right|top|bottom} side of ${nodeId} leave ${gap.toFixed(1)}px between ports (minimum 6); move cells to spread the connections`.

- [ ] **Step 1: Read the code.** Read `layoutArchitecture` in full
  (`sed -n 300,572p src/dashboard/summary-layout.ts`) and the mirror block in
  `src/templates/summary.html` (`sed -n 425,530p`).

- [ ] **Step 2: Pure refactor.** Split `layoutArchitecture` into the step
  functions above, moving lines verbatim.

  `groupStraightSides` keeps the union-find and stores side keys
  (`keys: string[]`) instead of `Port[][]`. `straightOffsets` computes
  `wants` from `sides.get(k)`. Order and arithmetic are unchanged, including
  `Math.round(.../half) * half + 0`.

  `assignPorts` builds `SidePorts` for every side and computes
  `sideOffsets`, then calls `placeSidePorts`, then returns `[]`.

  `routePolylines` keeps unrounded points in this step.

  `layoutArchitecture` becomes:

```ts
export function layoutArchitecture(input: LayoutInput): LayoutResult {
  const { cols, rows } = input.grid;
  const width = 2 * LAYOUT.mx + cols * LAYOUT.w + (cols - 1) * LAYOUT.gx;
  const height = LAYOUT.mt + rows * LAYOUT.h + (rows - 1) * LAYOUT.gy + LAYOUT.mb;
  const nodes = placeNodes(input);
  const work = chooseRoutes(input, nodes);
  const portWarnings = assignPorts(work, nodes);
  const routed = routePolylines(work);
  const { labels, placed } = placeLabels(routed, nodes, width, height);
  const diag = diagnose(routed, labels);
  return {
    width,
    height,
    zones: layoutZones(input),
    nodes: readingOrder(nodes),
    edges: buildEdges(routed, labels, placed),
    warnings: [...portWarnings, ...diag.warnings],
    crossings: diag.crossings,
    collisions: diag.collisions,
  };
}
```

  Add the two comments the AC asks for:

  - At the `centre` line:
    `// "+ 0" turns -0 into 0, so toEqual and the JSON output stay stable.`
  - Above the straight-block placement:

```ts
  // Trade-off: a straight block centred on the snapped mean can sit -9/+9 px off the box
  // centre, even for a lone straight edge. We accept the asymmetry, because the edge must
  // meet the opposite side at the same height to stay straight.
```

  Run: `npm test`. Expect it to pass with `git diff --stat -- test/` empty and
  no real snapshot change (`git diff --ignore-cr-at-eol --stat -- test/unit/__snapshots__`).

  Commit:

```bash
git add src/dashboard/summary-layout.ts
git commit -m "refactor(summary): split layoutArchitecture into named pipeline steps" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Write the failing tests.** In
  `test/unit/summary-layout.test.ts`, add `zoneLabelBox` to the import and
  add:

```ts
describe('layoutArchitecture: port clamp (TASK-96)', () => {
  const end = (g: ReturnType<typeof layoutArchitecture>, id: string): number[] =>
    (g.edges.find((e) => e.id === id) as LayoutEdge).points.at(-1) as number[];

  it('compresses four ports on a 56 px side into the box instead of overflowing it', () => {
    const g = layoutArchitecture(
      graph(3, 3, [['t', 2, 1], ['a', 0, 0], ['b', 1, 0], ['c', 0, 2], ['d', 1, 2]], [['a', 't'], ['b', 't'], ['c', 't'], ['d', 't']]),
    );
    expect(['a>t', 'b>t', 'c>t', 'd>t'].map((id) => end(g, id)[1])).toEqual([161.33, 148, 174.67, 188]);
    const t = g.nodes.find((n) => n.id === 't') as { y: number; h: number };
    for (const id of ['a>t', 'b>t', 'c>t', 'd>t']) {
      expect(end(g, id)[1]).toBeGreaterThanOrEqual(t.y + 8);
      expect(end(g, id)[1]).toBeLessThanOrEqual(t.y + t.h - 8);
    }
    expect(g.warnings.filter((w) => w.code === 'port-overflow')).toEqual([]);
  });

  it('warns with port-overflow when the clamp leaves less than 6 px between ports', () => {
    const sources: [string, number, number][] = [];
    for (const c of [0, 1, 2, 3]) for (const r of [2, 4]) sources.push([`s${c}${r}`, c, r]);
    const g = layoutArchitecture(graph(8, 6, [['t', 7, 3], ...sources], sources.map(([id]) => [id, 't'] as [string, string])));
    const overflow = g.warnings.filter((w) => w.code === 'port-overflow');
    expect(overflow).toEqual([
      {
        code: 'port-overflow',
        edge: 's32>t',
        message: '8 connections on the left side of t leave 5.7px between ports (minimum 6); move cells to spread the connections',
      },
    ]);
  });

  it('derives the label segment from the same rounded points it emits', () => {
    const g = layoutArchitecture(
      graph(3, 3, [['t', 2, 1], ['a', 0, 0], ['b', 1, 0], ['c', 0, 2], ['d', 1, 2]], [['a', 't'], ['b', 't'], ['c', 't'], ['d', 't']]),
    );
    for (const e of g.edges) {
      const segs = e.points.slice(1).map((p, i) => ({ x1: e.points[i][0], y1: e.points[i][1], x2: p[0], y2: p[1] }));
      expect(segs).toContainEqual({ x1: e.segment.x1, y1: e.segment.y1, x2: e.segment.x2, y2: e.segment.y2 });
    }
  });
});

describe('label scoring (TASK-96)', () => {
  it('scores a zone label hit like a placed label', () => {
    const box: Box = { x0: 0, y0: 0, x1: 10, y1: 10 };
    const base = { width: 1000, height: 1000, nodeBoxes: [], placed: [], foreignSegments: [] };
    expect(scoreBox(box, base)).toBe(0);
    expect(scoreBox(box, { ...base, zoneLabels: [{ x0: 5, y0: 5, x1: 20, y1: 20 }] })).toBe(2);
  });

  it('places the zone label box where the client draws the zone text', () => {
    expect(zoneLabelBox({ label: 'Kit', x: 100, y: 50, w: 300, h: 200 }, 40)).toEqual({ x0: 110, y0: 54, x1: 152, y1: 71 });
  });

  it('dogfood: the dev>cli label renders in full without collisions', () => {
    const g = layoutArchitecture(fromFile(join(ROOT, 'backlog', 'docs', 'architecture.yml')));
    const e = g.edges.find((x) => x.id === 'dev>cli') as LayoutEdge;
    expect(e.score).toBe(0);
    expect(fromFile(join(ROOT, 'backlog', 'docs', 'architecture.yml')).edges.find((x) => x.id === 'dev>cli')?.label).toBe('sbl commands');
  });

  const all: [string, () => LayoutInput][] = [...SOURCES, ...SYNTHETIC.map(([n, i]) => [n, () => i] as [string, () => LayoutInput])];
  it.each(all)('%s: with measured-like widths (x0.9 and x1.13) no badge covers any label, flow or not', (_name, load) => {
    const g = layoutArchitecture(load());
    for (const f of [0.9, 1.13]) {
      const scaled = g.edges.map((e) => ({ ...e, labelWidth: e.labelWidth * f }));
      const boxes = labelBoxes(scaled);
      const moved = scaled.map((e) => ({ ...e, badge: badgeFor(e.segment, e.candidates[e.slot], e.labelWidth, boxes) }));
      expect(badgeOverlaps(moved, moved.map((e) => e.id))).toEqual([]);
    }
  });
});
```

  Extend `clientMirror()` to also return `scoreBox` and `zoneLabelBox`
  (`return { slotBox: slotBox, badgeFor: badgeFor, scoreBox: scoreBox, zoneLabelBox: zoneLabelBox };`
  and widen the return type). Add to the mirror describe block:

```ts
  it.each(inputs)('%s: client and server score boxes and zone labels identically', (_name, load) => {
    const client = clientMirror();
    const input = load();
    const g = layoutArchitecture(input);
    const nodeBoxes = g.nodes.map((n) => ({ x0: n.x - 1, y0: n.y - 1, x1: n.x + n.w + 1, y1: n.y + n.h + 1 }));
    const zoneLabels = g.zones.map((z) => zoneLabelBox(z, estimateLabelWidth(z.label)));
    for (const z of g.zones) expect(client.zoneLabelBox(z, 50)).toEqual(zoneLabelBox(z, 50));
    const placed = labelBoxes(g.edges);
    for (const e of g.edges) {
      const ctx = { width: g.width, height: g.height, nodeBoxes, placed, foreignSegments: g.edges.filter((o) => o !== e).map((o) => o.segment), zoneLabels };
      for (const c of e.candidates) {
        const box = slotBox(c, e.labelWidth).box;
        expect(client.scoreBox(box, ctx)).toBe(scoreBox(box, ctx));
      }
    }
  });
```

  `fromFile`, `ROOT`, `SOURCES`, `SYNTHETIC`, `labelBoxes` and
  `badgeOverlaps` are defined above line 336. Place the new describe blocks
  after the `step badges` block, so that these helpers are in scope.

  In `test/unit/doctor.test.ts`, add `layoutArchitecture` (from
  `../../src/dashboard/summary-layout.js`) to the imports if missing, and
  add:

```ts
  it('shows a port-overflow layout warning as a detail line of check 5', () => {
    const load = checkArchitectureText(ARCH_OK, 'architecture.yml');
    const d = makeDeps({
      loadArchitecture: () => load,
      layoutArchitecture: (a) => ({
        ...layoutArchitecture(a),
        warnings: [{ code: 'port-overflow', edge: 'a>b', message: '8 connections on the left side of b leave 5.7px between ports (minimum 6); move cells to spread the connections' }],
      }),
    });
    runDoctor('/proj', d);
    expect(d.lines.some((l) => l.includes('[warn] backlog/docs/architecture.yml valid with 1 warning(s)'))).toBe(true);
    expect(d.lines.some((l) => l.includes('layout port-overflow a>b: 8 connections on the left side of b'))).toBe(true);
  });
```

  Run: `npx vitest run test/unit/summary-layout.test.ts test/unit/doctor.test.ts`

  Expected failures:

  - clamp: the end y values are 159/141/177/195
  - port-overflow: no warning
  - rounding: unrounded segment for clamped ports
  - zone scoring: the `zoneLabels` argument is ignored
  - `zoneLabelBox`: not exported
  - dev>cli: the label is `sbl …`
  - mirror: `scoreBox` is not defined in the mirror
  - doctor: a TypeScript error on the `'port-overflow'` code

  The x0.9/x1.13 rescore may already pass; it is AC #6 coverage.

- [ ] **Step 4: Implement the server changes** in
  `src/dashboard/summary-layout.ts`.

  1. Extend the `LayoutWarning` `code` union with `'port-overflow'`.

  2. Clamp in `assignPorts`, after every side's `offsets` exist and before
     any `placeSidePorts` call:

```ts
const PORT_INSET = 8;
const MIN_PORT_GAP = 6;
const SIDE_NAMES: Record<Side, string> = { L: 'left', R: 'right', T: 'top', B: 'bottom' };
const portLimit = (sp: SidePorts): number => (sp.side === 'T' || sp.side === 'B' ? sp.node.w : sp.node.h) / 2 - PORT_INSET;

  // Ports must stay PORT_INSET px inside the corners. One factor per straight group keeps
  // straight edges at the same offset on both ends; crowding below MIN_PORT_GAP is reported.
  const warnings: LayoutWarning[] = [];
  for (const g of groups.values()) {
    let scale = 1;
    let binding: SidePorts | null = null;
    for (const k of g.keys) {
      const sp = perSide.get(k) as SidePorts;
      const max = Math.max(0, ...sp.offsets.map(Math.abs));
      if (max > 0 && portLimit(sp) / max < scale) {
        scale = portLimit(sp) / max;
        binding = sp;
      }
    }
    if (binding === null) continue;
    for (const k of g.keys) {
      const sp = perSide.get(k) as SidePorts;
      sp.offsets = sp.offsets.map((o) => o * scale + 0);
    }
    const gap = LAYOUT.port * scale;
    if (gap < MIN_PORT_GAP) {
      warnings.push({
        code: 'port-overflow',
        edge: binding.list[0].ed.id,
        message: `${binding.list.length} connections on the ${SIDE_NAMES[binding.side]} side of ${binding.node.id} leave ${gap.toFixed(1)}px between ports (minimum ${MIN_PORT_GAP}); move cells to spread the connections`,
      });
    }
  }
  for (const sp of perSide.values()) placeSidePorts(sp);
  return warnings;
```

     `perSide` is the `Map<string, SidePorts>` built in step 2, and `groups`
     is the result of `groupStraightSides`. Every side key belongs to exactly
     one group, so every side is scaled at most once.

  3. Round in `routePolylines`: build `points` from rounded coordinates,
     `[[round(sx), round(sy)], ...]`, before calling `segmentsOf`. Then
     `buildEdges` emits `points: r.points` (already rounded) and
     `d: pathD(r.points)`.

  4. Add the zone label box and extend the scoring context:

```ts
/** Box of a zone's label text, drawn by the client at (z.x + 12, z.y + 16) in 12 px type; mirrored in summary.html. */
export function zoneLabelBox(z: LayoutZone, tw: number): Box {
  return { x0: z.x + 10, y0: z.y + 4, x1: z.x + 12 + tw, y1: z.y + 21 };
}
```

     In `scoreBox`, add
     `for (const r of ctx.zoneLabels ?? []) if (hit(box, r)) s += 2;` and
     update its doc comment to mention zone labels (+2) and the edge's own
     other leg.

  5. In `placeLabels`, add the `zones` parameter.
     - Build `const zoneLabels = zones.map((z) => zoneLabelBox(z, estimateLabelWidth(z.label)));`.
     - Set the foreign segments to every segment except the label's own:
       `const foreignSegments = routed.flatMap((o) => o.segs).filter((s) => s !== r.seg);`.
     - Pass `zoneLabels` in the context.
     - In `layoutArchitecture`, compute `const zones = layoutZones(input);`
       before `placeLabels` and pass it to both `placeLabels` and the result.

  6. Above `slotsFor`, add the short-segment comment (AC #4):

```ts
// Labels sit on the edge's longest segment. A horizontal neighbour edge is a single segment of
// LAYOUT.gx (104 px), so labels wider than ~100 px cannot avoid both boxes there; a detour would
// add a crossing. Such labels score > 0 and doctor reports label-collision: keep them short
// (see spec 2026-10-11, TASK-96 #4; the dogfood dev>cli label is "sbl commands" for this reason).
```

- [ ] **Step 5: Mirror the client.** In `src/templates/summary.html`:

  1. Move `segHit` into the mirror block under the server name `segHitsBox`.
     Add `scoreBox` and `zoneLabelBox` right before
     `/* sbl:badge-mirror:end */`:

```js
  function segHitsBox(sg, b) {
    return sg.horizontal
      ? sg.y1 >= b.y0 && sg.y1 <= b.y1 && Math.min(sg.x1, sg.x2) < b.x1 && Math.max(sg.x1, sg.x2) > b.x0
      : sg.x1 >= b.x0 && sg.x1 <= b.x1 && Math.min(sg.y1, sg.y2) < b.y1 && Math.max(sg.y1, sg.y2) > b.y0;
  }
  function scoreBox(box, ctx) {
    var s = 0, i;
    if (box.x0 < 4 || box.x1 > ctx.width - 4 || box.y0 < 2 || box.y1 > ctx.height - 2) s += 5;
    for (i = 0; i < ctx.nodeBoxes.length; i++) if (hit(box, ctx.nodeBoxes[i])) s += 3;
    for (i = 0; i < ctx.placed.length; i++) if (hit(box, ctx.placed[i])) s += 2;
    for (i = 0; i < ctx.foreignSegments.length; i++) if (segHitsBox(ctx.foreignSegments[i], box)) s += 1;
    var zl = ctx.zoneLabels || [];
    for (i = 0; i < zl.length; i++) if (hit(box, zl[i])) s += 2;
    return s;
  }
  function zoneLabelBox(z, tw) { return { x0: z.x + 10, y0: z.y + 4, x1: z.x + 12 + tw, y1: z.y + 21 }; }
```

     Delete the old `segHit` outside the block, and replace its other
     callers, if any, with `segHitsBox`.

  2. In `rescoreLabels`:
     - Before the `order.forEach`, build the zone label boxes from the
       measured zone text:

```js
    var zoneLabels = $$('.zone text', svg).map(function (t, i) {
      var z = G.zones[i], w = 0;
      try { w = t.getComputedTextLength(); } catch (err) { w = 0; }
      return zoneLabelBox(z, w ? w + 2 : z.label.length * 7);
    });
    function sameSeg(a, b) { return a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2; }
```

     - Inside the loop over edges, build
       `var foreign = []; G.edges.forEach(function (o) { segs[o.id].forEach(function (sg) { if (!(o.id === e.id && sameSeg(sg, e.segment))) foreign.push(sg); }); });`.
     - Replace the inline scoring of each candidate with
       `var s = scoreBox(box, { width: G.width, height: G.height, nodeBoxes: nodeBoxes, placed: placed, foreignSegments: foreign, zoneLabels: zoneLabels });`.

     The zone `<text>` elements are created in `G.zones` order, at about
     line 380, so the index matches.

- [ ] **Step 6: Dogfood label and guide.**

  1. In `backlog/docs/architecture.yml`, change the `dev` → `cli` edge's label
     (line 138, currently `label: sbl …`) to `label: sbl commands`. This is
     the only edit to the file; check it with `git diff backlog/docs/architecture.yml`.
  2. In `docs/guide/project-summary.md`, change the check 5 paragraph's list
     `(an edge without a straight or single-corner route, an overlapping label, or a crossing)`
     to
     `(an edge without a straight or single-corner route, an overlapping label, a crossing, or too many connections on one side of a box)`.

- [ ] **Step 7: Run the tests to see them pass.**

  Run: `npx vitest run test/unit/summary-layout.test.ts test/unit/doctor.test.ts test/unit/summary-render.test.ts`

  Expected: all tests pass. The fixtures and the dogfood file have no
  clamped side and no zone or own-leg hit, verified by a probe before
  planning, so the full-view snapshot stays unchanged. If
  `git diff --ignore-cr-at-eol --stat -- test/unit/__snapshots__` shows a
  real change, stop and report it; do not update the snapshot in this task.

- [ ] **Step 8: Verify everything.**

  Run, in order:

  - `npm test`: expect all tests to pass. Then restore EOL-only snapshots.
  - `npm run lint`: expect no errors.
  - `npx vitepress build docs`: expect the build to complete.
  - `node dist/bin.js summary --check`: expect no parse or schema error.

- [ ] **Step 9: Commit.**

```bash
git add src/dashboard/summary-layout.ts src/templates/summary.html test/unit/summary-layout.test.ts test/unit/doctor.test.ts backlog/docs/architecture.yml docs/guide/project-summary.md
git commit -m "fix(summary): clamp crowded ports with a port-overflow warning and score own legs and zone labels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Render, hub, doctor and test hardening (TASK-97)

**Files:**

- Modify `src/dashboard/render.ts`: `renderDashboard` (lines 79-89).
- Modify `src/dashboard/summary-render.ts`:
  - `buildSummaryModel` (line 141)
  - `autoSource` and `curatedSource` (lines 199-231)
  - `buildSummaryView` (line 265)
  - `renderSummary` (line 328)
  - `writeSummaryPage` (line 350)
- Modify `src/dashboard/hub.ts`: `disposeEntry` (line 196) and the
  re-registration branch (about line 231).
- Modify `src/commands/doctor.ts`: check 5 at line 144.
- Modify these test files:
  - `test/unit/summary-render.test.ts`
  - `test/unit/dashboard-render.test.ts`
  - `test/unit/hub.test.ts`
  - `test/unit/doctor.test.ts`
  - `test/integration/serve.test.ts`
- Create `test/unit/summary-client.test.ts`.
- Modify `package.json` and `package-lock.json` (via `npm install`).
- Snapshot: `test/unit/__snapshots__/summary-render.test.ts.snap` (step 7
  only).

**Interfaces:**

```ts
// src/dashboard/render.ts
export function tokensCss(): string;   // readTemplate('sbl-tokens.css').replace(/\r\n/g, '\n').trimEnd()
export function fillTemplate(template: string, values: Readonly<Record<string, () => string>>): string;

// src/dashboard/summary-render.ts
export interface SummaryProgress { facts?: SummaryFacts; load?: ArchitectureLoadResult }
export function buildSummaryModel(cwd: string, data: DashboardData, deps?: SummaryDeps, progress?: SummaryProgress): SummaryModel;
function curatedSource(load: ArchitectureLoadResult, renderError: string | null): string[];

// src/dashboard/hub.ts (module-private)
function removePageFiles(file: string): void;
```

Strings, verbatim:

- stderr line: `sbl: could not write the summary page ${file}: ${message}\n`
- curated line on a render error with an existing file:
  `` `${ARCHITECTURE_PATH} was not shown because the summary could not be rendered; see the notice above.` ``
- doctor fail line: `` `${ARCHITECTURE_PATH} check failed (${message})` ``
- serve 404 body: `summary not generated yet`

- [ ] **Step 1: Single-pass placeholders and shared tokens (AC #3, #4).**

  Write the failing tests first.

  In `test/unit/summary-render.test.ts`, in `renderSummary template`:

```ts
  it('fills placeholders in one pass: a project named like a placeholder stays literal', () => {
    const tricky = renderSummary({ ...DATA, project: { ...DATA.project, name: '__SBL_SUMMARY_JSON__' } }, validModel());
    expect(tricky).toContain('<title>__SBL_SUMMARY_JSON__ &middot; Project Summary</title>');
    expect((island(tricky) as { project: string }).project).toBe('__SBL_SUMMARY_JSON__');
  });
```

  In `test/unit/dashboard-render.test.ts`:

```ts
  it('fills placeholders in one pass: a project named like a placeholder stays literal', () => {
    const html = renderDashboard({ ...SAMPLE, project: { ...SAMPLE.project, name: '__SBL_PHASES_JSON__' } });
    expect(html).toContain('<title>__SBL_PHASES_JSON__ &middot; Project Dashboard</title>');
    const m = /<script type="application\/json" id="sbl-data">([\s\S]*?)<\/script>/.exec(html);
    expect((JSON.parse(m?.[1] ?? 'null') as { project: { name: string } }).project.name).toBe('__SBL_PHASES_JSON__');
  });
```

  If `jsonIsland` escapes characters inside the island, compare after
  `JSON.parse`, exactly as above.

  Run: `npx vitest run test/unit/summary-render.test.ts test/unit/dashboard-render.test.ts`

  Expected: both new tests fail, because the chained `replaceAll` replaces
  the name a second time.

  Then implement in `src/dashboard/render.ts`:

```ts
/** The shared design tokens, LF-normalised, for both pages' __SBL_TOKENS_CSS__ placeholder. */
export function tokensCss(): string {
  return readTemplate('sbl-tokens.css').replace(/\r\n/g, '\n').trimEnd();
}

/** Single-pass fill: inserted values are never scanned again; unknown placeholders stay literal. */
export function fillTemplate(template: string, values: Readonly<Record<string, () => string>>): string {
  return template.replace(/__[A-Z][A-Z_]*__/g, (m) => (Object.hasOwn(values, m) ? values[m]() : m));
}
```

  `renderDashboard` becomes:

```ts
  return fillTemplate(readTemplate(), {
    __SBL_TOKENS_CSS__: tokensCss,
    __PROJECT_NAME__: () => esc(data.project.name),
    __PROJECT_DESC__: () => esc(data.project.description),
    __GENERATED_AT__: () => esc(data.generatedAt),
    __KIT_VERSION__: () => esc(data.kitVersion),
    __STATUS_PILLS__: () => statusPillsHtml(data.statuses),
    __SBL_DATA_JSON__: () => jsonIsland(data),
    __SBL_GLOSSARY_JSON__: () => jsonIsland(data.glossary),
    __SBL_PHASES_JSON__: () => jsonIsland(PIPELINE_PHASES),
  });
```

  `renderSummary` becomes:

```ts
  const view = buildSummaryView(data, model);
  return fillTemplate(readTemplate('summary.html'), {
    __SBL_TOKENS_CSS__: tokensCss,
    __PROJECT_NAME__: () => esc(data.project.name),
    __SUMMARY_NOTICE__: () => noticeHtml(model),
    __SBL_SUMMARY_JSON__: () => jsonIsland(view),
  });
```

  Import `fillTemplate` and `tokensCss` from `./render.js` in
  `summary-render.ts`.

  Keep the template argument of `renderDashboard` exactly as before
  (`readTemplate()` or whatever it passes today). If `tsconfig` targets a lib
  without `Object.hasOwn`, use `Object.prototype.hasOwnProperty.call(values, m)`.

  Run the two test files again. Expect them to pass, including
  `replaces every placeholder`.

- [ ] **Step 2: Plurals on the data-source lines (AC #4).**

  Write the failing test first, in `buildSummaryView`:

```ts
  it('uses singular nouns for counts of one on the data-source lines', () => {
    const one: SummaryFacts = { ...FACTS, sourceFiles: 1, releases: 1, releasesNote: null, dependencies: 1, devDependencies: 0 };
    const load = checkArchitectureText(
      [
        'schema: 1',
        'pitch: p',
        'grid: { cols: 2, rows: 1 }',
        'nodes:',
        '  - { id: a, label: A, kind: core, cell: [0, 0] }',
        '  - { id: b, label: B, kind: core, cell: [1, 0] }',
        'edges:',
        '  - { from: a, to: b, label: x }',
        'flows:',
        '  - { id: f, label: F, steps: [a>b] }',
        'highlights:',
        '  - { node: a, title: T, text: t }',
        'stack:',
        '  - { name: S, group: G, nodes: [a] }',
        'commands:',
        '  Dev:',
        '    - { run: x }',
        'tasks:',
        '  T-2: a',
        '',
      ].join('\n'),
      ARCHITECTURE_PATH,
    );
    if (load.status !== 'valid') throw new Error('invalid');
    const v = buildSummaryView(DATA, { facts: one, load, layout: layoutArchitecture(load.architecture), renderError: null, drift: null });
    expect(v.source.auto.join('\n')).toMatch(/^1 source file \(/m);
    expect(v.source.auto).toContain('1 release from git version tags');
    expect(v.source.auto).toContain('1 runtime and 0 development dependency; versions from lockfiles where present');
    expect(v.source.curated).toEqual([
      'Pitch, 2 components, 1 connection, 1 flow',
      '1 highlight, 1 stack entry, 1 command group',
      '1 task-to-component mapping (status comes from the backlog CLI)',
    ]);
  });
```

  The dependency line follows the pinned rule
  `plural(d + dd, 'dependency', 'dependencies')` (spec, TASK-97 #4): a total of
  1 gives `dependency`, and any other total keeps `dependencies`. The curated
  line expects `2 components`, because the schema minimum is 2 nodes.

  Run: `npx vitest run test/unit/summary-render.test.ts -t "singular"`

  Expected: the test fails.

  Then, in `autoSource` and `curatedSource`, use `plural(n, one, many)` for:

  - `source file`/`source files`
  - `release`/`releases`
  - `component`/`components`
  - `connection`/`connections`
  - `flow`/`flows`
  - `highlight`/`highlights`
  - `stack entry`/`stack entries`
  - `command group`/`command groups`
  - `task-to-component mapping`/`task-to-component mappings`
  - `` plural(d + dd, 'dependency', 'dependencies') `` for the dependency
    line

  Every count other than 1 keeps today's text, so the existing snapshots do
  not change.

  Run the test again and expect it to pass. Check that
  `git diff --ignore-cr-at-eol --stat -- test/unit/__snapshots__` shows no
  real change.

- [ ] **Step 3: E3 fallback and write errors (AC #1, #2).**

  Write the failing tests first, in `describe('writeSummaryPage')`. Add `vi`
  to the vitest import:

```ts
  it('collects facts only once when the layout throws, and does not claim the file is missing (E3)', () => {
    const load = checkArchitectureText(FIXTURE, ARCHITECTURE_PATH);
    let lsFiles = 0;
    const counting = (cmd: string, args: string[]): RunResult => {
      if (cmd === 'git' && args[0] === 'ls-files') lsFiles++;
      return noGit();
    };
    const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), {
      runCapture: counting,
      loadArchitecture: () => load,
      layoutArchitecture: () => {
        throw new Error('layout exploded');
      },
    });
    expect(lsFiles).toBe(1);
    const curated = (island(readFileSync(file, 'utf8')) as { source: { curated: string[] } }).source.curated;
    expect(curated).toEqual([`${ARCHITECTURE_PATH} was not shown because the summary could not be rendered; see the notice above.`]);
  });

  it('logs a failed summary write to stderr and still returns', () => {
    writeFileSync(join(cwd, 'blocker'), 'a file where a directory is expected');
    const target = join(cwd, 'blocker', 'dash.html');
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      expect(() => writeSummaryPage(cwd, DATA, target, { runCapture: noGit })).not.toThrow();
      const out = err.mock.calls.map((c) => String(c[0])).join('');
      expect(out).toContain(`sbl: could not write the summary page ${summaryFileFor(target)}: `);
    } finally {
      err.mockRestore();
    }
  });
```

  Run: `npx vitest run test/unit/summary-render.test.ts -t "writeSummaryPage"`

  Expected: both tests fail. `lsFiles` is 2, the curated line says
  `No curated file yet`, and nothing is written to stderr.

  Then implement:

  1. `buildSummaryModel(cwd, data, deps = {}, progress: SummaryProgress = {})`:
     right after `collectSummaryFacts`, set `progress.facts = facts;`, and
     right after the load, set `progress.load = load;`. Export the
     `SummaryProgress` interface.

  2. `writeSummaryPage`: create `const progress: SummaryProgress = {};`, pass
     it to `buildSummaryModel`, and replace the catch body's facts re-collection:

```ts
    try {
      html = renderSummary(data, {
        facts: progress.facts ?? emptyFacts(),
        load: progress.load ?? { status: 'invalid', path: ARCHITECTURE_PATH, problems: [] },
        layout: null,
        renderError: message,
        drift: null,
      });
    } catch {
      html = minimalPage(data, message);
    }
```

     When the load itself threw, the file exists (a missing file returns
     `missing` without throwing), so `invalid` with no problems is the honest
     fallback. `noticeHtml` shows the render error first in every case.

  3. Replace the write catch with:

```ts
  } catch (err) {
    // the dashboard never depends on the summary page, but the user should know why it is stale
    process.stderr.write(`sbl: could not write the summary page ${file}: ${err instanceof Error ? err.message : String(err)}\n`);
  }
```

  4. Change `curatedSource` to take `(load, renderError)`, and pass
     `model.renderError` from `buildSummaryView`:

```ts
function curatedSource(load: ArchitectureLoadResult, renderError: string | null): string[] {
  if (load.status === 'missing') return ['No curated file yet; this page shows the automatic facts only.'];
  if (renderError !== null) {
    return [`${ARCHITECTURE_PATH} was not shown because the summary could not be rendered; see the notice above.`];
  }
  // ...invalid and valid branches unchanged (with the plurals from step 2)
}
```

  Run the `writeSummaryPage` tests again. Expect all of them to pass,
  including the existing E3 test and `never throws`. That test now also
  writes to stderr; this is expected, and the test does not assert silence.

- [ ] **Step 4: Temporary pages are removed (AC #5).**

  Write the failing test first, in `test/unit/hub.test.ts` inside
  `describe('startHubServer')`. Add `existsSync` to the `node:fs` import and
  `summaryFileFor` from `../../src/dashboard/summary-render.js`:

```ts
  it('removes its temporary sbl-dashboard-*.html pages and their summary siblings on close, but never other files', async () => {
    const tmp = fixture('sbl-hub-tmp-', 'Temp');
    dirs.push(tmp.cwd);
    const page = join(tmp.cwd, 'sbl-dashboard-1-temp.html');
    writeFileSync(page, '<html>temp</html>');
    writeFileSync(summaryFileFor(page), '<html>summary</html>');
    const keep = fixture('sbl-hub-keep-', 'Keep');
    dirs.push(keep.cwd);
    writeFileSync(summaryFileFor(keep.file), '<html>summary</html>');
    const hub = await startHubServer({ port: 0, token: 't' });
    expect(hub.register({ cwd: tmp.cwd, file: page, regenerate: () => {} }).ok).toBe(true);
    expect(hub.register({ cwd: keep.cwd, file: keep.file, regenerate: () => {} }).ok).toBe(true);
    await hub.close();
    expect(existsSync(page)).toBe(false);
    expect(existsSync(summaryFileFor(page))).toBe(false);
    expect(existsSync(keep.file)).toBe(true);
    expect(existsSync(summaryFileFor(keep.file))).toBe(true);
  });

  it('removes the old temporary page when a project re-registers with a new file', async () => {
    const p = fixture('sbl-hub-rereg-', 'Rereg');
    dirs.push(p.cwd);
    const first = join(p.cwd, 'sbl-dashboard-1-rereg.html');
    const second = join(p.cwd, 'sbl-dashboard-2-rereg.html');
    writeFileSync(first, '<html>1</html>');
    writeFileSync(second, '<html>2</html>');
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    hub.register({ cwd: p.cwd, file: first, regenerate: () => {} });
    hub.register({ cwd: p.cwd, file: second, regenerate: () => {} });
    expect(existsSync(first)).toBe(false);
    expect(existsSync(second)).toBe(true);
  });
```

  Run: `npx vitest run test/unit/hub.test.ts`

  Expected: both new tests fail, because the files remain.

  Then implement in `src/dashboard/hub.ts`. Add `rmSync` to the `node:fs`
  import and `basename` to `node:path`:

```ts
/** Temp pages are named sbl-dashboard-<time>-<slug>.html by the hub and `sbl dashboard`; nothing else is ever deleted. */
const TEMP_PAGE_RE = /^sbl-dashboard-.*\.html$/i;

function removePageFiles(file: string): void {
  if (!TEMP_PAGE_RE.test(basename(file))) return;
  const summary = summaryFileFor(file);
  for (const f of [file, `${file}.tmp`, summary, `${summary}.tmp`]) {
    try {
      rmSync(f, { force: true });
    } catch {
      /* best effort: a locked file stays until the OS cleans the temp dir */
    }
  }
}
```

  - Call `removePageFiles(entry.file)` at the end of `disposeEntry`.
  - In the re-registration branch, before `existing.file = project.file;`,
    add `if (existing.file !== project.file) removePageFiles(existing.file);`.

  Check that the names really match: `grep -n "sbl-dashboard-" src/dashboard/hub.ts src/commands/dashboard.ts`.
  Both should build `sbl-dashboard-${Date.now()}-${slug}.html` in `tmpdir()`.

  Run the hub tests again and expect them to pass.

- [ ] **Step 5: Doctor guards the load (AC #6).** The layout call is already
  guarded and tested.

  Write the failing test first, in `test/unit/doctor.test.ts`:

```ts
  it('turns a throwing architecture load into a failure instead of crashing', () => {
    const d = makeDeps({
      loadArchitecture: () => {
        throw new Error('load exploded');
      },
    });
    expect(runDoctor('/proj', d)).toBe(1);
    expect(d.lines).toContain('[fail] backlog/docs/architecture.yml check failed (load exploded)');
  });
```

  Run: `npx vitest run test/unit/doctor.test.ts -t "throwing architecture load"`

  Expected: the test fails, because `runDoctor` throws.

  Then, in `src/commands/doctor.ts`, wrap the load:

```ts
  let arch: ArchitectureLoadResult | null = null;
  try {
    arch = (deps.loadArchitecture ?? ((c: string) => loadArchitecture(c)))(cwd);
  } catch (err) {
    emit('fail', `${ARCHITECTURE_PATH} check failed (${err instanceof Error ? err.message : String(err)})`);
  }
  if (arch === null) {
    // reported above
  } else if (arch.status === 'missing') {
```

  Keep the rest of the chain unchanged, and import the
  `ArchitectureLoadResult` type if it is not imported yet.

  Run the doctor tests again and expect them to pass.

- [ ] **Step 6: Tighter assertions in existing tests (AC #7, first half).**

  1. In `test/unit/summary-render.test.ts`, replace the body of
     `defines colors only through tokens` with:

```ts
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const tokens = tokensCss();
    expect(style.split(tokens).length - 1).toBe(1);
    const outsideTokens = style.replace(tokens, '');
    expect(outsideTokens).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(outsideTokens).not.toMatch(/\brgba?\(/);
```

     Import `tokensCss` from `../../src/dashboard/render.js`. If the
     `TOKENS` constant becomes unused, delete it, because lint and tsc flag
     unused locals.

  2. In `test/integration/serve.test.ts`, in `keeps the dashboard intact when the summary chain fails`,
     replace the last assertion with:

```ts
    const summary = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(summary.status).toBe(404);
    expect(summary.body).toBe('summary not generated yet');
```

     Confirm the body first: `grep -n "summary not generated yet" src/dashboard/*.ts`.
     If `sendText` appends a newline, assert the exact bytes that it sends.

  Run: `npx vitest run test/unit/summary-render.test.ts test/integration/serve.test.ts`

  Expected: the tests pass.

- [ ] **Step 7: Structural full-view snapshot (AC #7).** Replace the test
  `full view (valid architecture) matches the snapshot` with:

```ts
  it('full view (valid architecture) keeps a stable structure', () => {
    const v = buildSummaryView(DATA, validModel());
    expect({
      keys: Object.keys(v),
      facts: v.facts.map((f) => f.label),
      nodes: v.architecture?.nodes.map((n) => n.id),
      edges: v.architecture?.edges.map((e) => e.id),
      flows: v.architecture?.flows.map((f) => f.id),
      layoutNodes: v.layout?.nodes.map((n) => n.id),
      layoutEdges: v.layout?.edges.map((e) => `${e.id}:${e.kind}`),
      zones: v.layout?.zones.map((z) => z.label),
      warnings: v.source.warnings.length,
      tasks: v.tasks.map((t) => `${t.id}:${t.node ?? '-'}`),
      commands: v.commands.map((c) => `${c.group}:${c.entries.length}`),
      stack: v.stack.map((s) => s.name),
      source: v.source,
    }).toMatchSnapshot();
  });
```

  Coordinates and label slots stay covered by `summary-layout.test.ts`. The
  reduced-view snapshot stays as it is.

  Run: `npx vitest run test/unit/summary-render.test.ts -u`

  Then inspect `git diff --ignore-cr-at-eol test/unit/__snapshots__/summary-render.test.ts.snap`.
  Expected: the old `full view ... matches the snapshot 1` entry is removed,
  the new `keeps a stable structure 1` entry is added, and nothing else
  changes. Revert any EOL-only change in other `.snap` files. This `.snap`
  file is committed in step 10.

- [ ] **Step 8: DOM-level client test (AC #7).** Install the DOM environment.
  The repo has none.

  Run: `npm install --save-dev happy-dom@20.14.6`

  Expected: `package.json` lists `"happy-dom": "20.14.6"`, or the caret form
  that npm writes, under `devDependencies`. Pin the exact version by editing
  the range to `20.14.6` if npm wrote `^20.14.6`, then run `npm install`
  again so that the lockfile matches.

  Create `test/unit/summary-client.test.ts`:

```ts
// @vitest-environment happy-dom
// test/unit/summary-client.test.ts — runs the summary page script against a real DOM (happy-dom).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import type { DashboardData } from '../../src/dashboard/data.js';
import { layoutArchitecture } from '../../src/dashboard/summary-layout.js';
import { emptyFacts, renderSummary, type SummaryModel } from '../../src/dashboard/summary-render.js';
import { ARCHITECTURE_PATH, checkArchitectureText } from '../../src/dashboard/summary-schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(here, '..', 'fixtures', 'summary', 'architecture.super-backlog.yml'), 'utf8');

const DATA = {
  project: { name: 'Demo', description: 'Demo project' },
  tasks: [],
  source: 'backlog-json',
} as unknown as DashboardData;

function model(): SummaryModel {
  const load = checkArchitectureText(FIXTURE, ARCHITECTURE_PATH);
  if (load.status !== 'valid') throw new Error('fixture invalid');
  return { facts: emptyFacts(), load, layout: layoutArchitecture(load.architecture), renderError: null, drift: null };
}

const $ = <T extends Element = Element>(s: string): T => {
  const el = document.querySelector<T>(s);
  if (!el) throw new Error(`no element ${s}`);
  return el;
};
const key = (target: EventTarget, k: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
};

let flowId = '';
let firstStep = '';

beforeAll(() => {
  const m = model();
  if (m.load.status !== 'valid') throw new Error('unreachable');
  flowId = m.load.architecture.flows[0].id;
  firstStep = m.load.architecture.flows[0].steps[0];
  const html = renderSummary(DATA, m);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // body only: the head links remote fonts, and its theme script is not under test
  document.body.innerHTML = doc.body.innerHTML;
  const main = [...document.body.querySelectorAll('script')].find((s) => !s.type && s.textContent?.includes("getElementById('sbl-summary')"));
  if (!main) throw new Error('page script not found');
  if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') {
    (globalThis as { CSS?: unknown }).CSS = { escape: (s: string) => s.replace(/[^\w-]/g, (c) => `\\${c}`) };
  }
  new Function(main.textContent ?? '')();
});

describe('summary page client (happy-dom)', () => {
  it('marks Summary as the current tab and links the sibling pages', () => {
    const tabs = [...document.querySelectorAll<HTMLAnchorElement>('nav.tabs a')];
    expect(tabs.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')])).toEqual([
      ['Dashboard', '../', null],
      ['Summary', './', 'page'],
      ['Backlog', '../bb/', null],
    ]);
  });

  it('selecting a flow presses its chip, animates the canvas, numbers the steps and fills the panel', () => {
    const chip = $<HTMLButtonElement>(`#flows .chip[data-flow="${flowId}"]`);
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect($('#stage svg').classList.contains('flowing')).toBe(true);
    const hot = $(`.edge[data-id="${firstStep}"]`);
    expect(hot.classList.contains('hot')).toBe(true);
    expect(hot.querySelector('.step text')?.textContent).toBe('1');
    expect($('#panel').textContent?.trim().length).toBeGreaterThan(0);
  });

  it('a second click on the chip clears the flow', () => {
    const chip = $<HTMLButtonElement>(`#flows .chip[data-flow="${flowId}"]`);
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect($('#stage svg').classList.contains('flowing')).toBe(false);
  });

  it('Escape clears an active flow', () => {
    const chip = $<HTMLButtonElement>(`#flows .chip[data-flow="${flowId}"]`);
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    key(document.body, 'Escape');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect($('#stage svg').classList.contains('flowing')).toBe(false);
  });

  it('Enter on a focused node selects it', () => {
    const node = $('#stage svg .node');
    key(node, 'Enter');
    expect(node.classList.contains('sel')).toBe(true);
    key(document.body, 'Escape');
    expect(node.classList.contains('sel')).toBe(false);
  });
});
```

  Adapt the test to the real template:

  - Check that the SVG lives in `#stage` and that edges carry `data-id`:
    `grep -n "class: 'edge'\|data-id\|createElementNS" src/templates/summary.html`.
    If the svg is created elsewhere, change the selector to the element the
    script builds, without weakening the assertions.
  - `DATA` needs every field that `buildSummaryView` reads. If the cast object
    is missing one, copy the needed `DATA` fields from
    `test/unit/summary-render.test.ts`.
  - Do not stub the behaviour under test. Stubbing `CSS.escape` and catching
    the absent `getComputedTextLength` are allowed, because the page already
    tolerates it via `try/catch`.

  Run: `npx vitest run test/unit/summary-client.test.ts`

  Expected: 5 tests pass. Prove that the test is honest: temporarily change
  `String(b.getAttribute('data-flow') === id)` in the template's `setFlow` to
  `'false'`, rerun, and see the flow test fail. Then revert the change and
  check with `git diff src/templates/summary.html`, which should be empty
  for this step.

- [ ] **Step 9: Verify everything.**

  Run, in order:

  - `npm test`: expect all tests to pass. Then restore EOL-only snapshots
    except `summary-render.test.ts.snap`, whose content change from step 7
    is intended.
  - `npx tsc -p tsconfig.json --noEmit`: expect no errors.

- [ ] **Step 10: Commit.**

```bash
git add src/dashboard/render.ts src/dashboard/summary-render.ts src/dashboard/hub.ts src/commands/doctor.ts test/unit/summary-render.test.ts test/unit/dashboard-render.test.ts test/unit/hub.test.ts test/unit/doctor.test.ts test/integration/serve.test.ts test/unit/summary-client.test.ts test/unit/__snapshots__/summary-render.test.ts.snap package.json package-lock.json
git commit -m "fix(summary): single-pass templates, temp page cleanup, honest E3 fallback and DOM-level client tests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Output stability:** the probe before planning showed that no fixture,
  and not the dogfood file, has a side whose offsets exceed the clamp limit.
  It also showed that the own-leg and zone-label scoring changes no chosen
  slot. Task 4 therefore changes no snapshot. Task 2's colour rule keeps the
  existing colour test green.
- **Message stability:** `ID_PATTERN_MESSAGE` equals the old literal, and
  every refactor moves code verbatim.
- **Risk:** happy-dom may not implement an API the page uses at load time.
  The page already guards `getComputedTextLength`, `matchMedia`,
  `document.fonts` and `EventSource`. The test stubs only `CSS.escape`, and
  only when it is absent.
- **Order:** Task 5 step 2 changes source lines that Task 3 left untouched,
  and Task 4 does not touch `summary-render.ts`, so the tasks do not
  conflict.

## AC coverage

| AC | Plan task and step |
| --- | --- |
| TASK-93 #1 | Task 1 steps 1, 3 (rejections, -0, trailing spaces) and step 6 (documented) |
| TASK-93 #2 | Task 1 step 1 (flow trailing garbage, `- \|` item, quoted keys, quoted tail) |
| TASK-93 #3 | Task 1 step 4 |
| TASK-93 #4 | Task 1 step 6 (reserved keys, depth 32) and step 3.7 (header comment) |
| TASK-93 #5 | Task 1 step 7 |
| TASK-94 #1 | Task 2 step 2 (refactor commit, tests unmodified) |
| TASK-94 #2 | Task 2 step 2 (`ID_PATTERN_MESSAGE`, `ID_BODY`-derived `STEP_RE`, `LIMITS.stackPackage`) |
| TASK-94 #3 | Task 2 steps 3, 4.1-4.5 |
| TASK-94 #4 | Task 2 steps 3, 4.6 |
| TASK-94 #5 | Task 2 step 3 |
| TASK-94 #6 | Task 2 steps 2, 5 |
| TASK-95 #1 | Task 3 steps 1 (io test), 3.5 |
| TASK-95 #2 | Task 3 steps 1, 2, 3.3-3.4 |
| TASK-95 #3 | Task 3 steps 1, 3.2, 3.6 |
| TASK-95 #4 | Task 3 steps 3.1, 3.7 |
| TASK-95 #5 | Task 3 step 1 (license array, CRLF header, theme-only, extension set, rename) |
| TASK-95 #6 | Task 3 step 4 |
| TASK-96 #1 | Task 4 steps 3, 4.1-4.2 (clamp and port-overflow) and step 3 (doctor detail line) |
| TASK-96 #2 | Task 4 steps 3, 4.4-4.5, 5 (mirror, drift test) |
| TASK-96 #3 | Task 4 steps 3, 4.3 |
| TASK-96 #4 | Task 4 steps 3, 4.6, 6.1 (documented reason, label renders fully) |
| TASK-96 #5 | Task 4 step 2 (named steps, comments, unchanged output) |
| TASK-96 #6 | Task 4 step 3 (x0.9/x1.13 rescore over all edges) |
| TASK-96 #7 | Task 4 step 8 |
| TASK-97 #1 | Task 5 step 3 |
| TASK-97 #2 | Task 5 step 3 |
| TASK-97 #3 | Task 5 step 1 |
| TASK-97 #4 | Task 5 steps 1 (`tokensCss`), 2 (plurals) |
| TASK-97 #5 | Task 5 step 4 |
| TASK-97 #6 | Task 5 step 5 |
| TASK-97 #7 | Task 5 steps 6 (V2 regex, 404 body), 7 (structural snapshot), 8 (DOM test) |
| TASK-97 #8 | Task 5 step 9 |
