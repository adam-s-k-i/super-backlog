# Project Summary Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every project in the dashboard hub gets a second page at `/p/<slug>/summary/`: a management summary with automatic project facts, a curated architecture diagram (zones, nodes, labelled edges, flows, highlights), tech stack, commands and open work. The curated part comes from `backlog/docs/architecture.yml`, written by a new `architecture-summary` glue skill and validated by `sbl doctor` check 5.

**Spec:** `docs/superpowers/specs/2026-10-09-project-summary-design.md` (approved 2026-10-09). Backlog tasks TASK-85 … TASK-92 carry the acceptance criteria; this plan maps one task to each.

**Architecture:** Four pure modules feed one renderer. `parseYamlSubset` (`src/lib/yamlmini.ts`) parses the documented YAML subset; `src/dashboard/summary-schema.ts` validates it into a typed `Architecture` plus `SchemaProblem[]`; `src/dashboard/summary-facts.ts` computes facts from manifests, git and the file tree; `src/dashboard/summary-layout.ts` turns nodes and edges into deterministic orthogonal SVG geometry with warnings. `src/dashboard/summary-render.ts` combines them with the `DashboardData` the hub already collected, fills `src/templates/summary.html` (tokens shared with the dashboard through `src/templates/sbl-tokens.css`) and writes `<dashboard file>.summary.html` next to the dashboard file. It never throws; every failure becomes the reduced view plus a notice. The hub serves that file at `/p/<slug>/summary/`, and both pages share the theme key and the live-reload stream.

**Tech Stack:** TypeScript ESM, Node ≥20, Vitest 5; inline HTML/CSS/JS templates (no bundler, no framework); e2e tests run against `dist/` (`npm run build` first; `npm test` builds through `pretest`).

## Global Constraints

- **No new dependencies.** `package.json` and `package-lock.json` stay untouched.
- **Language:** UI chrome (headings, buttons, notices, warnings) is English. Curated content from `architecture.yml` is rendered as written, in the author's language.
- **Backlog tab** on the summary page links `../bb/` in the same tab (full page); the dashboard's Backlog overlay button stays unchanged.
- **Branches:** Tasks 1–6 on `feat/project-summary` (already checked out). After the Task 6 commit, run `git checkout -b feat/architecture-summary-skill` and do Tasks 7–8 there. Never push, never touch `master`.
- **Commits:** conventional commits, each with a second `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Stage only the files listed in the task (`git add <paths>`, never `git add -A` or `git add .`). Changes that `sbl phase` makes under `backlog/` are committed by the controller, not by the task.
- **Phases:** at the start of each task run `node dist/bin.js phase TASK-<n> impl`; at the end run `node dist/bin.js phase TASK-<n> verify`. If `dist/bin.js` is missing, run `npm run build` first. `done` is left to the controller. Never hand-edit backlog markdown; tasks are managed only through the CLI.
- **Shell:** PowerShell 5.1: no `&&`; chain with `;` or separate commands. No Python anywhere.
- **Commands:** single test file `npx vitest run <file>`; whole suite `npm test` (builds first); build `npm run build`; lint `npm run lint` (markdownlint + cspell on Markdown only; `docs/superpowers/plans/**` and `docs/superpowers/specs/**` are excluded).
- **Line endings:** repo files are CRLF in the working tree. When an edit anchor does not match, normalize your view, not the file: use the Edit tool on the exact text. If a test run rewrites `test/unit/__snapshots__/dashboard-render.test.ts.snap` with only line-ending churn, revert it with `git checkout -- test/unit/__snapshots__/dashboard-render.test.ts.snap`. The only intended updates of that snapshot are the explicit `-u` runs in Task 5 and Task 6.
- **Docs-Gate:** a `feat` PR that touches `src/` must change `docs/`. A new docs page needs `type:` frontmatter and a sidebar link in `docs/.vitepress/config.mts`. Task 6 satisfies this for the first branch, Task 7 for the second.
- **Security (spec, Security section):** every curated string is escaped (`esc()` on the server, the inline `esc()` on the client); `**bold**` is the only markup and only in the pitch; colors reach CSS only through the fixed token lookup; commands are text, never executed or linked.

---

### Task 1: YAML subset parser (TASK-85)

**Files:**
- Modify: `src/lib/yamlmini.ts` (append; `readSimpleKeys` stays unchanged)
- Test: `test/unit/yamlmini.test.ts` (replace the whole file; the two existing `readSimpleKeys` tests are kept verbatim inside it)

**Interfaces:**
- Consumes: nothing new.
- Produces (in `src/lib/yamlmini.ts`):
  - `export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue }`
  - `export const YAML_SUBSET_MAX_BYTES = 256 * 1024`
  - `export class YamlSubsetError extends Error { readonly line: number; readonly column: number; readonly reason: string }` with `message` = `line L, column C: reason`
  - `export function parseYamlSubset(text: string): YamlValue`. It throws `YamlSubsetError` on every rejected construct, strips a BOM, accepts CRLF and rejects input over 256 KB before parsing.

**Subset (spec D7, plus the decisions below):** block mappings and sequences with two-space indentation; single-line flow sequences `[a, b]` and flow mappings `{ k: v }`; plain, single-quoted and double-quoted scalars; integers; `true`/`false`; `null`/`~`; `>` and `|` block scalars; `#` comments. Rejected with line and column: tabs in indentation, odd indentation, anchors `&`, aliases `*`, tags `!`, `---`/`...` document markers, nested flow collections (except the one allowed case below), multi-line plain scalars, duplicate keys, an unquoted `: ` inside a plain value, and floats (only integers are numbers).

**Decision (spec conflict):** D7 says flow collections allow "one level, no nesting", but the spec's own schema writes `- { id: api, …, cell: [0, 0] }`. The parser therefore accepts a flow *sequence* of scalars as a value inside a flow *mapping*, and nothing deeper. In flow context a plain scalar ends at `,`, `}` or `]`, so a value such as a role containing a comma must be quoted (spec D7 already says so).

- [ ] **Step 1: Start the phase**

Run: `node dist/bin.js phase TASK-85 impl` (run `npm run build` first if `dist/bin.js` is missing).

- [ ] **Step 2: Write the failing tests.** Replace the whole content of `test/unit/yamlmini.test.ts` with:

```ts
// test/unit/yamlmini.test.ts
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  parseYamlSubset,
  readSimpleKeys,
  YAML_SUBSET_MAX_BYTES,
  YamlSubsetError,
} from '../../src/lib/yamlmini.js';

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

function rejects(text: string, line: number, column: number, reason: RegExp): void {
  let caught: unknown;
  try {
    parseYamlSubset(text);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(YamlSubsetError);
  const e = caught as YamlSubsetError;
  expect({ line: e.line, column: e.column, reason: e.reason }).toEqual({ line, column, reason: expect.stringMatching(reason) });
  expect(e.message).toBe(`line ${line}, column ${column}: ${e.reason}`);
}

describe('parseYamlSubset: accepted constructs', () => {
  it('parses block mappings and sequences with two-space indentation', () => {
    const text = [
      'schema: 1',
      'nodes:',
      '  - id: dev',
      '    label: Human & agent',
      '    files:',
      '      - AGENTS.md',
      '      - CLAUDE.md',
      '  - id: cli',
      'commands:',
      '  Quick start:',
      '    - { run: sbl init, note: wire a project }',
      'tasks:',
      '  TASK-85: hub',
      '',
    ].join('\n');
    expect(parseYamlSubset(text)).toEqual({
      schema: 1,
      nodes: [
        { id: 'dev', label: 'Human & agent', files: ['AGENTS.md', 'CLAUDE.md'] },
        { id: 'cli' },
      ],
      commands: { 'Quick start': [{ run: 'sbl init', note: 'wire a project' }] },
      tasks: { 'TASK-85': 'hub' },
    });
  });

  it('accepts a sequence at the same indentation as its key', () => {
    expect(parseYamlSubset('files:\n- a\n- b\nnext: 1\n')).toEqual({ files: ['a', 'b'], next: 1 });
  });

  it('parses flow sequences and flow mappings, including a flow sequence as a mapping value', () => {
    expect(
      parseYamlSubset('grid: { cols: 5, rows: 5 }\nzone: { label: Kit (sbl), cols: [1, 3], rows: [1, 4] }\nempty: []\nnone: {}\n'),
    ).toEqual({
      grid: { cols: 5, rows: 5 },
      zone: { label: 'Kit (sbl)', cols: [1, 3], rows: [1, 4] },
      empty: [],
      none: {},
    });
  });

  it('splits a flow mapping key at the first ":" followed by a space', () => {
    expect(parseYamlSubset('n: { sub: localhost:6428, label: sbl dashboard }\n')).toEqual({
      n: { sub: 'localhost:6428', label: 'sbl dashboard' },
    });
  });

  it('parses plain, single- and double-quoted scalars, integers, booleans and null', () => {
    const text = [
      'a: plain text',
      "b: 'it''s # not a comment'",
      'c: "tab\\tquote\\" \\u00e9"',
      'd: 42',
      'e: -7',
      'f: true',
      'g: false',
      'h: ~',
      'i:',
      'j: 1.6.0',
      'k: 007',
      'l: "Action[]"',
    ].join('\n');
    expect(parseYamlSubset(text)).toEqual({
      a: 'plain text',
      b: "it's # not a comment",
      c: 'tab\tquote" \u00e9',
      d: 42,
      e: -7,
      f: true,
      g: false,
      h: null,
      i: null,
      j: '1.6.0',
      k: '007',
      l: 'Action[]',
    });
  });

  it('parses folded and literal block scalars with clip and strip chomping', () => {
    const text = [
      'pitch: >',
      '  CLI kit that wires **Backlog.md**',
      '  into any project.',
      '',
      '  Second paragraph.',
      'code: |',
      '  line 1',
      '    indented # kept',
      'short: >-',
      '  no trailing newline',
      'after: x',
    ].join('\n');
    expect(parseYamlSubset(text)).toEqual({
      pitch: 'CLI kit that wires **Backlog.md** into any project.\nSecond paragraph.\n',
      code: 'line 1\n  indented # kept\n',
      short: 'no trailing newline',
      after: 'x',
    });
  });

  it('ignores full-line and trailing comments outside quotes', () => {
    const text = '# header\nkey: value # trailing\nlist: [a, b] # after flow\n  # indented comment\nq: "x # y" # z\n';
    expect(parseYamlSubset(text)).toEqual({ key: 'value', list: ['a', 'b'], q: 'x # y' });
  });

  it('parses CRLF input identically to LF and strips a BOM', () => {
    const lf = 'a: 1\nb:\n  - x\n  - { k: v }\nc: >\n  folded\n  text\n';
    const crlf = `\uFEFF${lf.replace(/\n/g, '\r\n')}`;
    expect(parseYamlSubset(crlf)).toEqual(parseYamlSubset(lf));
    expect(parseYamlSubset(lf)).toEqual({ a: 1, b: ['x', { k: 'v' }], c: 'folded text\n' });
  });

  it('returns null for an empty or comment-only document', () => {
    expect(parseYamlSubset('')).toBeNull();
    expect(parseYamlSubset('# nothing\n\n')).toBeNull();
  });
});

describe('parseYamlSubset: rejected constructs carry line and column', () => {
  it('rejects anchors', () => rejects('a: &x 1\n', 1, 4, /anchor/));
  it('rejects aliases', () => rejects('a: 1\nb: *a\n', 2, 4, /alias/));
  it('rejects tags', () => rejects('a: !!str 1\n', 1, 4, /tag/));
  it('rejects anchors inside flow collections', () => rejects('a: [x, &y z]\n', 1, 8, /anchor/));
  it('rejects multiple documents', () => rejects('a: 1\n---\nb: 2\n', 2, 1, /multiple documents/));
  it('rejects a document end marker', () => rejects('a: 1\n...\n', 2, 1, /multiple documents/));
  it('rejects directives', () => rejects('%YAML 1.2\n', 1, 1, /expected "key: value"/));
  it('rejects complex keys', () => rejects('? a\n: b\n', 1, 1, /complex keys/));
  it('rejects tabs anywhere', () => rejects('a:\n\t- x\n', 2, 1, /tab/));
  it('rejects a flow sequence nested in a flow sequence', () => rejects('a: [[x]]\n', 1, 5, /nested flow/));
  it('rejects a flow mapping nested in a flow sequence', () => rejects('a: [{ k: v }]\n', 1, 5, /nested flow/));
  it('rejects a flow mapping nested in a flow mapping', () => rejects('a: { k: { x: 1 } }\n', 1, 9, /nested flow/));
  it('rejects a flow sequence nested two levels deep', () => rejects('a: { k: [[x]] }\n', 1, 10, /nested flow/));
  it('rejects multi-line flow collections', () => rejects('a: [x,\n  y]\n', 1, 7, /same line/));
  it('rejects an unquoted comma that leaves a stray flow entry', () =>
    rejects('a: { role: unit, integration and e2e tests }\n', 1, 18, /key: value/));
  it('rejects brackets inside a flow plain scalar', () => rejects('a: { label: Action[] }\n', 1, 19, /quote values/));
  it('rejects ": " inside a plain block value', () => rejects('a: b: c\n', 1, 5, /quote the value/));
  it('rejects multi-line plain scalars', () => rejects('a: one\n  two\n', 2, 3, /multi-line plain/));
  it('rejects indentation other than two spaces', () => rejects('a:\n    b: 1\n', 2, 5, /expected indentation of 2/));
  it('rejects duplicate keys', () => rejects('a: 1\na: 2\n', 2, 1, /duplicate key "a"/));
  it('rejects unterminated quoted scalars', () => rejects('a: "open\n', 1, 4, /unterminated/));
  it('rejects unsupported block scalar headers', () => rejects('a: |2\n  x\n', 1, 4, /block scalar header/));
  it('rejects a document that does not start at column 1', () => rejects('  a: 1\n', 1, 3, /column 1/));
  it('reports the same position on CRLF input', () => rejects('a: 1\r\nb: *a\r\n', 2, 4, /alias/));
});

describe('parseYamlSubset: size limit', () => {
  it('accepts input of exactly 256 KB', () => {
    const body = `a: ${'x'.repeat(YAML_SUBSET_MAX_BYTES - 4)}\n`;
    expect(Buffer.byteLength(body)).toBe(YAML_SUBSET_MAX_BYTES);
    expect(parseYamlSubset(body)).toEqual({ a: 'x'.repeat(YAML_SUBSET_MAX_BYTES - 4) });
  });
  it('rejects input over 256 KB before parsing', () => {
    rejects(`a: ${'x'.repeat(YAML_SUBSET_MAX_BYTES)}\n`, 1, 1, /exceeds 256 KB/);
  });
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run test/unit/yamlmini.test.ts`
Expected: FAIL. The import of `parseYamlSubset`, `YAML_SUBSET_MAX_BYTES` and `YamlSubsetError` does not resolve; the two `readSimpleKeys` tests are reported with the suite error.

- [ ] **Step 4: Implement the parser.** Append the following to `src/lib/yamlmini.ts`, after the closing `}` of `readSimpleKeys` (the file currently ends at line 16):

```ts
/* ---------------------------------------------------------------------------
 * parseYamlSubset: the documented YAML subset used by backlog/docs/architecture.yml
 * (spec 2026-10-09-project-summary-design.md, D7). Supported: block mappings and
 * sequences (two-space indentation), single-line flow sequences/mappings, plain,
 * single- and double-quoted scalars, integers, booleans, null, `|`/`>` block
 * scalars (with optional `-` chomping) and `#` comments. Rejected with line and
 * column: anchors, aliases, tags, directives, multi-documents, complex keys,
 * tabs, multi-line flow collections and nested flow collections (a flow mapping
 * may hold a flow sequence of scalars as a value, nothing deeper).
 * ------------------------------------------------------------------------- */

export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

export const YAML_SUBSET_MAX_BYTES = 256 * 1024;

export class YamlSubsetError extends Error {
  readonly line: number;
  readonly column: number;
  readonly reason: string;
  constructor(line: number, column: number, reason: string) {
    super(`line ${line}, column ${column}: ${reason}`);
    this.name = 'YamlSubsetError';
    this.line = line;
    this.column = column;
    this.reason = reason;
  }
}

interface SrcLine {
  /** 1-based line number */
  no: number;
  indent: number;
  /** text after the indentation, trailing spaces removed */
  content: string;
  /** true for empty and comment-only lines */
  blank: boolean;
}

const INT_RE = /^-?(?:0|[1-9][0-9]*)$/;
const RESERVED_START = new Set(['&', '*', '!', '%', '@', '`']);

class Parser {
  private readonly lines: SrcLine[];
  private pos = 0;

  constructor(text: string) {
    this.lines = text.split('\n').map((raw, i) => {
      const no = i + 1;
      const tab = raw.indexOf('\t');
      if (tab !== -1) throw new YamlSubsetError(no, tab + 1, 'tab characters are not allowed');
      const trimmed = raw.replace(/ +$/, '');
      const indent = trimmed.length - trimmed.trimStart().length;
      const content = trimmed.slice(indent);
      if (indent === 0 && (content === '---' || content.startsWith('--- ') || content === '...')) {
        throw new YamlSubsetError(no, 1, 'multiple documents are not supported');
      }
      return { no, indent, content, blank: content === '' || content.startsWith('#') };
    });
  }

  parseDocument(): YamlValue {
    const first = this.peek();
    if (first === null) return null;
    if (first.indent !== 0) throw this.err(first, 0, 'the document must start at column 1');
    const value = this.parseBlock(0);
    const rest = this.peek();
    if (rest !== null) throw this.err(rest, 0, 'unexpected line (check the indentation)');
    return value;
  }

  private err(line: SrcLine, offset: number, reason: string): YamlSubsetError {
    return new YamlSubsetError(line.no, line.indent + offset + 1, reason);
  }

  /** Next significant line, skipping blanks and comments. */
  private peek(): SrcLine | null {
    while (this.pos < this.lines.length && this.lines[this.pos].blank) this.pos += 1;
    return this.pos < this.lines.length ? this.lines[this.pos] : null;
  }

  private static isSeqItem(content: string): boolean {
    return content === '-' || content.startsWith('- ');
  }

  private parseBlock(indent: number): YamlValue {
    const line = this.peek();
    if (line === null) return null;
    return Parser.isSeqItem(line.content) ? this.parseSequence(indent) : this.parseMapping(indent);
  }

  private parseSequence(indent: number): YamlValue[] {
    const out: YamlValue[] = [];
    for (;;) {
      const line = this.peek();
      if (line === null || line.indent < indent) break;
      if (line.indent > indent) throw this.err(line, 0, `unexpected indentation (expected ${indent} spaces; multi-line plain values need "|" or ">")`);
      if (!Parser.isSeqItem(line.content)) break;
      const rest = line.content.slice(1).trimStart();
      if (rest === '' || rest.startsWith('#')) {
        this.pos += 1;
        const next = this.peek();
        if (next !== null && next.indent > indent) {
          if (next.indent !== indent + 2) throw this.err(next, 0, `expected indentation of ${indent + 2} spaces`);
          out.push(this.parseBlock(indent + 2));
        } else {
          out.push(null);
        }
        continue;
      }
      // "- key: value" or "- - x": re-read the remainder as a block at indent + 2
      const offset = line.content.length - rest.length;
      if (offset !== 2) throw this.err(line, 1, 'use exactly one space after "-"');
      if (Parser.isSeqItem(rest) || this.mappingKey(line, rest, 2) !== null) {
        this.lines[this.pos] = { no: line.no, indent: indent + 2, content: rest, blank: false };
        out.push(this.parseBlock(indent + 2));
        continue;
      }
      out.push(this.parseInlineValue(line, rest, 2, indent));
    }
    return out;
  }

  private parseMapping(indent: number): { [key: string]: YamlValue } {
    const out: { [key: string]: YamlValue } = {};
    for (;;) {
      const line = this.peek();
      if (line === null || line.indent < indent) break;
      if (line.indent > indent) throw this.err(line, 0, `unexpected indentation (expected ${indent} spaces; multi-line plain values need "|" or ">")`);
      if (Parser.isSeqItem(line.content)) break;
      const entry = this.mappingKey(line, line.content, 0);
      if (entry === null) throw this.err(line, 0, 'expected "key: value"');
      if (Object.prototype.hasOwnProperty.call(out, entry.key)) {
        throw this.err(line, 0, `duplicate key "${entry.key}"`);
      }
      const rest = line.content.slice(entry.valueOffset);
      if (rest === '' || rest.startsWith('#')) {
        this.pos += 1;
        const next = this.peek();
        if (next !== null && next.indent > indent) {
          if (next.indent !== indent + 2) throw this.err(next, 0, `expected indentation of ${indent + 2} spaces`);
          out[entry.key] = this.parseBlock(indent + 2);
        } else if (next !== null && next.indent === indent && Parser.isSeqItem(next.content)) {
          out[entry.key] = this.parseSequence(indent);
        } else {
          out[entry.key] = null;
        }
        continue;
      }
      out[entry.key] = this.parseInlineValue(line, rest, entry.valueOffset, indent);
    }
    return out;
  }

  /**
   * Recognises "key:" at the start of text. Returns null when text is not a
   * mapping entry. valueOffset points at the first character of the value
   * (relative to line.content).
   */
  private mappingKey(line: SrcLine, text: string, base: number): { key: string; valueOffset: number } | null {
    const first = text[0];
    if (first === '?' && (text.length === 1 || text[1] === ' ')) {
      throw this.err(line, base, 'complex keys ("? ") are not supported');
    }
    if (first === '"' || first === "'") {
      const q = this.readQuoted(line, text, 0, base);
      const after = text.slice(q.end);
      if (!/^ *:(?: |$)/.test(after)) return null;
      const colon = q.end + after.indexOf(':');
      return { key: q.value, valueOffset: base + skipSpaces(text, colon + 1) };
    }
    if (first === '[' || first === '{' || first === '#') return null;
    const m = /:(?: |$)/.exec(text);
    if (m === null) return null;
    const key = text.slice(0, m.index).trimEnd();
    if (key === '' || key.includes(' #')) return null;
    if (RESERVED_START.has(key[0])) throw this.err(line, base, `"${key[0]}" (anchor, alias, tag or directive) is not supported`);
    return { key, valueOffset: base + skipSpaces(text, m.index + 1) };
  }

  /** A value that starts on the current line (scalar, quoted, flow or block scalar). */
  private parseInlineValue(line: SrcLine, text: string, offset: number, parentIndent: number): YamlValue {
    const c = text[0];
    if (c === '|' || c === '>') {
      this.pos += 1;
      return this.parseBlockScalar(line, text, offset, parentIndent);
    }
    let value: YamlValue;
    if (c === '[' || c === '{') {
      const flow = new FlowReader(line, text, offset, this);
      value = flow.readTop();
    } else if (c === '"' || c === "'") {
      const q = this.readQuoted(line, text, 0, offset);
      const tail = text.slice(q.end).trimStart();
      if (tail !== '' && !tail.startsWith('#')) {
        throw this.err(line, offset + q.end, 'unexpected text after quoted scalar');
      }
      value = q.value;
    } else {
      value = this.plainBlockScalar(line, text, offset);
    }
    this.pos += 1;
    return value;
  }

  private plainBlockScalar(line: SrcLine, text: string, offset: number): YamlValue {
    if (RESERVED_START.has(text[0])) {
      throw this.err(line, offset, `"${text[0]}" (anchor, alias, tag or directive) is not supported`);
    }
    const hash = text.indexOf(' #');
    const raw = (hash === -1 ? text : text.slice(0, hash)).trimEnd();
    const colon = raw.search(/: /);
    if (colon !== -1) throw this.err(line, offset + colon, 'plain values must not contain ": " - quote the value');
    return resolvePlain(raw);
  }

  private parseBlockScalar(line: SrcLine, text: string, offset: number, parentIndent: number): string {
    const m = /^([|>])(-?)(?: +#.*)?$/.exec(text);
    if (m === null) throw this.err(line, offset, 'block scalar header must be "|", "|-", ">" or ">-"');
    const literal = m[1] === '|';
    const strip = m[2] === '-';
    // collect raw lines (blank lines included) that are indented deeper than the parent
    const body: Array<{ indent: number; content: string }> = [];
    let contentIndent = -1;
    while (this.pos < this.lines.length) {
      const l = this.lines[this.pos];
      if (l.content === '') {
        body.push({ indent: 0, content: '' });
        this.pos += 1;
        continue;
      }
      if (l.indent <= parentIndent) break;
      if (contentIndent === -1) contentIndent = l.indent;
      if (l.indent < contentIndent) throw this.err(l, 0, 'block scalar lines must keep their indentation');
      body.push({ indent: l.indent, content: ' '.repeat(l.indent - contentIndent) + l.content });
      this.pos += 1;
    }
    // trailing blank lines belong to chomping, not content; give them back to the line stream
    while (body.length > 0 && body[body.length - 1].content === '') {
      body.pop();
      this.pos -= 1;
    }
    while (this.pos < this.lines.length && this.lines[this.pos].content === '') this.pos += 1;
    if (body.length === 0) return '';
    let joined: string;
    if (literal) {
      joined = body.map((b) => b.content).join('\n');
    } else {
      joined = '';
      for (let i = 0; i < body.length; i++) {
        const cur = body[i].content;
        if (i === 0) {
          joined = cur;
          continue;
        }
        const prev = body[i - 1].content;
        if (cur === '') joined += '\n';
        else if (prev === '' || cur.startsWith(' ') || prev.startsWith(' ')) joined += (prev === '' ? '' : '\n') + cur;
        else joined += ` ${cur}`;
      }
    }
    return strip ? joined : `${joined}\n`;
  }

  /** Reads a quoted scalar starting at text[start]; returns the value and the index after the closing quote. */
  readQuoted(line: SrcLine, text: string, start: number, base: number): { value: string; end: number } {
    const quote = text[start];
    let out = '';
    let i = start + 1;
    while (i < text.length) {
      const ch = text[i];
      if (quote === "'") {
        if (ch === "'") {
          if (text[i + 1] === "'") {
            out += "'";
            i += 2;
            continue;
          }
          return { value: out, end: i + 1 };
        }
        out += ch;
        i += 1;
        continue;
      }
      if (ch === '"') return { value: out, end: i + 1 };
      if (ch === '\\') {
        const e = text[i + 1];
        const simple: Record<string, string> = { '\\': '\\', '"': '"', '/': '/', n: '\n', t: '\t', r: '\r', '0': '\0' };
        if (e !== undefined && e in simple) {
          out += simple[e];
          i += 2;
          continue;
        }
        if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
          out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
          i += 6;
          continue;
        }
        throw this.err(line, base + i, 'unsupported escape sequence');
      }
      out += ch;
      i += 1;
    }
    throw this.err(line, base + start, 'unterminated quoted scalar (quoted values must end on the same line)');
  }

  flowError(line: SrcLine, offset: number, reason: string): YamlSubsetError {
    return this.err(line, offset, reason);
  }
}

function skipSpaces(text: string, i: number): number {
  let j = i;
  while (text[j] === ' ') j += 1;
  return j;
}

function resolvePlain(raw: string): YamlValue {
  if (raw === '' || raw === '~' || raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (INT_RE.test(raw)) {
    const n = Number(raw);
    if (Number.isSafeInteger(n)) return n;
  }
  return raw;
}

/** Single-line flow collections: `[a, b]`, `{ k: v }`, `{ k: [a, b] }`. */
class FlowReader {
  private i = 0;
  constructor(
    private readonly line: SrcLine,
    private readonly text: string,
    private readonly offset: number,
    private readonly parser: Parser,
  ) {}

  private fail(at: number, reason: string): never {
    throw this.parser.flowError(this.line, this.offset + at, reason);
  }

  private ws(): void {
    while (this.text[this.i] === ' ') this.i += 1;
  }

  readTop(): YamlValue {
    const value = this.text[0] === '[' ? this.readSeq(0) : this.readMap();
    this.ws();
    if (this.i < this.text.length && this.text[this.i] !== '#') this.fail(this.i, 'unexpected text after flow collection');
    return value;
  }

  /** depth 0 = top-level sequence, depth 1 = sequence nested as a flow-mapping value */
  private readSeq(depth: number): YamlValue[] {
    const out: YamlValue[] = [];
    this.i += 1; // [
    this.ws();
    if (this.text[this.i] === ']') {
      this.i += 1;
      return out;
    }
    for (;;) {
      this.ws();
      const c = this.text[this.i];
      if (c === '[' || c === '{') this.fail(this.i, 'nested flow collections are not supported');
      out.push(this.readScalar(']'));
      this.ws();
      const sep = this.text[this.i];
      if (sep === ',') {
        this.i += 1;
        continue;
      }
      if (sep === ']') {
        this.i += 1;
        return out;
      }
      if (sep === undefined) this.fail(this.i, 'flow collections must close on the same line');
      this.fail(this.i, depth === 0 ? 'expected "," or "]"' : 'expected "," or "]" in nested sequence');
    }
  }

  private readMap(): { [key: string]: YamlValue } {
    const out: { [key: string]: YamlValue } = {};
    this.i += 1; // {
    this.ws();
    if (this.text[this.i] === '}') {
      this.i += 1;
      return out;
    }
    for (;;) {
      this.ws();
      const keyAt = this.i;
      const c = this.text[this.i];
      if (c === '[' || c === '{') this.fail(this.i, 'nested flow collections are not supported');
      let key: string;
      if (c === '"' || c === "'") {
        const q = this.parser.readQuoted(this.line, this.text, this.i, this.offset);
        key = q.value;
        this.i = q.end;
        this.ws();
      } else {
        const rest = this.text.slice(this.i);
        const m = /:(?: |(?=[,}])|$)/.exec(rest);
        if (m === null) this.fail(this.i, 'expected "key: value" in flow mapping');
        key = rest.slice(0, m.index).trim();
        if (key === '' || /[,[\]{}#]/.test(key)) this.fail(this.i, 'invalid key in flow mapping');
        if (RESERVED_START.has(key[0])) this.fail(this.i, `"${key[0]}" (anchor, alias, tag or directive) is not supported`);
        this.i += m.index;
      }
      if (this.text[this.i] !== ':') this.fail(this.i, 'expected ":" after key');
      this.i += 1;
      if (Object.prototype.hasOwnProperty.call(out, key)) this.fail(keyAt, `duplicate key "${key}"`);
      this.ws();
      const v = this.text[this.i];
      if (v === '{') this.fail(this.i, 'nested flow collections are not supported');
      out[key] = v === '[' ? this.readSeq(1) : this.readScalar('}');
      this.ws();
      const sep = this.text[this.i];
      if (sep === ',') {
        this.i += 1;
        continue;
      }
      if (sep === '}') {
        this.i += 1;
        return out;
      }
      if (sep === undefined) this.fail(this.i, 'flow collections must close on the same line');
      this.fail(this.i, 'expected "," or "}"');
    }
  }

  private readScalar(close: ']' | '}'): YamlValue {
    const c = this.text[this.i];
    if (c === '"' || c === "'") {
      const q = this.parser.readQuoted(this.line, this.text, this.i, this.offset);
      this.i = q.end;
      return q.value;
    }
    const start = this.i;
    while (this.i < this.text.length) {
      const ch = this.text[this.i];
      if (ch === ',' || ch === ']' || ch === '}') break;
      if (ch === '#' && this.text[this.i - 1] === ' ') break;
      if (ch === '[' || ch === '{') this.fail(this.i, 'quote values containing [ ] { } or , inside flow collections');
      this.i += 1;
    }
    const raw = this.text.slice(start, this.i).trim();
    if (raw === '' && (this.text[this.i] === ',' || this.text[this.i] === close)) {
      this.fail(start, 'empty entry in flow collection');
    }
    if (RESERVED_START.has(raw[0])) this.fail(start, `"${raw[0]}" (anchor, alias, tag or directive) is not supported`);
    const colon = raw.search(/: /);
    if (colon !== -1) this.fail(start + colon, 'plain values must not contain ": " - quote the value');
    return resolvePlain(raw);
  }
}

/**
 * Parses the documented YAML subset. Throws YamlSubsetError (with 1-based
 * line and column) for anything outside it and for input over 256 KB.
 */
export function parseYamlSubset(text: string): YamlValue {
  if (Buffer.byteLength(text, 'utf8') > YAML_SUBSET_MAX_BYTES) {
    throw new YamlSubsetError(1, 1, `file exceeds ${YAML_SUBSET_MAX_BYTES / 1024} KB`);
  }
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  return new Parser(normalized).parseDocument();
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run test/unit/yamlmini.test.ts`
Expected: PASS, 37 tests.

- [ ] **Step 6: Type-check and build**

Run: `npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/yamlmini.ts test/unit/yamlmini.test.ts
git commit -m "feat(summary): YAML subset parser for architecture.yml" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Hand over to verify**

Run: `node dist/bin.js phase TASK-85 verify`

---

### Task 2: `architecture.yml` schema and validation (TASK-86)

**Files:**
- Create: `src/dashboard/summary-schema.ts`
- Create: `test/fixtures/summary/architecture.super-backlog.yml`, `test/fixtures/summary/architecture.kursbuchung.yml` (the two prototype datasets from `design-demos/project-summary-v5.html`, transcribed to the schema; also used by Task 4 and Task 5)
- Test: `test/unit/summary-schema.test.ts`

**Interfaces:**
- Consumes: `parseYamlSubset`, `YamlSubsetError`, `YamlValue` from Task 1.
- Produces (in `src/dashboard/summary-schema.ts`):
  - `ARCHITECTURE_PATH = 'backlog/docs/architecture.yml'`, `COLOR_TOKENS`, `ColorToken`, `ID_RE`, `LIMITS`, `DEFAULT_KINDS`
  - types `Architecture`, `ArchKind`, `ArchZone`, `ArchNode`, `ArchCommand`, `ArchEdge`, `ArchFlow`, `ArchHighlight`, `ArchStackEntry`, `SchemaProblem { level: 'error' | 'warning'; path: string; message: string }`
  - `type ArchitectureLoadResult = { status: 'missing'; path } | { status: 'invalid'; path; problems } | { status: 'valid'; path; architecture; problems }` (valid may still carry warnings)
  - `validateArchitecture(value: YamlValue, opts?: { taskIds?: readonly string[] })`
  - `checkArchitectureText(text: string, path: string, taskIds?: readonly string[]): ArchitectureLoadResult`
  - `loadArchitecture(cwd: string, opts?: { taskIds?: readonly string[] }): ArchitectureLoadResult`

**Rules (spec schema section):** errors make the file invalid; warnings keep it valid. Errors: wrong or missing `schema`, missing `pitch`/`grid`/`nodes`/`edges`, bad ids (`^[a-z][a-z0-9-]{0,31}$`), unknown kind, unknown color token, duplicate id, duplicate cell, cell outside the grid (`nodes[3].cell: outside grid 5x5`), dangling edge, overlapping zones, a second highlight on one node, and every size limit in `LIMITS`. Warnings: unknown top-level or nested keys (the key is ignored), a flow step without a matching edge (the flow is dropped), and an unknown task id in `tasks:` (only checked when `taskIds` is passed). A parse error becomes one error with path `line L, column C`.

**Decision:** unknown keys are warnings, not errors, so a file written for a later schema minor still renders. Limits live in one exported `LIMITS` object, so the guide and the tests use the same numbers.

- [ ] **Step 1: Start the phase**

Run: `node dist/bin.js phase TASK-86 impl`

- [ ] **Step 2: Add the fixtures.** Create `test/fixtures/summary/architecture.super-backlog.yml`:

```yaml
schema: 1
pitch: >
  CLI kit that wires **Backlog.md** and **Superpowers** into any project: a binding
  agent pipeline with gates, glue skills, a live dashboard and a verified uninstall.
grid: { cols: 5, rows: 5 }
zones:
  - { label: Entry, cols: [0, 0], rows: [2, 4] }
  - { label: Kit (sbl), cols: [1, 3], rows: [1, 4] }
  - { label: Target project / external, cols: [4, 4], rows: [0, 4] }
nodes:
  - id: dev
    label: Human & agent
    sub: shell · Claude Code
    kind: actor
    cell: [0, 2]
    purpose: Starts every flow; human and agent use the same commands.
    why: One entry for both; what the agent may read is versioned in the repo.
    files: [AGENTS.md, CLAUDE.md]
    commands:
      - { run: sbl init, note: wire a project }
  - id: browser
    label: Browser
    sub: localhost:6428
    kind: actor
    cell: [0, 4]
    purpose: Shows dashboard, summary and the embedded Backlog browser; holds the SSE connection.
    why: The browser is the only UI, nothing to install.
  - id: cli
    label: sbl CLI
    sub: bin.ts · commands/
    kind: core
    cell: [1, 2]
    purpose: Parses arguments, dispatches seven commands, normalises exit codes, runs preflight and self-update.
    why: One global command for every project; five exit codes keep CI and agents unambiguous.
    files: [src/bin.ts, src/cli.ts, src/commands/]
    commands:
      - { run: sbl doctor, note: check the environment }
  - id: planner
    label: Init planner
    sub: init/planner.ts
    kind: core
    cell: [2, 1]
    purpose: Turns detected state plus options into a declarative Action[] without side effects.
    why: Actions are data, so planning is unit-testable and --dry-run is free.
    files: [src/init/planner.ts]
    commands:
      - { run: sbl init --dry-run, note: plan only }
  - id: executor
    label: Executor
    sub: init/execute.ts
    kind: core
    cell: [3, 1]
    purpose: Applies each action atomically; content comes from templates stamped with the kit version.
    why: Degraded situations become warnings or refusals, never silent overwrites.
    files: [src/init/execute.ts, src/lib/atomic.ts, src/templates/]
  - id: ownership
    label: Ownership & uninstall
    sub: lib/ownership.ts
    kind: core
    cell: [2, 2]
    purpose: Decides per artifact whether the kit owns it and removes only what it can prove.
    why: Ambiguity is reported as kept, never changed.
    files: [src/lib/ownership.ts, src/commands/uninstall.ts]
  - id: phase
    label: Phase labels
    sub: lib/phase.ts
    kind: core
    cell: [2, 3]
    purpose: Reads and sets the pipeline label of a task; doctor checks hygiene.
    why: A label instead of a file means every session resumes at the last gate.
    files: [src/lib/phase.ts, src/commands/phase.ts]
  - id: router
    label: Model router
    sub: src/models/ · opt-in
    kind: optional
    cell: [3, 3]
    purpose: Maps cheaper models to simple agents; installed only with --models.
    why: Opt-in keeps the default untouched.
    files: [src/models/]
  - id: hub
    label: Dashboard hub
    sub: dashboard/ · :6428
    kind: output
    cell: [1, 4]
    purpose: One port for many projects; reads tasks via the Backlog CLI, renders HTML, pushes SSE reloads.
    why: No frontend build, no framework, no database.
    files: [src/dashboard/, src/templates/dashboard.html, src/templates/summary.html]
    commands:
      - { run: sbl dashboard, note: start the hub }
  - id: project
    label: Project files
    sub: AGENTS.md · skills
    kind: output
    cell: [4, 1]
    purpose: Everything written into the target project carries an ownership proof.
    why: One workflow block for all harnesses; CLAUDE.md holds only a pointer.
    files: [AGENTS.md, .claude/skills/, .opencode/skill/]
  - id: npm
    label: npm registry
    sub: super-backlog
    kind: external
    cell: [4, 0]
    purpose: Distributes the package and answers the self-update version check.
    why: release-please tags, publish ships; no manual releases.
  - id: backlog
    label: Backlog.md CLI
    sub: backlog/ · tasks
    kind: external
    cell: [4, 4]
    purpose: Owns tasks, milestones and decisions as Markdown; the kit talks to it only through its CLI.
    why: No fork, no vendoring; devDependency on latest.
  - id: superpowers
    label: Superpowers
    sub: methodology skills
    kind: external
    cell: [4, 3]
    purpose: Supplies the agent methodology via plugin entry or marketplace, never as a copy.
    why: The kit owns only the glue (decision D6).
edges:
  - { from: dev, to: cli, label: sbl … }
  - { from: cli, to: npm, label: version check, text: update checks its own version before refreshing. }
  - { from: cli, to: planner, label: plans }
  - { from: planner, to: executor, label: "Action[]", text: The action list is the only interface between planning and writing. }
  - { from: executor, to: project, label: writes }
  - { from: project, to: superpowers, label: plugin entry }
  - { from: cli, to: ownership, label: uninstall }
  - { from: ownership, to: project, label: removes }
  - { from: ownership, to: router, label: cleans up }
  - { from: cli, to: phase, label: phase }
  - { from: phase, to: backlog, label: task edit }
  - { from: cli, to: hub, label: dashboard }
  - { from: hub, to: backlog, label: task list --json }
  - { from: hub, to: browser, label: HTML + SSE }
flows:
  - { id: init, label: sbl init, command: sbl init, steps: [dev>cli, cli>planner, planner>executor, executor>project, project>superpowers] }
  - { id: update, label: sbl update, command: sbl update, color: warn, steps: [dev>cli, cli>npm, cli>planner, planner>executor, executor>project] }
  - { id: dashboard, label: sbl dashboard, command: sbl dashboard, color: ok, steps: [dev>cli, cli>hub, hub>backlog, hub>browser] }
  - { id: uninstall, label: sbl uninstall, command: sbl uninstall, color: rose, steps: [dev>cli, cli>ownership, ownership>project, ownership>router] }
highlights:
  - { node: planner, title: "Plan, then act", text: "Pure planner, atomic executor, --dry-run for free." }
  - { node: project, title: Ownership by marker, text: "Marker, fingerprint or exact default value as proof." }
  - { node: ownership, title: Verified uninstall, text: Removes only proven ownership and reports every decision. }
  - { node: hub, title: Live without a build, text: "One HTML file, SSE reload, many projects on one port." }
stack:
  - { name: TypeScript, package: typescript, group: Runtime, role: "language, tsc build to dist/", nodes: [cli, planner, executor, hub] }
  - { name: cross-spawn, package: cross-spawn, group: Runtime, role: the only runtime dependency, nodes: [executor, cli] }
  - { name: Vitest, package: vitest, group: Quality, role: "unit, integration and e2e tests", nodes: [planner, executor, hub] }
  - { name: backlog.md, package: backlog.md, group: Integration, role: "devDependency, task data", nodes: [backlog, hub, phase] }
commands:
  Quick start:
    - { run: sbl init, note: wire a project }
    - { run: sbl dashboard, note: dashboard on :6428 }
  Development:
    - { run: npm test, note: build + Vitest }
    - { run: npm run lint, note: markdownlint + cspell }
tasks:
  TASK-85: hub
```

Create `test/fixtures/summary/architecture.kursbuchung.yml` (curated content in German on purpose: it shows that curated text stays in the author's language):

```yaml
# Fixture: the "kursbuchung" prototype dataset (WordPress theme + plugin).
# Curated content stays in the author's language (German here).
schema: 1
pitch: >
  Kleine Buchungsseite für Yoga- und Kochkurse: **Block-Theme** für die Darstellung,
  ein **Plugin** für Kurse, Buchungen und Zahlung, Deploy per Tag über **GitHub Actions**.
grid: { cols: 5, rows: 5 }
kinds:
  actor: { label: Akteur, color: muted }
  theme: { label: Theme, color: violet }
  plugin: { label: Plugin, color: accent }
  ops: { label: Delivery, color: ok }
  ext: { label: externer Dienst, color: dim, dashed: true }
zones:
  - { label: Delivery, cols: [0, 2], rows: [0, 0] }
  - { label: "Nutzer:innen", cols: [0, 0], rows: [1, 2] }
  - { label: Theme, cols: [1, 1], rows: [2, 2] }
  - { label: Plugin kursbuchung-core, cols: [2, 3], rows: [1, 4] }
  - { label: Dienste, cols: [4, 4], rows: [1, 3] }
nodes:
  - id: dev
    label: "Entwickler:in"
    sub: Git · wp-env
    kind: actor
    cell: [0, 0]
    purpose: Entwickelt lokal mit wp-env, testet mit PHPUnit und löst Deploys über Git-Tags aus.
    why: Ein Tag ist ein Release. Kein FTP, kein Klick-Deploy aus dem Admin.
    files: [.wp-env.json, composer.json, package.json]
    commands:
      - { run: npx wp-env start, note: lokale WordPress-Instanz }
  - id: gha
    label: GitHub Actions
    sub: ci.yml · deploy.yml
    kind: ops
    cell: [1, 0]
    purpose: >
      CI auf jedem Push (phpcs, PHPUnit, Block-Build); Deploy nur bei Tag v*:
      Build, Staging-Smoke-Test, rsync auf den Hoster.
    why: Deploy nur per Tag; jede Live-Version hat einen Namen und lässt sich zurückrollen.
    files: [.github/workflows/ci.yml, .github/workflows/deploy.yml, scripts/smoke.sh]
    commands:
      - { run: gh workflow run deploy.yml -f ref=v2.3.1, note: Deploy manuell anstoßen }
      - { run: gh run watch, note: laufenden Workflow verfolgen }
  - id: hosting
    label: Staging & Hosting
    sub: Hetzner · rsync
    kind: ops
    cell: [2, 0]
    purpose: Staging mit Mollie im Testmodus prüft Startseite, Kursliste und einen Buchungs-Dry-Run; danach rsync nach Produktion.
    why: Nur Theme und Plugin werden deployt; Kern und Uploads bleiben beim Hoster.
    files: [scripts/deploy.sh]
    commands:
      - { run: wp cache flush, note: Cache nach Deploy leeren }
  - id: admin
    label: Kursleitung
    sub: WP-Admin · Rolle
    kind: actor
    cell: [0, 1]
    purpose: Legt Kurse mit Terminen und Platzzahl an, sieht Buchungen und exportiert Teilnehmerlisten.
    why: Minimale Rechte; ein kompromittiertes Konto kann keine Plugins installieren.
    files: [includes/class-roles.php]
    commands:
      - { run: wp kb bookings list --kurs=yoga-mai, note: Buchungen eines Kurses }
  - id: visitor
    label: "Besucher:in"
    sub: Browser · Kursseite
    kind: actor
    cell: [0, 2]
    purpose: Sucht einen Kurs, bucht einen Platz und bezahlt; bekommt Bestätigung und Erinnerung per E-Mail.
    why: Buchen ohne Konto. Jede Hürde mehr kostet Buchungen.
  - id: theme
    label: Block-Theme
    sub: theme.json · Blöcke
    kind: theme
    cell: [1, 2]
    purpose: Globale Styles, Templates für Kursliste und Kursdetail, zwei eigene Blöcke.
    why: Site-Editor statt Page-Builder; Interactivity API statt eigenem Framework.
    files: [theme.json, templates/archive-kurs.html, templates/single-kurs.html, src/blocks/buchung/view.js]
    commands:
      - { run: npm run build, note: Block-Assets bauen }
  - id: cpt
    label: Kurs & Buchung
    sub: post-types.php
    kind: plugin
    cell: [2, 1]
    purpose: Registriert die Post Types kurs und buchung mit Meta-Feldern und Admin-Spalten.
    why: Kurse als Posts; Revisionen, Rechte und REST gibt es gratis.
    files: [includes/class-post-types.php, includes/class-meta.php]
  - id: rest
    label: REST-Endpunkte
    sub: rest/ · kb/v1
    kind: plugin
    cell: [2, 2]
    purpose: POST /buchungen legt eine Buchung an, GET /kurse/{id}/plaetze liefert freie Plätze.
    why: Eigener Namespace mit Schema; Validierung und Doku aus derselben Definition.
    files: [includes/rest/class-bookings-controller.php]
    commands:
      - { run: wp rest route list --namespace=kb/v1, note: registrierte Routen }
  - id: booking
    label: Buchungslogik
    sub: booking-service.php
    kind: plugin
    cell: [3, 2]
    purpose: Reserviert Plätze 15 Minuten, erzeugt die Mollie-Zahlung, bestätigt oder verwirft die Buchung.
    why: Reservierung mit Ablauf verhindert Doppelbuchungen beim letzten Platz.
    files: [includes/class-booking-service.php, includes/class-seat-lock.php]
    commands:
      - { run: wp kb bookings expire --dry-run, note: verfallene Reservierungen }
  - id: payment
    label: Zahlungs-Webhook
    sub: mollie-webhook.php
    kind: plugin
    cell: [4, 3]
    purpose: Nimmt den Mollie-Webhook entgegen und fragt den Zahlungsstatus bei Mollie nach.
    why: Webhook nur als Anstoß, Wahrheit kommt per API.
    files: [includes/class-mollie-webhook.php]
    commands:
      - { run: wp kb mollie status tr_7UhSN1zuXS, note: Zahlung nachschlagen }
  - id: mail
    label: Benachrichtigungen
    sub: wp_mail → SMTP
    kind: plugin
    cell: [2, 3]
    purpose: Bestätigung, Erinnerung 24 h vorher und Absage an Teilnehmende.
    why: Ein Relay mit DKIM landet nicht im Spam.
    files: [includes/class-notifications.php, mu-plugins/kb-smtp.php]
  - id: cron
    label: Cron-Jobs
    sub: class-cron.php
    kind: plugin
    cell: [3, 4]
    purpose: Gibt abgelaufene Reservierungen frei und verschickt Erinnerungen per System-Cron.
    why: Zwei idempotente Jobs; ein verpasster Lauf wird nachgeholt.
    files: [includes/class-cron.php]
    commands:
      - { run: wp cron event run kb_reminders, note: Erinnerungen jetzt verschicken }
  - id: mysql
    label: MySQL
    sub: wp_posts · locks
    kind: ext
    cell: [4, 1]
    purpose: Speichert Kurse und Buchungen als Posts; Reservierungen in einer eigenen Tabelle.
    why: Ein UNIQUE-Index macht Doppelbuchungen auf Datenbank-Ebene unmöglich.
    commands:
      - { run: 'wp db query "SELECT COUNT(*) FROM wp_kb_seat_locks"', note: aktive Reservierungen }
  - id: mollie
    label: Mollie
    sub: API v2 · Webhooks
    kind: ext
    cell: [4, 2]
    purpose: Erzeugt den Checkout, wickelt die Zahlung ab und ruft den Webhook.
    why: Keine Kartendaten auf dem Server.
edges:
  - { from: dev, to: gha, label: pusht Tag v* }
  - { from: gha, to: hosting, label: Build · rsync }
  - { from: admin, to: cpt, label: legt Kurs an }
  - { from: cpt, to: mysql, label: Post + Meta }
  - { from: theme, to: cpt, label: liest Kurse }
  - { from: visitor, to: theme, label: öffnet Kurs }
  - { from: theme, to: rest, label: sendet Buchung, text: Das Formular schickt JSON mit Nonce an kb/v1/buchungen. }
  - { from: rest, to: booking, label: legt an }
  - { from: booking, to: mysql, label: Lock + Buchung }
  - { from: booking, to: mollie, label: Zahlung }
  - { from: mollie, to: payment, label: Webhook }
  - { from: payment, to: booking, label: Status }
  - { from: booking, to: mail, label: Mail auslösen }
  - { from: mail, to: visitor, label: E-Mail (SMTP) }
  - { from: cron, to: booking, label: expire / remind }
flows:
  - { id: buchen, label: Kurs buchen, steps: [visitor>theme, theme>rest, rest>booking, booking>mysql, booking>mollie] }
  - { id: zahlung, label: Zahlung bestätigen, command: wp kb mollie status tr_7UhSN1zuXS, steps: [mollie>payment, payment>booking, booking>mysql, booking>mail, mail>visitor] }
  - { id: anlegen, label: Kurs anlegen, color: rose, steps: [admin>cpt, cpt>mysql, theme>cpt] }
  - { id: erinnerung, label: Erinnerung senden, color: warn, command: wp cron event run kb_reminders, steps: [cron>booking, booking>mail, mail>visitor] }
  - { id: deploy, label: Deploy, color: violet, command: gh workflow run deploy.yml -f ref=v2.3.1, steps: [dev>gha, gha>hosting] }
highlights:
  - { node: booking, title: Reservierung mit Ablauf, text: Ein Platz ist 15 Minuten reserviert; ein Cron-Job gibt ihn frei. }
  - { node: payment, title: Webhook nur als Anstoß, text: Der Zahlungsstatus wird immer per API nachgefragt. }
  - { node: theme, title: Nur Blöcke, text: Site-Editor und theme.json; Inhalte bleiben portabel. }
  - { node: gha, title: Deploy nur per Tag, text: Jede Live-Version hat einen Tag und einen Rollback-Weg. }
  - { node: rest, title: Schema · Nonce · Rate-Limit, text: Schema-Validierung und 10 Anfragen pro Minute und IP. }
stack:
  - { name: PHP, version: "8.3", group: Runtime, role: Sprache mit strict_types, nodes: [cpt, rest, booking, payment, mail, cron] }
  - { name: WordPress, version: "6.8", group: Runtime, role: CMS · REST · Cron · Blöcke, nodes: [theme, cpt, rest, cron, mail, admin] }
  - { name: MySQL, version: "8.0", group: Runtime, role: Datenbank des Hosters, nodes: [mysql] }
  - { name: mollie-api-php, package: mollie/mollie-api-php, group: Integration, role: Zahlungs-Client, nodes: [payment, mollie] }
  - { name: GitHub Actions, group: Delivery, role: ci · deploy, nodes: [gha, hosting] }
commands:
  Lokal starten:
    - { run: composer install, note: PHP-Dependencies }
    - { run: npx wp-env start, note: WordPress in Docker }
  Betrieb:
    - { run: wp kb bookings list --today, note: Buchungen heute }
    - { run: wp cron event run kb_reminders, note: Erinnerungen }
tasks:
  KB-21: booking
  KB-23: rest
  KB-24: mail
  KB-19: payment
```

- [ ] **Step 3: Write the failing tests.** Create `test/unit/summary-schema.test.ts`:

```ts
// test/unit/summary-schema.test.ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ARCHITECTURE_PATH,
  checkArchitectureText,
  DEFAULT_KINDS,
  loadArchitecture,
  type ArchitectureLoadResult,
  type SchemaProblem,
} from '../../src/dashboard/summary-schema.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'summary');
const fixture = (name: string): string => readFileSync(join(FIXTURES, `architecture.${name}.yml`), 'utf8');

const BASE = [
  'schema: 1',
  'pitch: A **small** demo.',
  'grid: { cols: 3, rows: 2 }',
  'nodes:',
  '  - { id: a, label: Alpha, kind: core, cell: [0, 0] }',
  '  - { id: b, label: Beta, kind: output, cell: [2, 0] }',
  '  - { id: c, label: Gamma, kind: external, cell: [2, 1] }',
  'edges:',
  '  - { from: a, to: b, label: calls }',
  '  - { from: b, to: c, label: writes }',
];

function check(lines: string[], taskIds?: string[]): ArchitectureLoadResult {
  return checkArchitectureText(`${lines.join('\n')}\n`, 'architecture.yml', taskIds);
}

function problems(r: ArchitectureLoadResult): SchemaProblem[] {
  return r.status === 'missing' ? [] : r.problems;
}

function expectError(r: ArchitectureLoadResult, path: string, message: RegExp): void {
  expect(r.status).toBe('invalid');
  expect(problems(r)).toContainEqual({ path, message: expect.stringMatching(message), level: 'error' });
}

/** BASE with the line starting with `prefix` replaced (or appended when absent). */
function withLine(prefix: string, line: string): string[] {
  const i = BASE.findIndex((l) => l.startsWith(prefix));
  return i === -1 ? [...BASE, line] : [...BASE.slice(0, i), line, ...BASE.slice(i + 1)];
}

describe('validateArchitecture: valid input', () => {
  it('accepts the minimal file and applies the default kinds', () => {
    const r = check(BASE);
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.problems).toEqual([]);
    expect(r.architecture.kinds).toEqual(DEFAULT_KINDS);
    expect(r.architecture.edges.map((e) => e.id)).toEqual(['a>b', 'b>c']);
    expect(r.architecture.pitch).toBe('A **small** demo.');
  });

  it('validates the spec example (super-backlog fixture) without problems', () => {
    const r = checkArchitectureText(fixture('super-backlog'), 'x');
    expect(r.status).toBe('valid');
    expect(problems(r)).toEqual([]);
    if (r.status !== 'valid') return;
    expect(r.architecture.nodes).toHaveLength(13);
    expect(r.architecture.flows.map((f) => [f.id, f.color])).toEqual([
      ['init', 'accent'],
      ['update', 'warn'],
      ['dashboard', 'ok'],
      ['uninstall', 'rose'],
    ]);
    expect(r.architecture.highlights.map((h) => [h.badge, h.node])).toEqual([
      [1, 'planner'],
      [2, 'project'],
      [3, 'ownership'],
      [4, 'hub'],
    ]);
    expect(r.architecture.tasks).toEqual({ 'TASK-85': 'hub' });
  });

  it('validates the kursbuchung fixture (custom kinds) without problems', () => {
    const r = checkArchitectureText(fixture('kursbuchung'), 'x');
    expect(r.status).toBe('valid');
    expect(problems(r)).toEqual([]);
    if (r.status !== 'valid') return;
    expect(Object.keys(r.architecture.kinds)).toEqual(['actor', 'theme', 'plugin', 'ops', 'ext']);
    expect(r.architecture.kinds.ext).toEqual({ label: 'externer Dienst', color: 'dim', dashed: true });
  });
});

describe('validateArchitecture: one test per rule', () => {
  it('requires schema', () => {
    expectError(check(BASE.slice(1)), 'schema', /required/);
  });

  it('rejects an unsupported schema version', () => {
    expectError(check(withLine('schema:', 'schema: 2')), 'schema', /unsupported/);
  });

  it('requires pitch', () => {
    expectError(check(BASE.filter((l) => !l.startsWith('pitch:'))), 'pitch', /required/);
  });

  it('rejects an unknown kind', () => {
    const lines = withLine('  - { id: c', '  - { id: c, label: Gamma, kind: service, cell: [2, 1] }');
    expectError(check(lines), 'nodes[2].kind', /unknown kind "service"/);
  });

  it('rejects a duplicate cell', () => {
    const lines = withLine('  - { id: c', '  - { id: c, label: Gamma, kind: external, cell: [2, 0] }');
    expectError(check(lines), 'nodes[2].cell', /already used by "b"/);
  });

  it('rejects a cell outside the grid with the grid size in the message', () => {
    const lines = withLine('  - { id: c', '  - { id: c, label: Gamma, kind: external, cell: [3, 1] }');
    expectError(check(lines), 'nodes[2].cell', /^outside grid 3x2$/);
  });

  it('rejects a duplicate node id', () => {
    const lines = withLine('  - { id: c', '  - { id: b, label: Gamma, kind: external, cell: [2, 1] }');
    expectError(check(lines), 'nodes[2].id', /duplicate id "b"/);
  });

  it('rejects a dangling edge', () => {
    const lines = withLine('  - { from: b', '  - { from: b, to: zz, label: writes }');
    expectError(check(lines), 'edges[1].to', /unknown node "zz"/);
  });

  it('rejects a self edge and a duplicate edge', () => {
    expectError(check(withLine('  - { from: b', '  - { from: b, to: b, label: loops }')), 'edges[1]', /must differ/);
    expectError(check(withLine('  - { from: b', '  - { from: a, to: b, label: again }')), 'edges[1]', /duplicate edge a -> b/);
  });

  it('rejects overlapping zones', () => {
    const lines = [
      ...BASE,
      'zones:',
      '  - { label: Left, cols: [0, 1], rows: [0, 1] }',
      '  - { label: Middle, cols: [1, 2], rows: [1, 1] }',
    ];
    expectError(check(lines), 'zones[1]', /overlaps zones\[0\] \(Left\)/);
  });

  it('rejects a zone outside the grid', () => {
    expectError(check([...BASE, 'zones:', '  - { label: Wide, cols: [0, 3], rows: [0, 0] }']), 'zones[0]', /outside grid 3x2/);
  });

  it('drops a flow whose step names no edge, with a warning', () => {
    const lines = [...BASE, 'flows:', '  - { id: ok, label: Fine, steps: [a>b, b>c] }', '  - { id: bad, label: Broken, steps: [a>b, a>c] }'];
    const r = check(lines);
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.architecture.flows.map((f) => f.id)).toEqual(['ok']);
    expect(r.problems).toEqual([{ path: 'flows[1].steps', message: 'no edge a>c; flow "bad" dropped', level: 'warning' }]);
  });

  it('assigns default flow colors in sequence and honours an explicit color', () => {
    const lines = [
      ...BASE,
      'flows:',
      '  - { id: f1, label: One, steps: [a>b] }',
      '  - { id: f2, label: Two, color: violet, steps: [a>b] }',
      '  - { id: f3, label: Three, steps: [b>c] }',
    ];
    const r = check(lines);
    expect(r.status === 'valid' && r.architecture.flows.map((f) => f.color)).toEqual(['accent', 'violet', 'warn']);
  });

  it('rejects a second highlight on the same node', () => {
    const lines = [...BASE, 'highlights:', '  - { node: a, title: One, text: first }', '  - { node: a, title: Two, text: second }'];
    expectError(check(lines), 'highlights[1].node', /already carries highlight 1/);
  });

  it('enforces size limits on lists and strings', () => {
    const many = Array.from({ length: 41 }, (_, i) => `  - { id: n${i}, label: N, kind: core, cell: [0, 0] }`);
    expectError(check(['schema: 1', 'pitch: x', 'grid: { cols: 3, rows: 2 }', 'nodes:', ...many, 'edges:', '  - { from: n0, to: n1, label: x }']), 'nodes', /at most 40 entries \(found 41\)/);
    expectError(check(withLine('pitch:', `pitch: ${'p'.repeat(401)}`)), 'pitch', /at most 400 characters/);
    expectError(check(withLine('  - { id: a', `  - { id: a, label: ${'L'.repeat(29)}, kind: core, cell: [0, 0] }`)), 'nodes[0].label', /at most 28/);
    expectError(check(withLine('  - { from: a', `  - { from: a, to: b, label: ${'l'.repeat(25)} }`)), 'edges[0].label', /at most 24/);
    expectError(check(withLine('grid:', 'grid: { cols: 9, rows: 2 }')), 'grid.cols', /from 2 to 8/);
  });

  it('requires at least two nodes and one edge', () => {
    const r = check(['schema: 1', 'pitch: x', 'grid: { cols: 2, rows: 2 }', 'nodes:', '  - { id: a, label: A, kind: core, cell: [0, 0] }', 'edges: []']);
    expect(problems(r)).toEqual(
      expect.arrayContaining([
        { path: 'nodes', message: 'at least 2 entries (found 1)', level: 'error' },
        { path: 'edges', message: 'at least 1 entries (found 0)', level: 'error' },
      ]),
    );
  });

  it('rejects multi-line commands', () => {
    const lines = withLine('  - { id: a', '  - id: a\n    label: Alpha\n    kind: core\n    cell: [0, 0]\n    commands:\n      - run: |\n          one\n          two');
    expectError(check(lines), 'nodes[0].commands[0].run', /single line/);
  });

  it('warns about an unknown task id and ignores it; matching is case-insensitive', () => {
    const lines = [...BASE, 'tasks:', '  task-7: a', '  TASK-99: b'];
    const r = check(lines, ['TASK-7']);
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.architecture.tasks).toEqual({ 'TASK-7': 'a' });
    expect(r.problems).toEqual([{ path: 'tasks.TASK-99', message: 'unknown task id "TASK-99", ignored', level: 'warning' }]);
  });

  it('warns about a dangling stack node and keeps the entry', () => {
    const r = check([...BASE, 'stack:', '  - { name: Node.js, group: Runtime, nodes: [a, ghost] }']);
    expect(r.status === 'valid' && r.architecture.stack).toEqual([{ name: 'Node.js', group: 'Runtime', nodes: ['a'] }]);
    expect(problems(r)).toEqual([{ path: 'stack[0].nodes[1]', message: 'unknown node "ghost", ignored', level: 'warning' }]);
  });

  it('rejects kinds with an unknown color token', () => {
    const lines = [...BASE.slice(0, 3), 'kinds:', '  core: { label: Core, color: red }', '  output: { label: Out, color: ok }', '  external: { label: Ext, color: dim, dashed: true }', ...BASE.slice(3)];
    expectError(check(lines), 'kinds.core.color', /must be one of accent, ok, warn, violet, rose, muted, dim/);
  });

  it('reports a parse error as one problem with line and column', () => {
    const r = checkArchitectureText('schema: 1\npitch: &a x\n', 'architecture.yml');
    expect(r).toEqual({
      status: 'invalid',
      path: 'architecture.yml',
      problems: [{ path: 'line 2, column 8', message: expect.stringMatching(/anchor/), level: 'error' }],
    });
  });
});

describe('loadArchitecture', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sbl-arch-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports a missing file without throwing', () => {
    expect(loadArchitecture(dir)).toEqual({ status: 'missing', path: join(dir, 'backlog', 'docs', 'architecture.yml') });
  });

  it('reads backlog/docs/architecture.yml and returns typed data', () => {
    mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
    writeFileSync(join(dir, ...ARCHITECTURE_PATH.split('/')), fixture('super-backlog'));
    const r = loadArchitecture(dir, { taskIds: ['TASK-85'] });
    expect(r.status).toBe('valid');
    expect(r.status === 'valid' && r.architecture.nodes[0].id).toBe('dev');
  });

  it('returns errors with path and message for an invalid file', () => {
    mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
    writeFileSync(join(dir, 'backlog', 'docs', 'architecture.yml'), 'schema: 1\n');
    const r = loadArchitecture(dir);
    expect(r.status).toBe('invalid');
    expect(problems(r).map((p) => p.path)).toEqual(['pitch', 'grid', 'nodes', 'edges']);
  });
});
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `npx vitest run test/unit/summary-schema.test.ts`
Expected: FAIL with `Failed to load url ../../src/dashboard/summary-schema.js` (module does not exist).

- [ ] **Step 5: Implement the schema.** Create `src/dashboard/summary-schema.ts`:

```ts
// src/dashboard/summary-schema.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseYamlSubset, YamlSubsetError, type YamlValue } from '../lib/yamlmini.js';

/** Curated architecture file, relative to the project root (spec 2026-10-09, "architecture.yml schema"). */
export const ARCHITECTURE_PATH = 'backlog/docs/architecture.yml';

export const COLOR_TOKENS = ['accent', 'ok', 'warn', 'violet', 'rose', 'muted', 'dim'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export const ID_RE = /^[a-z][a-z0-9-]{0,31}$/;
const STEP_RE = /^([a-z][a-z0-9-]{0,31})>([a-z][a-z0-9-]{0,31})$/;
const FLOW_COLORS: readonly ColorToken[] = ['accent', 'ok', 'warn', 'violet', 'rose'];

export const LIMITS = {
  pitch: 400,
  gridMin: 2,
  gridMax: 8,
  kinds: 6,
  kindLabel: 28,
  zones: 16,
  zoneLabel: 40,
  nodesMin: 2,
  nodes: 40,
  nodeLabel: 28,
  nodeSub: 32,
  prose: 600,
  files: 12,
  file: 200,
  nodeCommands: 6,
  run: 200,
  note: 80,
  edges: 120,
  edgeLabel: 24,
  edgeText: 300,
  flows: 12,
  flowLabel: 28,
  flowText: 300,
  steps: 12,
  highlights: 12,
  highlightTitle: 60,
  highlightText: 300,
  stack: 40,
  stackName: 40,
  stackGroup: 24,
  stackRole: 120,
  stackVersion: 40,
  commandGroups: 6,
  commandsPerGroup: 8,
  commandGroup: 40,
} as const;

export interface ArchKind {
  label: string;
  color: ColorToken;
  dashed: boolean;
}

export interface ArchZone {
  label: string;
  cols: [number, number];
  rows: [number, number];
}

export interface ArchCommand {
  run: string;
  note?: string;
}

export interface ArchNode {
  id: string;
  label: string;
  sub?: string;
  kind: string;
  cell: [number, number];
  purpose?: string;
  why?: string;
  files: string[];
  commands: ArchCommand[];
}

export interface ArchEdge {
  /** `<from>><to>`, unique per file */
  id: string;
  from: string;
  to: string;
  label: string;
  text?: string;
}

export interface ArchFlow {
  id: string;
  label: string;
  color: ColorToken;
  command?: string;
  text?: string;
  /** edge ids `<from>><to>` in order */
  steps: string[];
}

export interface ArchHighlight {
  /** 1-based list position, drawn as the badge number on `node` */
  badge: number;
  node: string;
  title: string;
  text: string;
}

export interface ArchStackEntry {
  name: string;
  group: string;
  package?: string;
  version?: string;
  role?: string;
  nodes: string[];
}

export interface Architecture {
  schema: 1;
  pitch: string;
  grid: { cols: number; rows: number };
  kinds: Record<string, ArchKind>;
  zones: ArchZone[];
  nodes: ArchNode[];
  edges: ArchEdge[];
  flows: ArchFlow[];
  highlights: ArchHighlight[];
  stack: ArchStackEntry[];
  commands: Record<string, ArchCommand[]>;
  /** upper-cased task id -> node id */
  tasks: Record<string, string>;
}

export interface SchemaProblem {
  path: string;
  message: string;
  level: 'error' | 'warning';
}

export type ArchitectureLoadResult =
  | { status: 'missing'; path: string }
  | { status: 'invalid'; path: string; problems: SchemaProblem[] }
  | { status: 'valid'; path: string; architecture: Architecture; problems: SchemaProblem[] };

export const DEFAULT_KINDS: Readonly<Record<string, ArchKind>> = {
  actor: { label: 'Actor', color: 'muted', dashed: false },
  core: { label: 'Core', color: 'accent', dashed: false },
  output: { label: 'Output', color: 'ok', dashed: false },
  optional: { label: 'Optional', color: 'violet', dashed: false },
  external: { label: 'External', color: 'dim', dashed: true },
};

type YamlMap = { [key: string]: YamlValue };

function isMap(v: YamlValue | undefined): v is YamlMap {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class Collector {
  readonly problems: SchemaProblem[] = [];
  error(path: string, message: string): void {
    this.problems.push({ path, message, level: 'error' });
  }
  warn(path: string, message: string): void {
    this.problems.push({ path, message, level: 'warning' });
  }
  get hasErrors(): boolean {
    return this.problems.some((p) => p.level === 'error');
  }

  unknownKeys(map: YamlMap, path: string, allowed: readonly string[]): void {
    for (const key of Object.keys(map)) {
      if (!allowed.includes(key)) this.warn(path === '' ? key : `${path}.${key}`, 'unknown key, ignored');
    }
  }

  str(map: YamlMap, key: string, path: string, max: number, opts: { required?: boolean; singleLine?: boolean } = {}): string | undefined {
    const p = path === '' ? key : `${path}.${key}`;
    const v = map[key];
    if (v === undefined || v === null) {
      if (opts.required) this.error(p, 'required');
      return undefined;
    }
    if (typeof v === 'number') return this.checkLen(String(v), p, max, opts.singleLine);
    if (typeof v !== 'string') {
      this.error(p, 'expected a string');
      return undefined;
    }
    const trimmed = v.replace(/\n+$/, '');
    if (trimmed.trim() === '') {
      if (opts.required) this.error(p, 'must not be empty');
      return undefined;
    }
    return this.checkLen(trimmed, p, max, opts.singleLine);
  }

  private checkLen(v: string, path: string, max: number, singleLine = true): string | undefined {
    if (singleLine && v.includes('\n')) {
      this.error(path, 'must be a single line');
      return undefined;
    }
    if (v.length > max) {
      this.error(path, `at most ${max} characters (found ${v.length})`);
      return undefined;
    }
    return v;
  }

  list(map: YamlMap, key: string, path: string, max: number, required = false, min = 0): YamlValue[] {
    const p = path === '' ? key : `${path}.${key}`;
    const v = map[key];
    if (v === undefined || v === null) {
      if (required) this.error(p, 'required');
      return [];
    }
    if (!Array.isArray(v)) {
      this.error(p, 'expected a list');
      return [];
    }
    if (v.length > max) {
      this.error(p, `at most ${max} entries (found ${v.length})`);
      return [];
    }
    if (v.length < min) {
      this.error(p, `at least ${min} entries (found ${v.length})`);
    }
    return v;
  }

  intPair(v: YamlValue | undefined, path: string, what: string): [number, number] | null {
    if (v === undefined || v === null) {
      this.error(path, 'required');
      return null;
    }
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number' && Number.isInteger(n))) {
      this.error(path, `expected [${what}] with two integers`);
      return null;
    }
    return [v[0] as number, v[1] as number];
  }
}

function readCommand(c: Collector, v: YamlValue, path: string): ArchCommand | null {
  if (!isMap(v)) {
    c.error(path, 'expected { run, note? }');
    return null;
  }
  c.unknownKeys(v, path, ['run', 'note']);
  const run = c.str(v, 'run', path, LIMITS.run, { required: true, singleLine: true });
  const note = c.str(v, 'note', path, LIMITS.note, { singleLine: true });
  if (run === undefined) return null;
  return note === undefined ? { run } : { run, note };
}

function readKinds(c: Collector, root: YamlMap): Record<string, ArchKind> {
  const raw = root.kinds;
  if (raw === undefined || raw === null) return { ...DEFAULT_KINDS };
  if (!isMap(raw)) {
    c.error('kinds', 'expected a mapping of kind id to { label, color, dashed? }');
    return {};
  }
  const keys = Object.keys(raw);
  if (keys.length === 0) {
    c.error('kinds', 'must define at least one kind (omit the key to use the default set)');
    return {};
  }
  if (keys.length > LIMITS.kinds) {
    c.error('kinds', `at most ${LIMITS.kinds} entries (found ${keys.length})`);
    return {};
  }
  const out: Record<string, ArchKind> = {};
  for (const id of keys) {
    const path = `kinds.${id}`;
    if (!ID_RE.test(id)) {
      c.error(path, 'kind id must match ^[a-z][a-z0-9-]{0,31}$');
      continue;
    }
    const v = raw[id];
    if (!isMap(v)) {
      c.error(path, 'expected { label, color, dashed? }');
      continue;
    }
    c.unknownKeys(v, path, ['label', 'color', 'dashed']);
    const label = c.str(v, 'label', path, LIMITS.kindLabel, { required: true, singleLine: true });
    const color = v.color;
    if (typeof color !== 'string' || !(COLOR_TOKENS as readonly string[]).includes(color)) {
      c.error(`${path}.color`, `must be one of ${COLOR_TOKENS.join(', ')}`);
      continue;
    }
    if (v.dashed !== undefined && v.dashed !== null && typeof v.dashed !== 'boolean') {
      c.error(`${path}.dashed`, 'expected true or false');
      continue;
    }
    if (label === undefined) continue;
    out[id] = { label, color: color as ColorToken, dashed: v.dashed === true };
  }
  return out;
}

function inRange(n: number, max: number): boolean {
  return n >= 0 && n < max;
}

/**
 * Validates parsed YAML against the architecture schema. `taskIds` (from the
 * backlog) enables the unknown-task-id warning; pass undefined to skip it.
 */
export function validateArchitecture(
  value: YamlValue,
  taskIds?: readonly string[],
): { architecture: Architecture | null; problems: SchemaProblem[] } {
  const c = new Collector();
  if (!isMap(value)) {
    c.error('(root)', 'expected a mapping with schema, pitch, grid, nodes and edges');
    return { architecture: null, problems: c.problems };
  }
  const root = value;
  c.unknownKeys(root, '', ['schema', 'pitch', 'grid', 'kinds', 'zones', 'nodes', 'edges', 'flows', 'highlights', 'stack', 'commands', 'tasks']);

  if (root.schema === undefined || root.schema === null) c.error('schema', 'required (use schema: 1)');
  else if (root.schema !== 1) c.error('schema', 'unsupported schema version (expected 1)');

  const pitch = c.str(root, 'pitch', '', LIMITS.pitch, { required: true, singleLine: false });

  let grid: { cols: number; rows: number } | null = null;
  if (!isMap(root.grid)) {
    c.error('grid', root.grid === undefined ? 'required' : 'expected { cols, rows }');
  } else {
    c.unknownKeys(root.grid, 'grid', ['cols', 'rows']);
    const { cols, rows } = root.grid;
    const ok = (n: YamlValue | undefined): n is number =>
      typeof n === 'number' && Number.isInteger(n) && n >= LIMITS.gridMin && n <= LIMITS.gridMax;
    if (!ok(cols)) c.error('grid.cols', `expected an integer from ${LIMITS.gridMin} to ${LIMITS.gridMax}`);
    if (!ok(rows)) c.error('grid.rows', `expected an integer from ${LIMITS.gridMin} to ${LIMITS.gridMax}`);
    if (ok(cols) && ok(rows)) grid = { cols, rows };
  }
  const gridText = grid ? `${grid.cols}x${grid.rows}` : '';

  const kinds = readKinds(c, root);

  // zones
  const zones: ArchZone[] = [];
  c.list(root, 'zones', '', LIMITS.zones).forEach((z, i) => {
    const path = `zones[${i}]`;
    if (!isMap(z)) {
      c.error(path, 'expected { label, cols, rows }');
      return;
    }
    c.unknownKeys(z, path, ['label', 'cols', 'rows']);
    const label = c.str(z, 'label', path, LIMITS.zoneLabel, { required: true, singleLine: true });
    const cols = c.intPair(z.cols, `${path}.cols`, 'first, last');
    const rows = c.intPair(z.rows, `${path}.rows`, 'first, last');
    if (label === undefined || cols === null || rows === null || grid === null) return;
    if (cols[0] > cols[1] || rows[0] > rows[1]) {
      c.error(path, 'ranges must be [first, last] with first <= last');
      return;
    }
    if (!inRange(cols[0], grid.cols) || !inRange(cols[1], grid.cols) || !inRange(rows[0], grid.rows) || !inRange(rows[1], grid.rows)) {
      c.error(path, `outside grid ${gridText}`);
      return;
    }
    const clash = zones.findIndex(
      (o) => o.cols[0] <= cols[1] && cols[0] <= o.cols[1] && o.rows[0] <= rows[1] && rows[0] <= o.rows[1],
    );
    if (clash !== -1) {
      c.error(path, `overlaps zones[${clash}] (${zones[clash].label})`);
      return;
    }
    zones.push({ label, cols, rows });
  });

  // nodes
  const nodes: ArchNode[] = [];
  const nodeIds = new Set<string>();
  const cells = new Map<string, string>();
  c.list(root, 'nodes', '', LIMITS.nodes, true, LIMITS.nodesMin).forEach((n, i) => {
    const path = `nodes[${i}]`;
    if (!isMap(n)) {
      c.error(path, 'expected a mapping with id, label, kind and cell');
      return;
    }
    c.unknownKeys(n, path, ['id', 'label', 'sub', 'kind', 'cell', 'purpose', 'why', 'files', 'commands']);
    let ok = true;
    const id = n.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      c.error(`${path}.id`, id === undefined ? 'required' : 'must match ^[a-z][a-z0-9-]{0,31}$');
      ok = false;
    } else if (nodeIds.has(id)) {
      c.error(`${path}.id`, `duplicate id "${id}"`);
      ok = false;
    }
    const label = c.str(n, 'label', path, LIMITS.nodeLabel, { required: true, singleLine: true });
    const sub = c.str(n, 'sub', path, LIMITS.nodeSub, { singleLine: true });
    const kind = n.kind;
    if (typeof kind !== 'string') {
      c.error(`${path}.kind`, 'required');
      ok = false;
    } else if (!Object.prototype.hasOwnProperty.call(kinds, kind)) {
      c.error(`${path}.kind`, `unknown kind "${kind}" (known: ${Object.keys(kinds).join(', ')})`);
      ok = false;
    }
    const cell = c.intPair(n.cell, `${path}.cell`, 'col, row');
    if (cell !== null && grid !== null) {
      if (!inRange(cell[0], grid.cols) || !inRange(cell[1], grid.rows)) {
        c.error(`${path}.cell`, `outside grid ${gridText}`);
        ok = false;
      } else {
        const key = `${cell[0]},${cell[1]}`;
        const other = cells.get(key);
        if (other !== undefined) {
          c.error(`${path}.cell`, `cell [${key}] is already used by "${other}"`);
          ok = false;
        } else if (typeof id === 'string') {
          cells.set(key, id);
        }
      }
    }
    const purpose = c.str(n, 'purpose', path, LIMITS.prose, { singleLine: false });
    const why = c.str(n, 'why', path, LIMITS.prose, { singleLine: false });
    const files: string[] = [];
    c.list(n, 'files', path, LIMITS.files).forEach((f, j) => {
      if (typeof f !== 'string' || f.trim() === '') c.error(`${path}.files[${j}]`, 'expected a non-empty string');
      else if (f.length > LIMITS.file) c.error(`${path}.files[${j}]`, `at most ${LIMITS.file} characters`);
      else files.push(f);
    });
    const commands: ArchCommand[] = [];
    c.list(n, 'commands', path, LIMITS.nodeCommands).forEach((cmd, j) => {
      const parsed = readCommand(c, cmd, `${path}.commands[${j}]`);
      if (parsed) commands.push(parsed);
    });
    if (typeof id === 'string' && ID_RE.test(id)) nodeIds.add(id);
    if (!ok || label === undefined || cell === null || typeof id !== 'string' || typeof kind !== 'string') return;
    const node: ArchNode = { id, label, kind, cell, files, commands };
    if (sub !== undefined) node.sub = sub;
    if (purpose !== undefined) node.purpose = purpose;
    if (why !== undefined) node.why = why;
    nodes.push(node);
  });

  // edges
  const edges: ArchEdge[] = [];
  const edgeIds = new Set<string>();
  c.list(root, 'edges', '', LIMITS.edges, true, 1).forEach((e, i) => {
    const path = `edges[${i}]`;
    if (!isMap(e)) {
      c.error(path, 'expected { from, to, label, text? }');
      return;
    }
    c.unknownKeys(e, path, ['from', 'to', 'label', 'text']);
    const label = c.str(e, 'label', path, LIMITS.edgeLabel, { required: true, singleLine: true });
    const text = c.str(e, 'text', path, LIMITS.edgeText, { singleLine: false });
    let ok = label !== undefined;
    for (const end of ['from', 'to'] as const) {
      const v = e[end];
      if (typeof v !== 'string') {
        c.error(`${path}.${end}`, 'required');
        ok = false;
      } else if (!nodeIds.has(v)) {
        c.error(`${path}.${end}`, `unknown node "${v}"`);
        ok = false;
      }
    }
    if (!ok) return;
    const from = e.from as string;
    const to = e.to as string;
    if (from === to) {
      c.error(path, 'from and to must differ');
      return;
    }
    const id = `${from}>${to}`;
    if (edgeIds.has(id)) {
      c.error(path, `duplicate edge ${from} -> ${to}`);
      return;
    }
    edgeIds.add(id);
    const edge: ArchEdge = { id, from, to, label: label as string };
    if (text !== undefined) edge.text = text;
    edges.push(edge);
  });

  // flows
  const flows: ArchFlow[] = [];
  const flowIds = new Set<string>();
  c.list(root, 'flows', '', LIMITS.flows).forEach((f, i) => {
    const path = `flows[${i}]`;
    if (!isMap(f)) {
      c.error(path, 'expected { id, label, steps, color?, command?, text? }');
      return;
    }
    c.unknownKeys(f, path, ['id', 'label', 'color', 'command', 'text', 'steps']);
    const id = f.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      c.error(`${path}.id`, id === undefined ? 'required' : 'must match ^[a-z][a-z0-9-]{0,31}$');
      return;
    }
    if (flowIds.has(id)) {
      c.error(`${path}.id`, `duplicate id "${id}"`);
      return;
    }
    flowIds.add(id);
    const label = c.str(f, 'label', path, LIMITS.flowLabel, { required: true, singleLine: true });
    const command = c.str(f, 'command', path, LIMITS.run, { singleLine: true });
    const text = c.str(f, 'text', path, LIMITS.flowText, { singleLine: false });
    let color: ColorToken = FLOW_COLORS[i % FLOW_COLORS.length];
    if (f.color !== undefined && f.color !== null) {
      if (typeof f.color !== 'string' || !(COLOR_TOKENS as readonly string[]).includes(f.color)) {
        c.error(`${path}.color`, `must be one of ${COLOR_TOKENS.join(', ')}`);
        return;
      }
      color = f.color as ColorToken;
    }
    const steps: string[] = [];
    let missing: string | null = null;
    const rawSteps = c.list(f, 'steps', path, LIMITS.steps, true, 1);
    let malformed = false;
    rawSteps.forEach((s, j) => {
      if (typeof s !== 'string' || !STEP_RE.test(s)) {
        c.error(`${path}.steps[${j}]`, 'expected "from>to" with two node ids');
        malformed = true;
        return;
      }
      if (!edgeIds.has(s) && missing === null) missing = s;
      steps.push(s);
    });
    if (label === undefined || malformed || rawSteps.length === 0) return;
    if (missing !== null) {
      c.warn(`${path}.steps`, `no edge ${missing}; flow "${id}" dropped`);
      return;
    }
    const flow: ArchFlow = { id, label, color, steps };
    if (command !== undefined) flow.command = command;
    if (text !== undefined) flow.text = text;
    flows.push(flow);
  });

  // highlights
  const highlights: ArchHighlight[] = [];
  const badged = new Map<string, number>();
  c.list(root, 'highlights', '', LIMITS.highlights).forEach((h, i) => {
    const path = `highlights[${i}]`;
    if (!isMap(h)) {
      c.error(path, 'expected { node, title, text }');
      return;
    }
    c.unknownKeys(h, path, ['node', 'title', 'text']);
    const title = c.str(h, 'title', path, LIMITS.highlightTitle, { required: true, singleLine: true });
    const text = c.str(h, 'text', path, LIMITS.highlightText, { required: true, singleLine: false });
    const node = h.node;
    if (typeof node !== 'string') {
      c.error(`${path}.node`, 'required');
      return;
    }
    if (!nodeIds.has(node)) {
      c.error(`${path}.node`, `unknown node "${node}"`);
      return;
    }
    const prev = badged.get(node);
    if (prev !== undefined) {
      c.error(`${path}.node`, `node "${node}" already carries highlight ${prev}`);
      return;
    }
    badged.set(node, i + 1);
    if (title === undefined || text === undefined) return;
    highlights.push({ badge: i + 1, node, title, text });
  });

  // stack
  const stack: ArchStackEntry[] = [];
  c.list(root, 'stack', '', LIMITS.stack).forEach((s, i) => {
    const path = `stack[${i}]`;
    if (!isMap(s)) {
      c.error(path, 'expected { name, group, package?, version?, role?, nodes }');
      return;
    }
    c.unknownKeys(s, path, ['name', 'group', 'package', 'version', 'role', 'nodes']);
    const name = c.str(s, 'name', path, LIMITS.stackName, { required: true, singleLine: true });
    const group = c.str(s, 'group', path, LIMITS.stackGroup, { required: true, singleLine: true });
    const pkg = c.str(s, 'package', path, 214, { singleLine: true });
    const version = c.str(s, 'version', path, LIMITS.stackVersion, { singleLine: true });
    const role = c.str(s, 'role', path, LIMITS.stackRole, { singleLine: true });
    const used: string[] = [];
    c.list(s, 'nodes', path, LIMITS.nodes).forEach((n, j) => {
      if (typeof n !== 'string') c.error(`${path}.nodes[${j}]`, 'expected a node id');
      else if (!nodeIds.has(n)) c.warn(`${path}.nodes[${j}]`, `unknown node "${n}", ignored`);
      else used.push(n);
    });
    if (name === undefined || group === undefined) return;
    const entry: ArchStackEntry = { name, group, nodes: used };
    if (pkg !== undefined) entry.package = pkg;
    if (version !== undefined) entry.version = version;
    if (role !== undefined) entry.role = role;
    stack.push(entry);
  });

  // commands
  const commands: Record<string, ArchCommand[]> = {};
  if (root.commands !== undefined && root.commands !== null) {
    if (!isMap(root.commands)) {
      c.error('commands', 'expected a mapping of group name to a list of { run, note? }');
    } else {
      const groups = Object.keys(root.commands);
      if (groups.length > LIMITS.commandGroups) {
        c.error('commands', `at most ${LIMITS.commandGroups} groups (found ${groups.length})`);
      } else {
        for (const g of groups) {
          if (g.length > LIMITS.commandGroup) {
            c.error(`commands.${g}`, `group name at most ${LIMITS.commandGroup} characters`);
            continue;
          }
          const list: ArchCommand[] = [];
          c.list(root.commands, g, 'commands', LIMITS.commandsPerGroup, true, 1).forEach((cmd, j) => {
            const parsed = readCommand(c, cmd, `commands.${g}[${j}]`);
            if (parsed) list.push(parsed);
          });
          commands[g] = list;
        }
      }
    }
  }

  // tasks
  const tasks: Record<string, string> = {};
  if (root.tasks !== undefined && root.tasks !== null) {
    if (!isMap(root.tasks)) {
      c.error('tasks', 'expected a mapping of task id to node id');
    } else {
      const known = taskIds ? new Set(taskIds.map((t) => t.toUpperCase())) : null;
      for (const [taskId, node] of Object.entries(root.tasks)) {
        const path = `tasks.${taskId}`;
        if (typeof node !== 'string' || !nodeIds.has(node)) {
          c.error(path, `unknown node "${String(node)}"`);
          continue;
        }
        const key = taskId.toUpperCase();
        if (known !== null && !known.has(key)) {
          c.warn(path, `unknown task id "${taskId}", ignored`);
          continue;
        }
        tasks[key] = node;
      }
    }
  }

  if (c.hasErrors || pitch === undefined || grid === null) {
    return { architecture: null, problems: c.problems };
  }
  return {
    architecture: { schema: 1, pitch, grid, kinds, zones, nodes, edges, flows, highlights, stack, commands, tasks },
    problems: c.problems,
  };
}

/** Parses and validates `text`; parse errors become one problem with the line and column as path. */
export function checkArchitectureText(
  text: string,
  path: string,
  taskIds?: readonly string[],
): ArchitectureLoadResult {
  let parsed: YamlValue;
  try {
    parsed = parseYamlSubset(text);
  } catch (err) {
    if (err instanceof YamlSubsetError) {
      return { status: 'invalid', path, problems: [{ path: `line ${err.line}, column ${err.column}`, message: err.reason, level: 'error' }] };
    }
    throw err;
  }
  const { architecture, problems } = validateArchitecture(parsed, taskIds);
  if (architecture === null) return { status: 'invalid', path, problems };
  return { status: 'valid', path, architecture, problems };
}

/** Reads `backlog/docs/architecture.yml` below `cwd`. Never throws for a missing or broken file. */
export function loadArchitecture(cwd: string, opts: { taskIds?: readonly string[] } = {}): ArchitectureLoadResult {
  const path = join(cwd, ...ARCHITECTURE_PATH.split('/'));
  if (!existsSync(path)) return { status: 'missing', path };
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    return { status: 'invalid', path, problems: [{ path: ARCHITECTURE_PATH, message: `cannot read file (${(err as Error).message})`, level: 'error' }] };
  }
  return checkArchitectureText(text, path, opts.taskIds);
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run test/unit/summary-schema.test.ts`
Expected: PASS, 27 tests (the spec example, both fixtures, one test per rule).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 8: Commit**

```powershell
git add src/dashboard/summary-schema.ts test/unit/summary-schema.test.ts test/fixtures/summary/architecture.super-backlog.yml test/fixtures/summary/architecture.kursbuchung.yml
git commit -m "feat(summary): architecture.yml schema and validation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Hand over to verify**

Run: `node dist/bin.js phase TASK-86 verify`

---

### Task 3: Automatic project facts (TASK-87)

**Files:**
- Create: `src/dashboard/summary-facts.ts`
- Test: `test/unit/summary-facts.test.ts`

**Interfaces:**
- Consumes: `detectPackageManager` (`src/lib/pm.ts`), `runCapture` and `RunResult` (`src/lib/run.ts`). Both exist today.
- Produces (in `src/dashboard/summary-facts.ts`):
  - `type ManifestKind = 'package.json' | 'composer.json' | 'wordpress'`
  - `interface FactPackage`, `interface FactCommandGroup`, `interface SummaryFacts` (name, version, license, manifests, LOC, the approximation flag, test files, runtime/dev dependency counts and packages, releases, the git-availability flag, CI workflow count, command groups, notes)
  - `interface FactsDeps { runCapture?; maxBytes? }` (injectable for tests)
  - `FACTS_MAX_BYTES = 10 * 1024 * 1024`
  - `readWordPressHeader(cwd)`, `listProjectFiles(cwd, deps)`, `isTestFile(rel)`, `collectSummaryFacts(cwd, deps?): SummaryFacts`

**Rules (spec D2–D4):** manifest precedence `package.json` → `composer.json` → WordPress header (`style.css` with `Theme Name:` or a root `*.php` with `Plugin Name:`). The first manifest found supplies name, version and license, and the empty fields are filled from the WordPress header. Dependency counts are summed across manifests (Composer without `php` and `ext-*`). Releases count `git tag --list` entries matching `^v?\d`. CI counts `.github/workflows/*.yml|yaml`. LOC and test files are counted over `git ls-files -z`, falling back to a walk that skips `node_modules`, `vendor`, `dist`, `build` and `.git`, for the dominant language set. Reading stops after 10 MB and sets the approximation flag. Lockfile versions come from `package-lock.json` and `composer.lock`. Script commands are `npm run`/`pnpm run`/`bun run` by package manager, or `composer <name>`.

**Decisions:**
- LOC counts test files too (the spec counts "lines of code" over the language set and does not exclude tests). Tests are reported separately as a file count.
- Fact notes (shown in Data source) are capped at 80 characters.
- Composer script commands carry no note, because Composer scripts have no description field.

- [ ] **Step 1: Start the phase**

Run: `node dist/bin.js phase TASK-87 impl`

- [ ] **Step 2: Write the failing tests.** Create `test/unit/summary-facts.test.ts`:

```ts
// test/unit/summary-facts.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collectSummaryFacts, isTestFile, readWordPressHeader } from '../../src/dashboard/summary-facts.js';
import type { RunResult } from '../../src/lib/run.js';

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sbl-facts-'));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function put(rel: string, content: string | object): void {
  const p = join(cwd, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

/** git unavailable: ls-files and tag both fail, so the walk fallback runs. */
const noGit = (): RunResult => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });

function fakeGit(files: string[], tags: string[]): (cmd: string, args: string[]) => RunResult {
  return (cmd, args) => {
    if (cmd === 'git' && args[0] === 'ls-files') return { status: 0, stdout: files.map((f) => `${f}\0`).join(''), stderr: '' };
    if (cmd === 'git' && args[0] === 'tag') return { status: 0, stdout: tags.join('\n') + '\n', stderr: '' };
    return { status: 1, stdout: '', stderr: 'unexpected' };
  };
}

describe('collectSummaryFacts: manifests', () => {
  it('reads name, version, license and dependency counts from package.json', () => {
    put('package.json', {
      name: 'demo',
      version: '1.2.3',
      license: 'MIT',
      dependencies: { 'cross-spawn': '^7.0.6' },
      devDependencies: { vitest: '^5.0.0', typescript: '^7.0.0' },
      scripts: { build: 'tsc -p tsconfig.json', test: 'vitest run' },
    });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'demo', version: '1.2.3', license: 'MIT', manifest: 'package.json', manifests: ['package.json'] });
    expect(f.dependencies).toBe(1);
    expect(f.devDependencies).toBe(2);
    expect(f.packages.map((p) => [p.name, p.group])).toEqual([
      ['cross-spawn', 'Runtime'],
      ['typescript', 'Development'],
      ['vitest', 'Development'],
    ]);
  });

  it('resolves versions from package-lock.json and falls back to the declared range', () => {
    put('package.json', { name: 'demo', dependencies: { 'cross-spawn': '^7.0.6', other: '~1.0.0' } });
    put('package-lock.json', { packages: { '': {}, 'node_modules/cross-spawn': { version: '7.0.6' }, 'node_modules/a/node_modules/other': { version: '9.9.9' } } });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.versions).toEqual({ 'cross-spawn': '7.0.6', other: '~1.0.0' });
  });

  it('reads composer.json, ignores php and ext-* in the count and resolves composer.lock versions', () => {
    put('composer.json', {
      name: 'acme/kursbuchung',
      license: 'GPL-2.0-or-later',
      require: { php: '>=8.3', 'ext-json': '*', 'mollie/mollie-api-php': '^2.0' },
      'require-dev': { 'phpunit/phpunit': '^11.0' },
      scripts: { test: 'phpunit', lint: 'phpcs' },
    });
    put('composer.lock', { packages: [{ name: 'mollie/mollie-api-php', version: 'v2.79.1' }], 'packages-dev': [{ name: 'phpunit/phpunit', version: '11.5.2' }] });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'acme/kursbuchung', version: null, license: 'GPL-2.0-or-later', manifest: 'composer.json' });
    expect(f.dependencies).toBe(1);
    expect(f.devDependencies).toBe(1);
    expect(f.versions['mollie/mollie-api-php']).toBe('v2.79.1');
    expect(f.versions.php).toBe('>=8.3');
    expect(f.commands).toEqual([{ group: 'composer.json scripts', entries: [{ run: 'composer test' }, { run: 'composer lint' }] }]);
  });

  it('reads a WordPress plugin header from a root php file', () => {
    put('kursbuchung-core.php', "<?php\n/**\n * Plugin Name: Kursbuchung Core\n * Version: 2.3.1\n * License: GPL-2.0-or-later\n */\n");
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'Kursbuchung Core', version: '2.3.1', license: 'GPL-2.0-or-later', manifest: 'wordpress' });
    expect(f.extensions).toEqual(['.php']);
  });

  it('prefers a theme style.css header and lets it fill the version composer.json lacks', () => {
    put('style.css', '/*\nTheme Name: Kurs Theme\nVersion: 1.4.0\nLicense: GPL-2.0-or-later\n*/\n');
    put('composer.json', { name: 'acme/theme', require: {} });
    expect(readWordPressHeader(cwd)).toMatchObject({ type: 'theme', name: 'Kurs Theme', version: '1.4.0' });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f).toMatchObject({ name: 'acme/theme', version: '1.4.0', manifest: 'composer.json', manifests: ['composer.json', 'wordpress'] });
  });

  it('sums dependency counts across manifests and keeps the first manifest for name/version', () => {
    put('package.json', { name: 'front', version: '0.1.0', dependencies: { a: '1', b: '1' } });
    put('composer.json', { name: 'acme/back', version: '9.9.9', require: { php: '8.3', 'c/d': '1' } });
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.name).toBe('front');
    expect(f.version).toBe('0.1.0');
    expect(f.dependencies).toBe(3);
  });

  it('records a warning for a broken manifest instead of throwing', () => {
    put('package.json', '{ not json');
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.manifest).toBeNull();
    expect(f.warnings[0]).toMatch(/^package\.json: /);
  });
});

describe('collectSummaryFacts: repository facts', () => {
  it('counts LOC and test files with the walk fallback, skipping node_modules, vendor, dist, build and .git', () => {
    put('package.json', { name: 'demo' });
    put('src/a.ts', 'one\ntwo\nthree\n');
    put('src/b.mjs', 'one\ntwo');
    put('src/a.test.ts', 'x\n');
    put('test/helper.js', 'y\n');
    put('src/__tests__/c.tsx', 'z\n');
    put('README.md', 'not counted\n');
    for (const d of ['node_modules/x', 'vendor', 'dist', 'build', '.git']) put(`${d}/skip.ts`, 'skipped\n');
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.fileSource).toBe('walk');
    expect(f.sourceFiles).toBe(5);
    expect(f.loc).toBe(3 + 2 + 1 + 1 + 1);
    expect(f.testFiles).toBe(3);
    expect(f.locApprox).toBe(false);
  });

  it('uses git ls-files when git works', () => {
    put('package.json', { name: 'demo' });
    put('src/tracked.ts', 'a\nb\n');
    put('src/untracked.ts', 'a\nb\nc\n');
    const f = collectSummaryFacts(cwd, { runCapture: fakeGit(['package.json', 'src/tracked.ts', 'src/deleted.ts'], []) });
    expect(f.fileSource).toBe('git');
    expect(f.sourceFiles).toBe(2);
    expect(f.loc).toBe(2);
  });

  it('sets the approximation flag when the byte budget is exhausted', () => {
    put('package.json', { name: 'demo' });
    put('src/a.ts', 'x\n'.repeat(10));
    put('src/b.ts', 'x\n'.repeat(10));
    const f = collectSummaryFacts(cwd, { runCapture: noGit, maxBytes: 25 });
    expect(f.locApprox).toBe(true);
    expect(f.loc).toBe(10);
    expect(f.sourceFiles).toBe(2);
  });

  it('counts version tags through the injected runCapture', () => {
    const f = collectSummaryFacts(cwd, { runCapture: fakeGit([], ['v1.0.0', '1.1.0', 'v1.2.0', 'nightly', 'release-3']) });
    expect(f.releases).toBe(3);
    expect(f.releasesNote).toBeNull();
  });

  it('reports 0 releases and "git unavailable" when git fails', () => {
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.releases).toBe(0);
    expect(f.releasesNote).toBe('git unavailable');
  });

  it('counts workflow files', () => {
    put('.github/workflows/ci.yml', 'on: push\n');
    put('.github/workflows/release.yaml', 'on: push\n');
    put('.github/workflows/README.md', '');
    expect(collectSummaryFacts(cwd, { runCapture: noGit }).workflows).toBe(2);
  });

  it('classifies test files by name and directory', () => {
    expect(isTestFile('src/a.test.ts')).toBe(true);
    expect(isTestFile('src/a.spec.js')).toBe(true);
    expect(isTestFile('tests/Unit/BookingTest.php')).toBe(true);
    expect(isTestFile('src/__tests__/x.ts')).toBe(true);
    expect(isTestFile('src/testing.ts')).toBe(false);
  });
});

describe('collectSummaryFacts: commands', () => {
  it.each([
    ['npm', 'package-lock.json', 'npm run build'],
    ['pnpm', 'pnpm-lock.yaml', 'pnpm run build'],
    ['bun', 'bun.lock', 'bun run build'],
  ])('maps scripts to %s commands', (_pm, lock, expected) => {
    put('package.json', { name: 'demo', scripts: { build: 'tsc' } });
    put(lock, lock.endsWith('.json') ? {} : '');
    const f = collectSummaryFacts(cwd, { runCapture: noGit });
    expect(f.commands).toEqual([{ group: 'package.json scripts', entries: [{ run: expected, note: 'tsc' }] }]);
  });

  it('shortens long script bodies in the note', () => {
    put('package.json', { name: 'demo', scripts: { long: 'x'.repeat(100) } });
    const note = collectSummaryFacts(cwd, { runCapture: noGit }).commands[0].entries[0].note ?? '';
    expect(note).toHaveLength(80);
    expect(note.endsWith('…')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run test/unit/summary-facts.test.ts`
Expected: FAIL, module `../../src/dashboard/summary-facts.js` not found.

- [ ] **Step 4: Implement the facts collector.** Create `src/dashboard/summary-facts.ts`:

```ts
// src/dashboard/summary-facts.ts
// Automatic project facts for the summary page (spec D2-D4, D6). Everything
// here is derived from files in the project; nothing is curated.
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { detectPackageManager } from '../lib/pm.js';
import { runCapture as defaultRunCapture, type RunResult } from '../lib/run.js';

export type ManifestKind = 'package.json' | 'composer.json' | 'wordpress';

export interface FactPackage {
  name: string;
  group: 'Runtime' | 'Development';
  /** Resolved lockfile version, or the declared range without a lockfile. */
  version: string;
  source: ManifestKind;
}

export interface FactCommandGroup {
  group: string;
  entries: { run: string; note?: string }[];
}

export interface SummaryFacts {
  name: string | null;
  version: string | null;
  license: string | null;
  /** The manifest that supplied name/version/license (the first one found, D2). */
  manifest: ManifestKind | null;
  /** Every manifest present, in precedence order. */
  manifests: ManifestKind[];
  /** Runtime dependencies summed across manifests (package.json dependencies, composer require minus php/ext-*). */
  dependencies: number;
  devDependencies: number;
  packages: FactPackage[];
  /** Lookup for stack[].package / stack[].name: resolved version or declared range. */
  versions: Record<string, string>;
  extensions: string[];
  fileSource: 'git' | 'walk';
  sourceFiles: number;
  loc: number;
  /** True when reading stopped at the byte budget; the page then shows the LOC with a leading ≈. */
  locApprox: boolean;
  testFiles: number;
  releases: number;
  /** "git unavailable" when the tag listing failed. */
  releasesNote: string | null;
  workflows: number;
  commands: FactCommandGroup[];
  warnings: string[];
}

export interface FactsDeps {
  runCapture?: (cmd: string, args: string[], cwd: string) => RunResult;
  /** Byte budget for LOC counting; defaults to 10 MB. */
  maxBytes?: number;
}

export const FACTS_MAX_BYTES = 10 * 1024 * 1024;
const JS_EXT = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
const PHP_EXT = ['.php'];
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', '.git']);
const TEST_DIR_RE = /(^|\/)(test|tests|__tests__)\//;
const TEST_NAME_RE = /\.(test|spec)\.[^/]+$/;
const TAG_RE = /^v?\d/;

type Json = Record<string, unknown>;

function readJson(cwd: string, file: string, warnings: string[]): Json | null {
  const p = join(cwd, file);
  if (!existsSync(p)) return null;
  try {
    const v: unknown = JSON.parse(readFileSync(p, 'utf8'));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Json;
    warnings.push(`${file}: expected a JSON object`);
  } catch (err) {
    warnings.push(`${file}: ${(err as Error).message}`);
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function strMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Json)) if (typeof val === 'string') out[k] = val;
  return out;
}

function licenseOf(v: unknown): string | null {
  if (typeof v === 'string') return str(v);
  if (Array.isArray(v)) {
    const parts = v.filter((x): x is string => typeof x === 'string');
    return parts.length > 0 ? parts.join(' OR ') : null;
  }
  return null;
}

function readHead(path: string, bytes = 8192): string {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString('utf8');
  } finally {
    closeSync(fd);
  }
}

export interface WordPressHeader {
  type: 'theme' | 'plugin';
  file: string;
  name: string;
  version: string | null;
  license: string | null;
}

function headerField(text: string, field: string): string | null {
  const m = new RegExp(`^[\\s*#@/]*${field}:[ \\t]*(.+)$`, 'mi').exec(text);
  return m ? m[1].replace(/\s*\*\/\s*$/, '').trim() || null : null;
}

/** style.css with `Theme Name:` wins over a root *.php with `Plugin Name:` (sorted by file name). */
export function readWordPressHeader(cwd: string): WordPressHeader | null {
  const style = join(cwd, 'style.css');
  if (existsSync(style)) {
    const head = readHead(style);
    const name = headerField(head, 'Theme Name');
    if (name) return { type: 'theme', file: 'style.css', name, version: headerField(head, 'Version'), license: headerField(head, 'License') };
  }
  let entries: string[] = [];
  try {
    entries = readdirSync(cwd).filter((f) => f.toLowerCase().endsWith('.php')).sort();
  } catch {
    return null;
  }
  for (const f of entries) {
    const p = join(cwd, f);
    try {
      if (!statSync(p).isFile()) continue;
    } catch {
      continue;
    }
    const head = readHead(p);
    const name = headerField(head, 'Plugin Name');
    if (name) return { type: 'plugin', file: f, name, version: headerField(head, 'Version'), license: headerField(head, 'License') };
  }
  return null;
}

function npmLockVersions(cwd: string, warnings: string[]): Record<string, string> {
  const lock = readJson(cwd, 'package-lock.json', warnings);
  const out: Record<string, string> = {};
  const pkgs = lock?.packages;
  if (!pkgs || typeof pkgs !== 'object') return out;
  for (const [key, val] of Object.entries(pkgs as Json)) {
    if (!key.startsWith('node_modules/') || key.lastIndexOf('node_modules/') !== 0) continue;
    const v = (val as Json | null)?.version;
    if (typeof v === 'string') out[key.slice('node_modules/'.length)] = v;
  }
  return out;
}

function composerLockVersions(cwd: string, warnings: string[]): Record<string, string> {
  const lock = readJson(cwd, 'composer.lock', warnings);
  const out: Record<string, string> = {};
  for (const listKey of ['packages', 'packages-dev']) {
    const list = lock?.[listKey];
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      const name = (p as Json | null)?.name;
      const version = (p as Json | null)?.version;
      if (typeof name === 'string' && typeof version === 'string') out[name] = version;
    }
  }
  return out;
}

function composerCounts(name: string): boolean {
  return name !== 'php' && !name.startsWith('ext-');
}

/** Paths relative to cwd with forward slashes: `git ls-files -z`, else a directory walk. */
export function listProjectFiles(
  cwd: string,
  run: (cmd: string, args: string[], cwd: string) => RunResult,
): { source: 'git' | 'walk'; files: string[] } {
  const r = run('git', ['ls-files', '-z'], cwd);
  if (r.status === 0 && r.stdout.length > 0) {
    return { source: 'git', files: r.stdout.split('\0').filter(Boolean).sort() };
  }
  const files: string[] = [];
  const walk = (dir: string, rel: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), relPath);
      } else if (e.isFile()) {
        files.push(relPath);
      }
    }
  };
  walk(cwd, '');
  return { source: 'walk', files };
}

export function isTestFile(rel: string): boolean {
  return TEST_NAME_RE.test(rel) || TEST_DIR_RE.test(rel);
}

function countLines(buf: Buffer): number {
  if (buf.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  return buf[buf.length - 1] === 10 ? n : n + 1;
}

export function collectSummaryFacts(cwd: string, deps: FactsDeps = {}): SummaryFacts {
  const run = deps.runCapture ?? defaultRunCapture;
  const maxBytes = deps.maxBytes ?? FACTS_MAX_BYTES;
  const warnings: string[] = [];

  const pkg = readJson(cwd, 'package.json', warnings);
  const composer = readJson(cwd, 'composer.json', warnings);
  const wp = readWordPressHeader(cwd);

  const manifests: ManifestKind[] = [];
  if (pkg) manifests.push('package.json');
  if (composer) manifests.push('composer.json');
  if (wp) manifests.push('wordpress');
  const manifest = manifests[0] ?? null;

  let name: string | null = null;
  let version: string | null = null;
  let license: string | null = null;
  if (manifest === 'package.json' && pkg) {
    name = str(pkg.name);
    version = str(pkg.version);
    license = licenseOf(pkg.license);
  } else if (manifest === 'composer.json' && composer) {
    name = str(composer.name);
    version = str(composer.version);
    license = licenseOf(composer.license);
  } else if (manifest === 'wordpress' && wp) {
    ({ name, version, license } = wp);
  }
  // A plugin/theme header fills gaps a composer.json leaves (composer packages rarely carry a version).
  if (wp && manifest !== 'wordpress') {
    version ??= wp.version;
    license ??= wp.license;
  }

  const npmLock = pkg ? npmLockVersions(cwd, warnings) : {};
  const composerLock = composer ? composerLockVersions(cwd, warnings) : {};
  const packages: FactPackage[] = [];
  const versions: Record<string, string> = {};
  const add = (map: Record<string, string>, group: FactPackage['group'], source: ManifestKind, lock: Record<string, string>, keep: (n: string) => boolean): number => {
    let count = 0;
    for (const [dep, range] of Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (!keep(dep)) continue;
      count++;
      const v = lock[dep] ?? range;
      packages.push({ name: dep, group, version: v, source });
      versions[dep] ??= v;
    }
    return count;
  };
  let dependencies = 0;
  let devDependencies = 0;
  if (pkg) {
    dependencies += add(strMap(pkg.dependencies), 'Runtime', 'package.json', npmLock, () => true);
    devDependencies += add(strMap(pkg.devDependencies), 'Development', 'package.json', npmLock, () => true);
  }
  if (composer) {
    const require = strMap(composer.require);
    if (require.php) versions.php ??= require.php;
    dependencies += add(require, 'Runtime', 'composer.json', composerLock, composerCounts);
    devDependencies += add(strMap(composer['require-dev']), 'Development', 'composer.json', composerLock, composerCounts);
  }

  const extensions = manifest === 'package.json' ? JS_EXT : manifest === null ? [...JS_EXT, ...PHP_EXT] : PHP_EXT;
  const listed = listProjectFiles(cwd, run);
  let loc = 0;
  let bytes = 0;
  let locApprox = false;
  let sourceFiles = 0;
  let testFiles = 0;
  for (const rel of listed.files) {
    if (!extensions.includes(extname(rel).toLowerCase())) continue;
    sourceFiles++;
    if (isTestFile(rel)) testFiles++;
    if (locApprox) continue;
    let buf: Buffer;
    try {
      buf = readFileSync(join(cwd, rel));
    } catch {
      continue; // listed by git but deleted in the work tree
    }
    if (bytes + buf.length > maxBytes) {
      locApprox = true;
      continue;
    }
    bytes += buf.length;
    loc += countLines(buf);
  }

  const tags = run('git', ['tag', '--list'], cwd);
  const releases = tags.status === 0 ? tags.stdout.split(/\r?\n/).filter((t) => TAG_RE.test(t.trim())).length : 0;
  const releasesNote = tags.status === 0 ? null : 'git unavailable';

  let workflows = 0;
  try {
    workflows = readdirSync(join(cwd, '.github', 'workflows')).filter((f) => /\.ya?ml$/i.test(f)).length;
  } catch {
    workflows = 0;
  }

  const commands: FactCommandGroup[] = [];
  if (pkg) {
    const pm = detectPackageManager(cwd) ?? 'npm';
    const scripts = Object.entries(strMap(pkg.scripts));
    if (scripts.length > 0) {
      commands.push({ group: 'package.json scripts', entries: scripts.map(([s, body]) => ({ run: `${pm} run ${s}`, note: body.length > 80 ? `${body.slice(0, 79)}…` : body })) });
    }
  }
  if (composer) {
    const scripts = Object.entries(composer.scripts && typeof composer.scripts === 'object' ? (composer.scripts as Json) : {});
    if (scripts.length > 0) commands.push({ group: 'composer.json scripts', entries: scripts.map(([s]) => ({ run: `composer ${s}` })) });
  }

  return {
    name,
    version,
    license,
    manifest,
    manifests,
    dependencies,
    devDependencies,
    packages,
    versions,
    extensions,
    fileSource: listed.source,
    sourceFiles,
    loc,
    locApprox,
    testFiles,
    releases,
    releasesNote,
    workflows,
    commands,
    warnings,
  };
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run test/unit/summary-facts.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```powershell
git add src/dashboard/summary-facts.ts test/unit/summary-facts.test.ts
git commit -m "feat(summary): automatic project facts from manifests and git" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Hand over to verify**

Run: `node dist/bin.js phase TASK-87 verify`

---

### Task 4: Layout engine (TASK-88)

**Files:**
- Create: `src/dashboard/summary-layout.ts`
- Test: `test/unit/summary-layout.test.ts`

**Interfaces:**
- Consumes: `Architecture` and `checkArchitectureText` from Task 2 (tests only; the engine takes a structural `LayoutInput`), and the two fixtures from Task 2.
- Produces (in `src/dashboard/summary-layout.ts`):
  - `LAYOUT` constants (node 156 × 56, gaps 104/48, margins 18/36/20, port 18, bend 7)
  - types `Side`, `RouteKind ('H' | 'V' | 'VH' | 'HV')`, `Point`, `LayoutInput`, `Box`, `LabelSlot`, `Segment`, `LayoutEdge`, `LayoutNode`, `LayoutZone`, `LayoutWarning { code: 'route-fallback' | 'label-collision' | 'crossing'; edge: string; message: string }`, `LayoutResult { width; height; nodes; zones; edges; warnings; crossings; collisions }`
  - helpers shared with the client-side re-scoring: `estimateLabelWidth`, `colX`, `rowY`, `slotBox`, `badgeFor`, `slotsFor`, `scoreBox`, `pathD`
  - `layoutArchitecture(input: LayoutInput): LayoutResult`. It is pure and deterministic; the edge id is `from>to`.

**Contract:** spec L1–L7, unchanged.

**Decisions:**
- The label width table is an approximation of Plus Jakarta Sans 12.5 px / 500: narrow, wide and default character classes plus 2 px. The browser re-scores with measured widths after `document.fonts.ready`, using the emitted candidate slots and the same scoring constants.
- A "crossing" is an intersection at an interior point of two segments of *different* edges. Touching at shared ports or endpoints does not count.

- [ ] **Step 1: Start the phase**

Run: `node dist/bin.js phase TASK-88 impl`

- [ ] **Step 2: Write the failing tests.** Create `test/unit/summary-layout.test.ts`:

```ts
// test/unit/summary-layout.test.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkArchitectureText, type Architecture } from '../../src/dashboard/summary-schema.js';
import {
  estimateLabelWidth,
  layoutArchitecture,
  pathD,
  scoreBox,
  slotBox,
  slotsFor,
  type LayoutInput,
} from '../../src/dashboard/summary-layout.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'summary');

function fixture(name: string): Architecture {
  const r = checkArchitectureText(readFileSync(join(FIXTURES, `architecture.${name}.yml`), 'utf8'), name);
  if (r.status !== 'valid') throw new Error(`fixture ${name} is ${r.status}`);
  return r.architecture;
}

function graph(cols: number, rows: number, nodes: [string, number, number][], edges: [string, string][]): LayoutInput {
  return {
    grid: { cols, rows },
    zones: [],
    nodes: nodes.map(([id, c, r]) => ({ id, cell: [c, r] as [number, number] })),
    edges: edges.map(([from, to]) => ({ id: `${from}>${to}`, from, to, label: `${from}-${to}` })),
  };
}

describe('layoutArchitecture: fixtures', () => {
  it.each(['super-backlog', 'kursbuchung'])('%s lays out without crossings, collisions or warnings', (name) => {
    const g = layoutArchitecture(fixture(name));
    expect(g.crossings).toBe(0);
    expect(g.collisions).toBe(0);
    expect(g.warnings).toEqual([]);
    expect(g.width).toBe(2 * 18 + 5 * 156 + 4 * 104);
    expect(g.height).toBe(36 + 5 * 56 + 4 * 48 + 20);
  });

  it('is deterministic across runs and survives a JSON round-trip', () => {
    const a = layoutArchitecture(fixture('super-backlog'));
    const b = layoutArchitecture(fixture('super-backlog'));
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('emits nodes in reading order and edges in input order', () => {
    const arch = fixture('super-backlog');
    const g = layoutArchitecture(arch);
    const order = g.nodes.map((n) => [n.row, n.col]);
    const sorted = [...order].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    expect(order).toEqual(sorted);
    expect(g.edges.map((e) => e.id)).toEqual(arch.edges.map((e) => e.id));
  });

  it('draws zones 12px around their cell range with room for the label', () => {
    const g = layoutArchitecture(fixture('super-backlog'));
    // Kit (sbl): cols [1,3], rows [1,4]
    expect(g.zones[1]).toEqual({ label: 'Kit (sbl)', x: 18 + 260 - 12, y: 36 + 104 - 26, w: 3 * 260 - 104 + 24, h: 3 * 104 + 56 + 26 + 10 });
  });
});

describe('layoutArchitecture: routes', () => {
  it('routes a horizontal neighbour as H, straight', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 0]], [['a', 'b']]));
    const e = g.edges[0];
    expect(e.kind).toBe('H');
    expect(e.points).toEqual([[174, 64], [278, 64]]);
    expect(e.d).toBe('M174,64 L278,64');
  });

  it('routes a vertical neighbour as V', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 0, 1]], [['a', 'b']]));
    expect(g.edges[0].kind).toBe('V');
    expect(g.edges[0].points).toEqual([[96, 92], [96, 140]]);
  });

  it('prefers VH (vertical first) when the corner [from.col, to.row] is free', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 1]], [['a', 'b']]));
    const e = g.edges[0];
    expect(e.kind).toBe('VH');
    expect(e.points).toEqual([[96, 92], [96, 168], [278, 168]]);
    expect(e.d).toBe('M96,92 L96,161 Q96,168 103,168 L278,168');
  });

  it('falls back to HV when only the corner [to.col, from.row] is free', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 1], ['x', 0, 1]], [['a', 'b']]));
    expect(g.edges[0].kind).toBe('HV');
    expect(g.edges[0].fallback).toBe(false);
  });

  it('reports route-fallback for an impossible route and still returns a polyline', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 1], ['x', 0, 1], ['y', 1, 0]], [['a', 'b']]));
    const e = g.edges[0];
    expect(e.fallback).toBe(true);
    expect(e.points.length).toBeGreaterThanOrEqual(2);
    expect(g.warnings).toContainEqual({ code: 'route-fallback', edge: 'a>b', message: expect.stringMatching(/move one of the cells/) });
  });

  it('treats a blocked straight line as impossible when no L route exists', () => {
    const g = layoutArchitecture(graph(3, 2, [['a', 0, 0], ['m', 1, 0], ['b', 2, 0]], [['a', 'b']]));
    expect(g.edges[0].fallback).toBe(true);
  });
});

describe('layoutArchitecture: ports', () => {
  it('spreads ports on one side symmetrically at 18px and never crosses siblings', () => {
    // hub at the top centre fans out to three targets below it; all three leave through the bottom side
    const g = layoutArchitecture(
      graph(3, 3, [['hub', 1, 0], ['l', 0, 1], ['r', 2, 1], ['m', 1, 2]], [['hub', 'r'], ['hub', 'l'], ['hub', 'm']]),
    );
    const start = (id: string): number => (g.edges.find((e) => e.id === id) as { points: number[][] }).points[0][0];
    const cx = 18 + 260 + 78;
    expect([start('hub>l'), start('hub>m'), start('hub>r')]).toEqual([cx - 18, cx, cx + 18]);
    expect(g.crossings).toBe(0);
  });

  it('keeps straight edges straight when the target side has several ports', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 0], ['c', 0, 1]], [['a', 'b'], ['c', 'b']]));
    const ab = g.edges[0];
    expect(ab.kind).toBe('H');
    expect(ab.points[0][1]).toBe(ab.points[1][1]);
  });
});

describe('labels', () => {
  it('estimates widths from the character table, 7px per unknown character, plus 2px', () => {
    expect(estimateLabelWidth('')).toBe(2);
    expect(estimateLabelWidth('…')).toBe(9);
    expect(estimateLabelWidth('ab')).toBeCloseTo(2 * 6.9 + 2);
  });

  it('emits ten candidate slots (five positions x two sides) and the chosen index', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 0]], [['a', 'b']]));
    const e = g.edges[0];
    expect(e.candidates).toHaveLength(10);
    expect(e.candidates.slice(0, 2).map((c) => [c.t, c.side])).toEqual([[0.5, 'above'], [0.5, 'below']]);
    expect(e.slot).toBe(0);
    expect(e.score).toBe(0);
  });

  it('scoring prefers the collision-free candidate', () => {
    const seg = { x1: 0, y1: 100, x2: 200, y2: 100, horizontal: true, length: 200 };
    const [above, below] = slotsFor(seg);
    const tw = 40;
    // a node sits right above the middle of the segment
    const ctx = { width: 400, height: 300, nodeBoxes: [{ x0: 80, y0: 60, x1: 120, y1: 98 }], placed: [], foreignSegments: [] };
    expect(scoreBox(slotBox(above, tw).box, ctx)).toBe(3);
    expect(scoreBox(slotBox(below, tw).box, ctx)).toBe(0);
  });

  it('moves a label off a node in a real layout', () => {
    // edge a>b runs left to right two cells long, node c sits directly above the middle of the line
    const g = layoutArchitecture(graph(3, 2, [['a', 0, 1], ['b', 2, 1], ['c', 1, 0]], [['a', 'b']]));
    expect(g.edges[0].kind).toBe('H'); // the straight line passes the free cell [1,1]
    expect(g.collisions).toBe(0);
  });

  it('draws a 7px quadratic bend at the corner', () => {
    expect(pathD([[0, 0], [0, 50], [80, 50]])).toBe('M0,0 L0,43 Q0,50 7,50 L80,50');
  });
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run test/unit/summary-layout.test.ts`
Expected: FAIL, module `../../src/dashboard/summary-layout.js` not found.

- [ ] **Step 4: Implement the engine.** Create `src/dashboard/summary-layout.ts`:

```ts
// src/dashboard/summary-layout.ts
// Pure, synchronous layout engine for the summary canvas (spec 2026-10-09, L1-L7):
// grid cells -> pixels -> ports -> orthogonal routes -> label slots -> diagnostics.

export const LAYOUT = { w: 156, h: 56, gx: 104, gy: 48, mx: 18, mt: 36, mb: 20, port: 18, bend: 7 } as const;

export type Side = 'T' | 'B' | 'L' | 'R';
export type RouteKind = 'H' | 'V' | 'VH' | 'HV';
export type Point = [number, number];

export interface LayoutInput {
  grid: { cols: number; rows: number };
  zones: readonly { label: string; cols: readonly [number, number]; rows: readonly [number, number] }[];
  nodes: readonly { id: string; cell: readonly [number, number] }[];
  edges: readonly { id: string; from: string; to: string; label: string }[];
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LabelSlot {
  /** position along the segment (0..1) */
  t: number;
  /** 'above' | 'below' for horizontal segments, 'right' | 'left' for vertical ones */
  side: 'above' | 'below' | 'right' | 'left';
  /** anchor point on the line */
  px: number;
  py: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  horizontal: boolean;
  length: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  kind: RouteKind;
  fallback: boolean;
  points: Point[];
  d: string;
  /** longest segment, the one that carries label and step badge */
  segment: Segment;
  labelWidth: number;
  candidates: LabelSlot[];
  slot: number;
  score: number;
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
  badge: { x: number; y: number };
}

export interface LayoutNode {
  id: string;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutZone {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutWarning {
  code: 'route-fallback' | 'label-collision' | 'crossing';
  edge: string;
  message: string;
}

export interface LayoutResult {
  width: number;
  height: number;
  zones: LayoutZone[];
  /** reading order: row, then column (= tab order) */
  nodes: LayoutNode[];
  /** input order */
  edges: LayoutEdge[];
  warnings: LayoutWarning[];
  crossings: number;
  collisions: number;
}

/* ---------- label width estimate: Plus Jakarta Sans 12.5px / 500 ---------- */

const NARROW = { chars: " .,:;'!|iIlj", width: 3.4 };
const SEMI = { chars: 'frt()[]{}/\\-*"', width: 4.6 };
const WIDE = { chars: 'mwMW@', width: 10.6 };
const DIGIT_WIDTH = 7.4;
const UPPER_WIDTH = 8.4;
const LOWER_WIDTH = 6.9;
/** fallback for every character the table does not know (spec L1) */
const FALLBACK_WIDTH = 7;

function charWidth(ch: string): number {
  if (NARROW.chars.includes(ch)) return NARROW.width;
  if (SEMI.chars.includes(ch)) return SEMI.width;
  if (WIDE.chars.includes(ch)) return WIDE.width;
  if (ch >= '0' && ch <= '9') return DIGIT_WIDTH;
  if (ch >= 'A' && ch <= 'Z') return UPPER_WIDTH;
  if (ch >= 'a' && ch <= 'z') return LOWER_WIDTH;
  return FALLBACK_WIDTH;
}

/** Estimated rendered width of an edge label plus 2px breathing room. */
export function estimateLabelWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return round(w + 2);
}

/* ---------- geometry helpers ---------- */

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export const colX = (c: number): number => LAYOUT.mx + c * (LAYOUT.w + LAYOUT.gx);
export const rowY = (r: number): number => LAYOUT.mt + r * (LAYOUT.h + LAYOUT.gy);

/** Box occupied by a label at `slot` with text width `tw` (shared with the client re-scorer). */
export function slotBox(slot: LabelSlot, tw: number): { box: Box; x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const { px, py } = slot;
  switch (slot.side) {
    case 'above':
      return { x: px, y: py - 7, anchor: 'middle', box: { x0: px - tw / 2, y0: py - 20, x1: px + tw / 2, y1: py - 3 } };
    case 'below':
      return { x: px, y: py + 17, anchor: 'middle', box: { x0: px - tw / 2, y0: py + 4, x1: px + tw / 2, y1: py + 21 } };
    case 'right':
      return { x: px + 8, y: py + 4.5, anchor: 'start', box: { x0: px + 4, y0: py - 10.5, x1: px + 8 + tw, y1: py + 10.5 } };
    default:
      return { x: px - 8, y: py + 4.5, anchor: 'end', box: { x0: px - 8 - tw, y0: py - 10.5, x1: px - 4, y1: py + 10.5 } };
  }
}

/** Step badge position: on the line just before the label, moved past it near the segment start. */
export function badgeFor(seg: Segment, slot: LabelSlot, tw: number): { x: number; y: number } {
  const lo = seg.horizontal ? Math.min(seg.x1, seg.x2) : Math.min(seg.y1, seg.y2);
  const hi = seg.horizontal ? Math.max(seg.x1, seg.x2) : Math.max(seg.y1, seg.y2);
  if (seg.horizontal) {
    let bx = slot.px - tw / 2 - 14;
    if (bx < lo + 12) bx = slot.px + tw / 2 + 14;
    if (bx > hi - 12) bx = slot.px;
    return { x: round(bx), y: round(slot.py) };
  }
  let by = slot.py - 18;
  if (by < lo + 12) by = slot.py + 18;
  if (by > hi - 12) by = slot.py;
  return { x: round(slot.px), y: round(by) };
}

const SLOT_POSITIONS = [0.5, 0.38, 0.62, 0.26, 0.74] as const;

export function slotsFor(seg: Segment): LabelSlot[] {
  const out: LabelSlot[] = [];
  for (const t of SLOT_POSITIONS) {
    const px = round(seg.x1 + (seg.x2 - seg.x1) * t);
    const py = round(seg.y1 + (seg.y2 - seg.y1) * t);
    if (seg.horizontal) {
      out.push({ t, side: 'above', px, py }, { t, side: 'below', px, py });
    } else {
      out.push({ t, side: 'right', px, py }, { t, side: 'left', px, py });
    }
  }
  return out;
}

const hit = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function segHitsBox(sg: Segment, b: Box): boolean {
  if (sg.horizontal) {
    return sg.y1 >= b.y0 && sg.y1 <= b.y1 && Math.min(sg.x1, sg.x2) < b.x1 && Math.max(sg.x1, sg.x2) > b.x0;
  }
  return sg.x1 >= b.x0 && sg.x1 <= b.x1 && Math.min(sg.y1, sg.y2) < b.y1 && Math.max(sg.y1, sg.y2) > b.y0;
}

/** Score of a label box (spec L5): +5 outside, +3 per node, +2 per placed label, +1 per foreign segment. */
export function scoreBox(
  box: Box,
  ctx: { width: number; height: number; nodeBoxes: readonly Box[]; placed: readonly Box[]; foreignSegments: readonly Segment[] },
): number {
  let s = 0;
  if (box.x0 < 4 || box.x1 > ctx.width - 4 || box.y0 < 2 || box.y1 > ctx.height - 2) s += 5;
  for (const r of ctx.nodeBoxes) if (hit(box, r)) s += 3;
  for (const r of ctx.placed) if (hit(box, r)) s += 2;
  for (const sg of ctx.foreignSegments) if (segHitsBox(sg, box)) s += 1;
  return s;
}

/** Corner bend of `LAYOUT.bend` px as a quadratic curve; straight edges are one line. */
export function pathD(pts: readonly Point[]): string {
  const f = (n: number): string => String(round(n));
  if (pts.length === 2) return `M${f(pts[0][0])},${f(pts[0][1])} L${f(pts[1][0])},${f(pts[1][1])}`;
  const [a, c, b] = pts;
  const r = LAYOUT.bend;
  const d1 = Math.sign(c[0] - a[0]);
  const e1 = Math.sign(c[1] - a[1]);
  const d2 = Math.sign(b[0] - c[0]);
  const e2 = Math.sign(b[1] - c[1]);
  const p1: Point = [c[0] - d1 * r, c[1] - e1 * r];
  const p2: Point = [c[0] + d2 * r, c[1] + e2 * r];
  return `M${f(a[0])},${f(a[1])} L${f(p1[0])},${f(p1[1])} Q${f(c[0])},${f(c[1])} ${f(p2[0])},${f(p2[1])} L${f(b[0])},${f(b[1])}`;
}

/** Two segments of different edges meet at a point that is interior to at least one of them. */
function segmentsCross(a: Segment, b: Segment): boolean {
  if (a.horizontal === b.horizontal) {
    // collinear overlap of positive length
    if (a.horizontal) {
      if (a.y1 !== b.y1) return false;
      const lo = Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2));
      const hi = Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2));
      return hi - lo > 0;
    }
    if (a.x1 !== b.x1) return false;
    const lo = Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2));
    const hi = Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2));
    return hi - lo > 0;
  }
  const h = a.horizontal ? a : b;
  const v = a.horizontal ? b : a;
  const x = v.x1;
  const y = h.y1;
  const inH = x > Math.min(h.x1, h.x2) && x < Math.max(h.x1, h.x2);
  const inV = y > Math.min(v.y1, v.y2) && y < Math.max(v.y1, v.y2);
  const onH = x >= Math.min(h.x1, h.x2) && x <= Math.max(h.x1, h.x2);
  const onV = y >= Math.min(v.y1, v.y2) && y <= Math.max(v.y1, v.y2);
  return onH && onV && (inH || inV);
}

function segmentsOf(points: readonly Point[]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    out.push({ x1, y1, x2, y2, horizontal: y1 === y2, length: Math.abs(x2 - x1) + Math.abs(y2 - y1) });
  }
  return out;
}

function longest(segs: readonly Segment[]): Segment {
  return segs.reduce((m, s) => (s.length > m.length ? s : m), segs[0]);
}

const SIDES: Record<RouteKind, (dx: number, dy: number) => [Side, Side]> = {
  H: (dx) => (dx > 0 ? ['R', 'L'] : ['L', 'R']),
  V: (_dx, dy) => (dy > 0 ? ['B', 'T'] : ['T', 'B']),
  VH: (dx, dy) => [dy > 0 ? 'B' : 'T', dx > 0 ? 'L' : 'R'],
  HV: (dx, dy) => [dx > 0 ? 'R' : 'L', dy > 0 ? 'T' : 'B'],
};

interface WorkNode extends LayoutNode {
  cx: number;
  cy: number;
}

interface WorkEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  index: number;
  s: WorkNode;
  t: WorkNode;
  kind: RouteKind;
  fallback: boolean;
  sSide: Side;
  tSide: Side;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

/** Deterministic layout of a validated architecture (spec L1-L7). */
export function layoutArchitecture(input: LayoutInput): LayoutResult {
  const { cols, rows } = input.grid;
  const width = 2 * LAYOUT.mx + cols * LAYOUT.w + (cols - 1) * LAYOUT.gx;
  const height = LAYOUT.mt + rows * LAYOUT.h + (rows - 1) * LAYOUT.gy + LAYOUT.mb;

  const nodes: WorkNode[] = input.nodes.map((n) => {
    const x = colX(n.cell[0]);
    const y = rowY(n.cell[1]);
    return { id: n.id, col: n.cell[0], row: n.cell[1], x, y, w: LAYOUT.w, h: LAYOUT.h, cx: x + LAYOUT.w / 2, cy: y + LAYOUT.h / 2 };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const occupied = new Set(nodes.map((n) => `${n.col},${n.row}`));
  const free = (c: number, r: number): boolean => !occupied.has(`${c},${r}`);
  const clearH = (r: number, c0: number, c1: number): boolean => {
    for (let c = Math.min(c0, c1) + 1; c < Math.max(c0, c1); c++) if (!free(c, r)) return false;
    return true;
  };
  const clearV = (c: number, r0: number, r1: number): boolean => {
    for (let r = Math.min(r0, r1) + 1; r < Math.max(r0, r1); r++) if (!free(c, r)) return false;
    return true;
  };

  // L3: route kind per edge
  const work: WorkEdge[] = input.edges.map((e, index) => {
    const s = byId.get(e.from);
    const t = byId.get(e.to);
    if (!s || !t) throw new Error(`layout: edge ${e.id} references an unknown node`);
    const dx = t.col > s.col ? 1 : -1;
    const dy = t.row > s.row ? 1 : -1;
    let kind: RouteKind;
    let fallback = false;
    if (s.row === t.row && clearH(s.row, s.col, t.col)) kind = 'H';
    else if (s.col === t.col && clearV(s.col, s.row, t.row)) kind = 'V';
    else if (s.row !== t.row && s.col !== t.col && free(s.col, t.row) && clearV(s.col, s.row, t.row) && clearH(t.row, s.col, t.col)) kind = 'VH';
    else if (s.row !== t.row && s.col !== t.col && free(t.col, s.row) && clearH(s.row, s.col, t.col) && clearV(t.col, s.row, t.row)) kind = 'HV';
    else {
      fallback = true;
      kind = s.col === t.col ? 'V' : s.row === t.row ? 'H' : 'VH';
    }
    const [sSide, tSide] = SIDES[kind](dx, dy);
    return { id: e.id, from: e.from, to: e.to, label: e.label, index, s, t, kind, fallback, sSide, tSide, sx: 0, sy: 0, tx: 0, ty: 0 };
  });

  // L4: ports; the sort key keeps siblings on one side from crossing each other
  const straight = (ed: WorkEdge): boolean => ed.kind === 'H' || ed.kind === 'V';
  const key = (side: Side, node: WorkNode, other: WorkNode, isStraight: boolean): number => {
    if (isStraight) return 0;
    const ox = other.cx;
    const oy = other.cy;
    if (side === 'T') return ox < node.cx ? -1e6 - oy : 1e6 + oy;
    if (side === 'B') return ox < node.cx ? -1e6 + oy : 1e6 - oy;
    if (side === 'L') return oy < node.cy ? -1e6 - ox : 1e6 + ox;
    return oy < node.cy ? -1e6 + ox : 1e6 - ox;
  };
  interface Port {
    ed: WorkEdge;
    end: 's' | 't';
    key: number;
    tie: string;
  }
  const sides = new Map<string, Port[]>();
  const addPort = (node: WorkNode, side: Side, ed: WorkEdge, end: 's' | 't', other: WorkNode): void => {
    const k = `${node.id}:${side}`;
    const list = sides.get(k) ?? [];
    list.push({ ed, end, key: key(side, node, other, straight(ed)), tie: `${ed.id}:${end}` });
    sides.set(k, list);
  };
  for (const ed of work) {
    addPort(ed.s, ed.sSide, ed, 's', ed.t);
    addPort(ed.t, ed.tSide, ed, 't', ed.s);
  }
  for (const [k, list] of sides) {
    const sep = k.lastIndexOf(':');
    const node = byId.get(k.slice(0, sep)) as WorkNode;
    const side = k.slice(sep + 1) as Side;
    list.sort((a, b) => a.key - b.key || (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0));
    list.forEach((pt, i) => {
      const off = (i - (list.length - 1) / 2) * LAYOUT.port;
      let x: number;
      let y: number;
      if (side === 'T') [x, y] = [node.cx + off, node.y];
      else if (side === 'B') [x, y] = [node.cx + off, node.y + node.h];
      else if (side === 'L') [x, y] = [node.x, node.cy + off];
      else [x, y] = [node.x + node.w, node.cy + off];
      if (pt.end === 's') [pt.ed.sx, pt.ed.sy] = [x, y];
      else [pt.ed.tx, pt.ed.ty] = [x, y];
    });
  }
  for (const ed of work) {
    if (ed.kind === 'H') ed.ty = ed.sy;
    if (ed.kind === 'V') ed.tx = ed.sx;
  }

  // polylines
  const routed = work.map((ed) => {
    const { sx, sy, tx, ty } = ed;
    const points: Point[] =
      ed.kind === 'VH' ? [[sx, sy], [sx, ty], [tx, ty]] : ed.kind === 'HV' ? [[sx, sy], [tx, sy], [tx, ty]] : [[sx, sy], [tx, ty]];
    const segs = segmentsOf(points);
    return { ed, points, segs, seg: longest(segs) };
  });

  // L5: labels, longest segment first (stable, id tie-break)
  const nodeBoxes: Box[] = nodes.map((n) => ({ x0: n.x - 1, y0: n.y - 1, x1: n.x + n.w + 1, y1: n.y + n.h + 1 }));
  const placed: Box[] = [];
  const order = routed
    .slice()
    .sort((a, b) => b.seg.length - a.seg.length || (a.ed.id < b.ed.id ? -1 : a.ed.id > b.ed.id ? 1 : 0));
  const labels = new Map<string, { candidates: LabelSlot[]; slot: number; score: number; tw: number }>();
  for (const r of order) {
    const tw = estimateLabelWidth(r.ed.label);
    const candidates = slotsFor(r.seg);
    const foreignSegments = routed.filter((o) => o !== r).flatMap((o) => o.segs);
    let best = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < candidates.length; i++) {
      const s = scoreBox(slotBox(candidates[i], tw).box, { width, height, nodeBoxes, placed, foreignSegments });
      if (s < bestScore) {
        bestScore = s;
        best = i;
        if (s === 0) break;
      }
    }
    placed.push(slotBox(candidates[best], tw).box);
    labels.set(r.ed.id, { candidates, slot: best, score: bestScore, tw });
  }

  // L6: diagnostics
  const warnings: LayoutWarning[] = [];
  let crossings = 0;
  let collisions = 0;
  for (const r of routed) {
    if (r.ed.fallback) {
      warnings.push({
        code: 'route-fallback',
        edge: r.ed.id,
        message: `no straight or single-corner route from ${r.ed.from} to ${r.ed.to}; move one of the cells`,
      });
    }
  }
  for (const r of routed) {
    const l = labels.get(r.ed.id) as { score: number };
    if (l.score > 0) {
      collisions++;
      warnings.push({ code: 'label-collision', edge: r.ed.id, message: `label "${r.ed.label}" overlaps (score ${l.score})` });
    }
  }
  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const a = routed[i];
      const b = routed[j];
      if (a.segs.some((sa) => b.segs.some((sb) => segmentsCross(sa, sb)))) {
        crossings++;
        warnings.push({ code: 'crossing', edge: a.ed.id, message: `${a.ed.id} crosses ${b.ed.id}` });
      }
    }
  }

  const edges: LayoutEdge[] = routed.map((r) => {
    const l = labels.get(r.ed.id) as { candidates: LabelSlot[]; slot: number; score: number; tw: number };
    const chosen = slotBox(l.candidates[l.slot], l.tw);
    return {
      id: r.ed.id,
      from: r.ed.from,
      to: r.ed.to,
      kind: r.ed.kind,
      fallback: r.ed.fallback,
      points: r.points.map(([x, y]) => [round(x), round(y)] as Point),
      d: pathD(r.points),
      segment: r.seg,
      labelWidth: l.tw,
      candidates: l.candidates,
      slot: l.slot,
      score: l.score,
      label: { x: round(chosen.x), y: round(chosen.y), anchor: chosen.anchor },
      badge: badgeFor(r.seg, l.candidates[l.slot], l.tw),
    };
  });

  const zones: LayoutZone[] = input.zones.map((z) => {
    const x = colX(z.cols[0]) - 12;
    const y = rowY(z.rows[0]) - 26;
    return { label: z.label, x, y, w: colX(z.cols[1]) + LAYOUT.w + 12 - x, h: rowY(z.rows[1]) + LAYOUT.h + 10 - y };
  });

  const ordered = nodes
    .slice()
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map(({ id, col, row, x, y, w, h }) => ({ id, col, row, x, y, w, h }));

  return { width, height, zones, nodes: ordered, edges, warnings, crossings, collisions };
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run test/unit/summary-layout.test.ts`
Expected: PASS, 18 tests. Both fixtures give `crossings === 0`, `collisions === 0` and no warnings, and the output is deep-equal across runs.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```powershell
git add src/dashboard/summary-layout.ts test/unit/summary-layout.test.ts
git commit -m "feat(summary): deterministic orthogonal layout engine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Hand over to verify**

Run: `node dist/bin.js phase TASK-88 verify`

---

### Task 5: Template, shared tokens and render (TASK-89)

**Files:**
- Create: `src/templates/sbl-tokens.css`, `src/templates/summary.html`, `src/dashboard/summary-render.ts`
- Modify: `src/templates/dashboard.html` (token blocks → placeholder), `src/dashboard/render.ts` (export helpers, inject tokens), `src/dashboard/metrics.ts` (export `isDone`)
- Test: `test/unit/summary-render.test.ts` (new); `test/unit/__snapshots__/summary-render.test.ts.snap` (generated); `test/unit/__snapshots__/dashboard-render.test.ts.snap` (updated with `-u`)

**Interfaces:**
- Consumes: Tasks 1–4; `DashboardData` from `src/dashboard/data.ts`; `atomicWrite` from `src/lib/atomic.ts`; `Phase` type from `src/lib/phase.ts`.
- Produces:
  - `src/dashboard/render.ts`: `export function readTemplate(name = 'dashboard.html'): string`, `export function esc(s: string): string`, `export function jsonIsland(value: unknown): string`; `renderDashboard` now fills `__SBL_TOKENS_CSS__`.
  - `src/dashboard/metrics.ts`: `export function isDone(status: string): boolean`.
  - `src/dashboard/summary-render.ts`: `SUMMARY_DOCS_URL`, `MAX_NOTICE_PROBLEMS = 20`, types `SummaryModel`, `SummaryDeps extends FactsDeps { loadArchitecture?; layoutArchitecture? }`, `SummaryView`, and the functions:
    - `summaryFileFor(dashboardFile)` turns `x.html` into `x.summary.html`;
    - `formatPitch`, `formatCount`, `emptyFacts`;
    - `buildSummaryModel(cwd, data, deps?)`, `buildSummaryView(data, model)`, `noticeHtml(model)`, `renderSummary(data, model)`;
    - `writeSummaryPage(cwd, data, dashboardFile, deps?): string`. It never throws and returns the written path.
  - `src/templates/summary.html` placeholders: `__PROJECT_NAME__`, `__SBL_TOKENS_CSS__`, `__SUMMARY_NOTICE__`, `__SBL_SUMMARY_JSON__`, plus the server-rendered header facts. Page marker: `<meta name="sbl-page" content="summary">`.

**Error behavior (spec E1–E4):**
- E1, missing file: reduced view, no notice. The canvas card is replaced by the "No architecture file yet …" box (D6).
- E2, invalid file: reduced view plus a notice listing at most 20 problems as `path: message`, then "and K more".
- E3, any exception in the summary chain: reduced view plus the error notice. `writeSummaryPage` catches everything; the dashboard file was written before and is unaffected.
- E4, warnings only: full view; the warnings are listed under Data source.

**Decisions:**
- `esc`, `jsonIsland` and `readTemplate(name)` are exported from `render.ts`, and `isDone` from `metrics.ts`, instead of being duplicated.
- `summaryFileFor` and `writeSummaryPage` live in `summary-render.ts`, with injectable `loadArchitecture`/`layoutArchitecture` deps for the E3 tests.
- Tokens are injected LF-normalized and `trimEnd()`ed, so a CRLF checkout does not change the output.
- Spec deviation: the notice sits between the header and the canvas card. The spec puts it "above the profile"; this placement is the first thing visible after the pitch.
- The name pill shows the manifest package name. The six header facts are rendered on the server. Without curated `commands`/`stack`, the page falls back to the facts. Data source shows the path relative to the project.
- Snapshots are taken of the view model (`buildSummaryView`), not of the full HTML, so the 700-line template does not churn the snapshot file.
- The "no raw colors outside token blocks" rule (spec V2) is extended to `summary.html`.

- [ ] **Step 1: Start the phase**

Run: `node dist/bin.js phase TASK-89 impl`

- [ ] **Step 2: Write the failing tests.** Create `test/unit/summary-render.test.ts`:

```ts
// test/unit/summary-render.test.ts
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DashboardData, DashboardTask } from '../../src/dashboard/data.js';
import { renderDashboard } from '../../src/dashboard/render.js';
import type { SummaryFacts } from '../../src/dashboard/summary-facts.js';
import { layoutArchitecture } from '../../src/dashboard/summary-layout.js';
import {
  buildSummaryView,
  emptyFacts,
  formatCount,
  formatPitch,
  MAX_NOTICE_PROBLEMS,
  noticeHtml,
  renderSummary,
  summaryFileFor,
  writeSummaryPage,
  type SummaryModel,
} from '../../src/dashboard/summary-render.js';
import { ARCHITECTURE_PATH, checkArchitectureText, type ArchitectureLoadResult } from '../../src/dashboard/summary-schema.js';
import type { RunResult } from '../../src/lib/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(here, '..', 'fixtures', 'summary', 'architecture.super-backlog.yml'), 'utf8');
const TOKENS = readFileSync(join(here, '..', '..', 'src', 'templates', 'sbl-tokens.css'), 'utf8');

const TASKS: DashboardTask[] = [
  { id: 'T-1', title: 'Ship auth flow', status: 'Done', labels: ['phase/verify'], phase: 'verify', acs: [] },
  { id: 'T-2', title: 'Add OAuth refresh', status: 'In Progress', labels: ['phase/spec'], phase: 'spec', acs: [] },
  { id: 'T-3', title: 'Write <README>', status: 'To Do', labels: [], phase: null, acs: [] },
  { id: 'TASK-85', title: 'Parser', status: 'In Progress', labels: ['phase/impl'], phase: 'impl', acs: [] },
];

const DATA: DashboardData = {
  project: { name: 'demo-project', description: 'A demo <b>project</b>' },
  generatedAt: '2026-08-26T12:00:00.000Z',
  kitVersion: '0.1.0',
  latestVersion: null,
  statuses: [],
  milestones: [],
  tasks: TASKS,
  deps: [],
  activity: [],
  glossary: [],
  drafts: [],
  kpis: { throughput: [], leadTimeDays: null, wip: 0, blocked: 0 } as unknown as DashboardData['kpis'],
  source: 'backlog-json',
};

const FACTS: SummaryFacts = {
  ...emptyFacts(),
  name: 'super-backlog',
  version: '1.6.0',
  license: 'MIT',
  manifest: 'package.json',
  manifests: ['package.json'],
  dependencies: 3,
  devDependencies: 9,
  packages: [{ name: 'cross-spawn', group: 'Runtime', version: '7.0.6' } as SummaryFacts['packages'][number]],
  versions: { typescript: '7.0.2', vitest: '5.0.3', 'cross-spawn': '7.0.6' },
  extensions: ['.ts', '.mjs'],
  fileSource: 'git',
  sourceFiles: 212,
  loc: 31_480,
  testFiles: 96,
  releases: 14,
  workflows: 3,
  commands: [{ group: 'package.json scripts', entries: [{ run: 'npm test', note: 'vitest run' }] }],
};

function validModel(text = FIXTURE): SummaryModel {
  const load = checkArchitectureText(text, ARCHITECTURE_PATH);
  if (load.status !== 'valid') throw new Error(`fixture invalid: ${JSON.stringify(load)}`);
  return { facts: FACTS, load, layout: layoutArchitecture(load.architecture), renderError: null };
}
const missing: ArchitectureLoadResult = { status: 'missing', path: ARCHITECTURE_PATH };
const reducedModel: SummaryModel = { facts: FACTS, load: missing, layout: null, renderError: null };

function island(html: string): unknown {
  const m = /<script type="application\/json" id="sbl-summary">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('no summary island');
  return JSON.parse(m[1]);
}

describe('buildSummaryView', () => {
  it('full view (valid architecture) matches the snapshot', () => {
    expect(buildSummaryView(DATA, validModel())).toMatchSnapshot();
  });

  it('reduced view (no architecture file) matches the snapshot', () => {
    expect(buildSummaryView(DATA, reducedModel)).toMatchSnapshot();
  });

  it('lists open tasks only (D5) and maps them to nodes from tasks:', () => {
    const v = buildSummaryView(DATA, validModel());
    expect(v.tasks.map((t) => t.id)).toEqual(['T-2', 'T-3', 'TASK-85']);
    expect(v.tasks.find((t) => t.id === 'TASK-85')?.node).toBe('hub');
    expect(v.tasks.find((t) => t.id === 'T-2')?.node).toBeNull();
    expect(v.facts.at(-1)).toEqual({ value: '3', label: 'Open tasks' });
  });

  it('computes the six header facts on the server', () => {
    const v = buildSummaryView(DATA, reducedModel);
    expect(v.facts).toEqual([
      { value: '1.6.0', label: 'Version · MIT' },
      { value: '31k', label: 'Lines of code' },
      { value: '96', label: 'Test files' },
      { value: '3', label: 'Runtime dependencies' },
      { value: '14', label: 'Releases' },
      { value: '3', label: 'Open tasks' },
    ]);
    const approx = buildSummaryView(DATA, { ...reducedModel, facts: { ...FACTS, locApprox: true, releasesNote: 'git unavailable' } });
    expect(approx.facts[1].value).toBe('≈31k');
    expect(approx.facts[4].label).toBe('Releases (git unavailable)');
  });

  it('falls back to automatic commands and packages without a curated file', () => {
    const v = buildSummaryView(DATA, reducedModel);
    expect(v.architecture).toBeNull();
    expect(v.layout).toBeNull();
    expect(v.commands).toEqual(FACTS.commands);
    expect(v.stack).toEqual([{ name: 'cross-spawn', group: 'Runtime', version: '7.0.6', role: '', nodes: [] }]);
    expect(v.pitchHtml).toBe('A demo &lt;b&gt;project&lt;/b&gt;');
  });

  it('collects schema, layout and facts warnings into the data source (E4)', () => {
    const model = validModel();
    model.layout = { ...model.layout!, warnings: [{ code: 'route-fallback', edge: 'a-b', message: 'no clean route' } as never] };
    const v = buildSummaryView(DATA, { ...model, facts: { ...FACTS, warnings: ['package.json: bad'] } });
    expect(v.source.warnings).toEqual(['layout route-fallback a-b: no clean route', 'package.json: bad']);
  });
});

describe('formatPitch and escaping', () => {
  it('escapes first, then allows only **bold**', () => {
    expect(formatPitch('A **fast** <script>x</script> "q" & y')).toBe(
      'A <b>fast</b> &lt;script&gt;x&lt;/script&gt; &quot;q&quot; &amp; y',
    );
    expect(formatPitch('**<i>x</i>**')).toBe('<b>&lt;i&gt;x&lt;/i&gt;</b>');
  });

  it('keeps every other curated string raw in the view and escapes < in the JSON island', () => {
    const evil = FIXTURE.replace(/^ {4}label: .*$/m, '    label: "</script><i>**b**"');
    const html = renderSummary(DATA, validModel(evil));
    expect(html).not.toContain('</script><i>');
    expect(html).toContain('\\u003c/script>\\u003ci>**b**');
    const v = island(html) as { architecture: { nodes: { label: string }[] } };
    expect(v.architecture.nodes.some((n) => n.label === '</script><i>**b**')).toBe(true);
  });

  it('escapes the project name in title and app bar', () => {
    const html = renderSummary({ ...DATA, project: { ...DATA.project, name: 'x<y>"z' } }, reducedModel);
    expect(html).toContain('<title>x&lt;y&gt;&quot;z &middot; Project Summary</title>');
    expect(html).not.toContain('x<y>');
  });
});

describe('noticeHtml', () => {
  it('is empty for a valid file', () => {
    expect(noticeHtml(validModel())).toBe('');
  });

  it('explains the missing file and links the docs (D6, E1)', () => {
    const n = noticeHtml(reducedModel);
    expect(n).toContain('No architecture file yet');
    expect(n).toContain('<code>architecture-summary</code>');
    expect(n).toContain('<code>backlog/docs/architecture.yml</code>');
  });

  it('lists at most 20 problems as path: message, then "and K more" (E2)', () => {
    const problems = Array.from({ length: 23 }, (_, i) => ({ path: `nodes[${i}].id`, message: `bad <id> ${i}`, level: 'error' as const }));
    const n = noticeHtml({ ...reducedModel, load: { status: 'invalid', path: ARCHITECTURE_PATH, problems } });
    expect(n.match(/<li>/g)).toHaveLength(MAX_NOTICE_PROBLEMS);
    expect(n).toContain('<li><code>nodes[0].id</code>: bad &lt;id&gt; 0</li>');
    expect(n).not.toContain('nodes[20].id');
    expect(n).toContain('… and 3 more');
    expect(n).toContain('has 23 problems');
  });

  it('renders the notice into the page for an invalid file and keeps the reduced view', () => {
    const load = checkArchitectureText('schema: 2\n', ARCHITECTURE_PATH);
    expect(load.status).toBe('invalid');
    const html = renderSummary(DATA, { facts: FACTS, load, layout: null, renderError: null });
    expect(html).toContain('class="notice notice-error" role="alert"');
    expect((island(html) as { architecture: unknown }).architecture).toBeNull();
  });

  it('shows the render error (E3)', () => {
    const n = noticeHtml({ ...reducedModel, renderError: 'boom <x>' });
    expect(n).toContain('Summary could not be rendered (<code>boom &lt;x&gt;</code>)');
  });
});

describe('renderSummary template', () => {
  const html = renderSummary(DATA, validModel());

  it('replaces every placeholder', () => {
    expect(html).not.toMatch(/__[A-Z_]+__/);
  });

  it('defines colors only through tokens (no raw colors outside token blocks)', () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const outsideTokens = style.replace(/:root(\[data-theme="light"\])?\s*\{[\s\S]*?\}/g, '');
    expect(outsideTokens).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(outsideTokens).not.toMatch(/\brgba?\(/);
  });

  it('carries the page marker the hub tests look for', () => {
    expect(html).toContain('<meta name="sbl-page" content="summary">');
  });

  it('subscribes to ../api/events and resolves the shared sbl-theme key before paint', () => {
    expect(html).toContain("new EventSource('../api/events')");
    expect(html).toContain("localStorage.getItem('sbl-theme')");
    expect(html.indexOf("localStorage.getItem('sbl-theme')")).toBeLessThan(html.indexOf('<body>'));
  });

  it('links the page tabs (R4): Dashboard ../, Summary current, Backlog ../bb/', () => {
    expect(html).toContain('<a href="../">Dashboard</a>');
    expect(html).toContain('<a href="./" aria-current="page">Summary</a>');
    expect(html).toContain('<a href="../bb/">Backlog</a>');
  });

  it('inlines the shared tokens, including the new hues', () => {
    expect(html).toContain('--violet:');
    expect(html).toContain('--rose:');
    expect(html).toContain('--on-color:');
  });

  it('carries the accessibility hooks (role=group, aria-live panel, status toast)', () => {
    expect(html).toContain('id="panel" aria-live="polite"');
    expect(html).toContain('role="status"');
    expect(html).toContain("role: 'group'");
    expect(html).toContain("role: 'button'");
  });
});

describe('sbl-tokens.css', () => {
  it('defines the new hues in both the dark and the light block', () => {
    const [dark, light] = TOKENS.split(':root[data-theme="light"]');
    for (const block of [dark, light]) {
      for (const token of ['--surface-3', '--violet', '--violet-bg', '--violet-line', '--rose', '--rose-bg', '--rose-line', '--on-accent', '--on-color']) {
        expect(block).toContain(`${token}:`);
      }
    }
  });

  it('is inlined into the dashboard as well', () => {
    expect(renderDashboard({ ...DATA, statuses: [], kpis: DATA.kpis })).not.toContain('__SBL_TOKENS_CSS__');
  });
});

describe('helpers', () => {
  it('summaryFileFor replaces the .html suffix', () => {
    expect(summaryFileFor('/tmp/sbl-dashboard-1-demo.html')).toBe('/tmp/sbl-dashboard-1-demo.summary.html');
    expect(summaryFileFor('C:\\x\\dashboard.HTML')).toBe('C:\\x\\dashboard.summary.html');
  });

  it.each([
    [0, '0'],
    [980, '980'],
    [5000, '5k'],
    [5234, '5.2k'],
    [48_213, '48k'],
  ])('formatCount(%i) = %s', (n, s) => {
    expect(formatCount(n)).toBe(s);
  });
});

describe('writeSummaryPage', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'sbl-summary-'));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });
  const noGit = (): RunResult => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });

  it('writes the reduced page next to the dashboard file when no architecture file exists', () => {
    const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), { runCapture: noGit });
    expect(file).toBe(join(cwd, 'dash.summary.html'));
    const html = readFileSync(file, 'utf8');
    expect(html).toContain('No architecture file yet');
  });

  it('degrades to the reduced view with the error notice when layout throws (E3)', () => {
    const load = checkArchitectureText(FIXTURE, ARCHITECTURE_PATH);
    const file = writeSummaryPage(cwd, DATA, join(cwd, 'dash.html'), {
      runCapture: noGit,
      loadArchitecture: () => load,
      layoutArchitecture: () => {
        throw new Error('layout exploded');
      },
    });
    const html = readFileSync(file, 'utf8');
    expect(html).toContain('Summary could not be rendered (<code>layout exploded</code>)');
    expect((island(html) as { architecture: unknown }).architecture).toBeNull();
  });

  it('never throws, even when the target cannot be written', () => {
    writeFileSync(join(cwd, 'blocker'), 'a file where a directory is expected');
    const target = join(cwd, 'blocker', 'dash.html');
    expect(() => writeSummaryPage(cwd, DATA, target, { runCapture: noGit })).not.toThrow();
    expect(existsSync(summaryFileFor(target))).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run test/unit/summary-render.test.ts`
Expected: FAIL, module `../../src/dashboard/summary-render.js` not found.

- [ ] **Step 4: Export the shared helpers.** In `src/dashboard/metrics.ts`, change `function isDone(status: string): boolean {` to:

```ts
export function isDone(status: string): boolean {
```

In `src/dashboard/render.ts`, replace the `readTemplate` function:

```ts
function readTemplate(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // src/dashboard at dev time, dist/dashboard at runtime
  const candidates = [
    join(here, '..', 'templates', 'dashboard.html'),
    join(here, 'templates', 'dashboard.html'),
  ];
  for (const c of candidates) if (existsSync(c)) return readFileSync(c, 'utf8');
  throw new Error('template not found: dashboard.html');
}
```

with:

```ts
/** Reads a file from src/templates (dev) or dist/templates (runtime). */
export function readTemplate(name = 'dashboard.html'): string {
  const here = dirname(fileURLToPath(import.meta.url)); // src/dashboard at dev time, dist/dashboard at runtime
  const candidates = [
    join(here, '..', 'templates', name),
    join(here, 'templates', name),
  ];
  for (const c of candidates) if (existsSync(c)) return readFileSync(c, 'utf8');
  throw new Error(`template not found: ${name}`);
}
```

Then change `function esc(s: string): string {` to `export function esc(s: string): string {` and `function jsonIsland(value: unknown): string {` to `export function jsonIsland(value: unknown): string {`. In `renderDashboard`, insert the token injection as the first replacement of the chain:

```ts
export function renderDashboard(data: DashboardData): string {
  return readTemplate()
    .replaceAll('__SBL_TOKENS_CSS__', () => readTemplate('sbl-tokens.css').replace(/\r\n/g, '\n').trimEnd())
    .replaceAll('__PROJECT_NAME__', () => esc(data.project.name))
```

(the rest of the chain is unchanged).

- [ ] **Step 5: Extract the shared tokens.** Create `src/templates/sbl-tokens.css`. Its content is the two token blocks of `dashboard.html` (current lines 12–79, `  :root {` … `  }` and `  :root[data-theme="light"] {` … `  }`), extended by the spec V2 hues and the two text-on-color tokens the summary uses:

```css
  :root {
    --bg:#0a0e16;
    --bg-glow-1: rgba(92,200,255,.06);
    --bg-glow-2: rgba(62,207,142,.04);
    --surface:#111826;
    --surface-2:#0d1320;
    --line:#1e293c;
    --line-strong:#2c3b57;
    --text:#e8edf6;
    --muted:#8fa0ba;
    --dim:#72839f;
    --accent:#5cc8ff;
    --accent-dim:#234257;
    --ok:#3ecf8e;
    --ok-bg:#12291e;
    --warn:#ffb454;
    --warn-bg:#33260f;
    --danger:#ff7a7a;
    --danger-bg:#331718;
    --sans:"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif;
    --mono:"JetBrains Mono",Consolas,"Courier New",monospace;
    --ok-line:#2b5642;
    --accent-bg:#10202e;
    --accent-line:#274a63;
    --warn-line:#5c4520;
    --danger-line:#5c2c2c;
    --backdrop:rgba(4,7,12,.65);
    --tip-bg:rgba(13,19,32,.97);
    --shadow-dialog:0 24px 80px rgba(0,0,0,.55);
    --shadow-tip:0 10px 28px rgba(0,0,0,.5);
    --glow-accent:rgba(92,200,255,.6);
    --glow-warn:rgba(255,180,84,.25);
    --glow-warn-soft:rgba(255,180,84,.3);
    --focus-ring:rgba(92,200,255,.15);
    --surface-3:#161f31;
    --violet:#b69cff;
    --violet-bg:#1d1833;
    --violet-line:#3d3366;
    --rose:#ff7a9c;
    --rose-bg:#2f1621;
    --rose-line:#5a2a3b;
    --on-accent:#04131d;
    --on-color:#07101a;
  }
  :root[data-theme="light"] {
    --bg:#f3f6fb;
    --bg-glow-1: rgba(11,116,181,.05);
    --bg-glow-2: rgba(23,122,78,.04);
    --surface:#ffffff;
    --surface-2:#e9eef7;
    --line:#d7dfeb;
    --line-strong:#b6c3d8;
    --text:#17202f;
    --muted:#4c5d77;
    --dim:#5a6881;
    --accent:#0a6ca8;
    --accent-dim:#bcdcf0;
    --ok:#16764b;
    --ok-bg:#dff3e8;
    --warn:#8a5a00;
    --warn-bg:#fbecd2;
    --danger:#b83a3a;
    --danger-bg:#fbe3e3;
    --ok-line:#9fd4b8;
    --accent-bg:#e2f0f9;
    --accent-line:#a8cfe6;
    --warn-line:#e3c68e;
    --danger-line:#eab5b5;
    --backdrop:rgba(23,32,47,.45);
    --tip-bg:rgba(255,255,255,.98);
    --shadow-dialog:0 24px 80px rgba(23,32,47,.25);
    --shadow-tip:0 10px 28px rgba(23,32,47,.18);
    --glow-accent:rgba(11,116,181,.35);
    --glow-warn:rgba(138,90,0,.2);
    --glow-warn-soft:rgba(138,90,0,.25);
    --focus-ring:rgba(11,116,181,.18);
    --surface-3:#dfe6f2;
    --violet:#5b3fc4;
    --violet-bg:#ece6ff;
    --violet-line:#c7b8f5;
    --rose:#b8325a;
    --rose-bg:#fde4ec;
    --rose-line:#f0b3c6;
    --on-accent:#ffffff;
    --on-color:#ffffff;
  }
```

Then, in `src/templates/dashboard.html`, delete those two blocks (lines 12–79, from `  :root {` through the `  }` that closes `:root[data-theme="light"]`). Replace them with the single line below, directly after `<style>`:

```html
__SBL_TOKENS_CSS__
```

No build change is needed: `scripts/copy-templates.mjs` copies the whole `src/templates/` directory to `dist/templates/`.

- [ ] **Step 6: Create the summary template.** Create `src/templates/summary.html`. It is the approved prototype `design-demos/project-summary-v5.html`, converted: shared tokens, placeholders, the hub's theme resolver and EventSource, and the data taken from the JSON island:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="sbl-page" content="summary">
<title>__PROJECT_NAME__ &middot; Project Summary</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='%235cc8ff'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
__SBL_TOKENS_CSS__
  :root { --ease:cubic-bezier(.22,1,.36,1); --z-sticky:20; --z-toast:50; --bar-h:50px; }

  *,*::before,*::after { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 var(--sans); -webkit-font-smoothing:antialiased; overflow-x:hidden; }
  button { font:inherit; color:inherit; background:none; border:0; padding:0; cursor:pointer; text-align:left; }
  code, kbd { font-family:var(--mono); font-size:.92em; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; box-shadow:0 0 0 4px var(--focus-ring); }
  a { color:var(--accent); }
  h1, h2, h3 { margin:0; font-weight:600; text-wrap:balance; }
  p { margin:0; }
  ul, ol { margin:0; padding:0; list-style:none; }
  [hidden] { display:none !important; }

  /* ---------- App bar (R4) ---------- */
  .appbar { position:sticky; top:0; z-index:var(--z-sticky); height:var(--bar-h); display:flex; align-items:center; gap:18px; padding:0 20px; background:color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
  .brand { display:flex; align-items:center; gap:8px; font-weight:600; font-size:14px; min-width:0; }
  .brand-glyph { color:var(--accent); font-size:.8rem; line-height:1; text-shadow:0 0 12px var(--glow-accent); }
  .brand b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tabs { display:flex; gap:2px; margin-left:8px; }
  .tabs a { color:var(--muted); text-decoration:none; font-size:13.5px; padding:6px 10px; border-radius:6px; min-height:24px; }
  .tabs a:hover { color:var(--text); }
  .tabs a[aria-current] { color:var(--text); background:var(--surface-3); }
  .crumb { margin-left:auto; color:var(--dim); font-family:var(--mono); font-size:12px; }
  .theme-toggle { width:28px; height:28px; border-radius:50%; font-size:.9rem; line-height:1; text-align:center; color:var(--muted); background:var(--surface-2); border:1px solid var(--line-strong); flex:none; }
  .theme-toggle:hover { color:var(--accent); border-color:var(--accent); }
  @media (max-width:760px) { .crumb { display:none; } .appbar { gap:10px; padding:0 16px; } .theme-toggle { margin-left:auto; } }
  @media (max-width:480px) { .brand b { display:none; } .tabs { margin-left:0; } }

  /* ---------- Page frame ---------- */
  main { max-width:1280px; margin:0 auto; padding:26px 24px 80px; }
  @media (max-width:760px) { main { padding:18px 16px 72px; } }

  /* ---------- Head: pitch + facts (V4) ---------- */
  .head { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px 44px; align-items:start; padding-bottom:20px; }
  .head h1 { font-size:26px; letter-spacing:-.01em; display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; line-height:1.2; }
  .head h1 .pill { font-size:12px; font-weight:600; color:var(--muted); font-family:var(--mono); padding:3px 8px; border:1px solid var(--line); border-radius:999px; letter-spacing:0; }
  .head .pitch { max-width:62ch; margin-top:10px; color:var(--muted); font-size:15px; text-wrap:pretty; }
  .head .pitch b { color:var(--text); font-weight:600; }
  .facts { display:grid; grid-template-columns:repeat(3,auto); gap:10px 28px; margin:0; padding-top:6px; }
  .facts div { display:flex; flex-direction:column-reverse; justify-content:flex-end; }
  .facts dd { margin:0; font-size:20px; font-weight:600; letter-spacing:-.01em; line-height:1.15; font-variant-numeric:tabular-nums; }
  .facts dt { font-size:12px; color:var(--muted); line-height:1.3; margin-top:2px; }
  @media (max-width:900px) { .head { grid-template-columns:1fr; } .facts { padding-top:0; gap:8px 22px; } }

  /* ---------- Notice (D6, E2, E3) ---------- */
  .notice { margin:0 0 20px; padding:12px 16px; border:1px solid var(--accent-line); background:var(--accent-bg); border-radius:10px; font-size:14px; color:var(--text); }
  .notice-error { border-color:var(--warn-line); background:var(--warn-bg); }
  .notice ul { margin-top:6px; display:flex; flex-direction:column; gap:2px; font-size:13px; color:var(--muted); }
  .notice li code { color:var(--text); }
  .notice p + p { margin-top:6px; }

  /* ---------- Canvas card ---------- */
  .canvas { background:var(--surface); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow-tip); }
  .toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px 22px; flex-wrap:wrap; padding:12px 14px 10px; border-bottom:1px solid var(--line); }
  .flows { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .flows .fl { font-size:13px; color:var(--muted); margin-right:4px; }
  .chip { display:inline-flex; align-items:center; gap:7px; min-height:28px; padding:5px 11px 5px 9px; border:1px solid var(--line); border-radius:999px; font-size:13px; font-weight:500; color:var(--text); background:var(--surface); transition:background .15s, border-color .15s, color .15s; white-space:nowrap; }
  .chip .dot { width:9px; height:9px; border-radius:50%; background:var(--c); flex:none; }
  .chip:hover { border-color:var(--line-strong); background:var(--surface-3); }
  .chip[aria-pressed="true"] { background:var(--c); border-color:var(--c); color:var(--on-color); }
  .chip[aria-pressed="true"] .dot { background:var(--on-color); }
  .legend { display:flex; flex-wrap:wrap; align-items:center; gap:5px 14px; font-size:12.5px; color:var(--muted); }
  .legend span { display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
  .legend i { display:inline-block; width:14px; height:10px; border:1.5px solid var(--c); border-radius:3px; }
  .legend i.dashed { border-style:dashed; }
  .legend i.round { width:12px; height:12px; border-radius:50%; }

  .stage { position:relative; padding:12px 10px 6px; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; }
  .stage svg { display:block; width:100%; height:auto; font-family:var(--sans); user-select:none; -webkit-user-select:none; }
  @media (max-width:760px) { .stage svg { min-width:860px; } .stage { padding:8px 6px 4px; } }
  .stage .grid { fill:url(#sbl-dots); }
  .zone rect { fill:var(--surface-2); stroke:var(--line); stroke-width:1; }
  .zone text { font-size:12px; font-weight:600; fill:var(--dim); letter-spacing:.01em; }

  .edge { transition:opacity .22s var(--ease); }
  .edge path { fill:none; stroke:var(--line-strong); stroke-width:1.6; stroke-linejoin:round; marker-end:url(#sbl-arrow); }
  .edge .lbl { font-size:12.5px; font-weight:500; fill:var(--muted); paint-order:stroke; stroke:var(--surface); stroke-width:5px; stroke-linejoin:round; }
  .edge.near path { stroke:var(--accent); stroke-width:2.2; }
  .edge.near .lbl { fill:var(--text); }
  .edge .step { display:none; }
  .edge .step circle { fill:var(--fc); stroke:var(--surface); stroke-width:2; }
  .edge .step text { font-size:11px; font-weight:700; fill:var(--on-color); text-anchor:middle; }
  svg.flowing .edge.hot .step { display:block; }
  svg.flowing .edge.hot path { stroke:var(--fc); stroke-width:2.6; stroke-dasharray:8 6; animation:sbl-dash 1.1s linear infinite; }
  svg.flowing .edge.hot .lbl { fill:var(--text); }
  svg.flowing .edge:not(.hot) { opacity:.14; }
  svg.flowing .node:not(.hot) { opacity:.26; }
  svg.filtering .node:not(.used) { opacity:.26; }
  svg.filtering .edge { opacity:.2; }
  @keyframes sbl-dash { to { stroke-dashoffset:-28; } }

  .node { cursor:pointer; transition:opacity .22s var(--ease); }
  .node rect.box { fill:var(--surface); stroke:var(--kc); stroke-width:1.4; }
  .node.ext rect.box { stroke-dasharray:5 4; }
  .node:hover rect.box, .node:focus-visible rect.box { stroke-width:2.2; }
  .node:focus { outline:none; box-shadow:none; }
  .node:focus-visible rect.box { stroke:var(--accent); stroke-width:2.4; }
  .node.sel rect.box { fill:var(--accent-bg); stroke:var(--accent); stroke-width:2.4; }
  .node .tt { font-size:14px; font-weight:600; fill:var(--text); }
  .node .ts { font-family:var(--mono); font-size:11.5px; fill:var(--muted); }
  .node .badge circle { fill:var(--surface); stroke:var(--accent); stroke-width:2; }
  svg.flowing .node .badge { display:none; }
  .node .badge text { font-size:11.5px; font-weight:700; fill:var(--accent); text-anchor:middle; }
  .node.kin rect.box { stroke-width:2.2; }

  /* ---------- Panel below the canvas ---------- */
  .panel { border-top:1px solid var(--line); padding:14px 16px 16px; min-height:72px; }
  .panel .hint { color:var(--muted); font-size:14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .panel .hint kbd { font-size:11.5px; padding:1px 6px; border:1px solid var(--line); border-radius:4px; background:var(--surface-2); }
  .ptitle { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-bottom:4px; }
  .ptitle h3 { font-size:17px; display:inline-flex; align-items:center; gap:8px; }
  .ptitle h3 .kd { width:11px; height:11px; border-radius:3px; border:1.5px solid var(--kc); display:inline-block; }
  .ptitle .sub { font-family:var(--mono); font-size:12px; color:var(--muted); }
  .ptitle .num { font-size:11.5px; font-weight:700; color:var(--on-accent); background:var(--accent); border-radius:999px; min-width:19px; height:19px; line-height:19px; text-align:center; padding:0 5px; }
  .pclose { margin-left:auto; min-height:24px; font-size:12.5px; color:var(--muted); padding:3px 8px; border:1px solid var(--line); border-radius:6px; }
  .pclose:hover { color:var(--text); border-color:var(--line-strong); }
  .pgrid { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr); gap:12px 32px; margin-top:8px; }
  @media (max-width:860px) { .pgrid { grid-template-columns:1fr; } }
  .pgrid h4 { margin:0 0 5px; font-size:12.5px; font-weight:600; color:var(--dim); }
  .pgrid p { font-size:14px; color:var(--text); max-width:64ch; text-wrap:pretty; }
  .pgrid p.why { color:var(--muted); margin-top:10px; }
  .pgrid p.why b { color:var(--text); font-weight:600; }
  .conn { display:flex; flex-direction:column; gap:4px; }
  .conn li { display:flex; align-items:baseline; gap:8px; font-size:13.5px; }
  .conn .arr { color:var(--dim); font-family:var(--mono); font-size:12px; width:16px; flex:none; text-align:center; }
  .conn button, .steps button { min-height:24px; font-weight:600; color:var(--accent); border-radius:4px; }
  .conn button:hover, .steps button:hover { text-decoration:underline; }
  .conn .el, .steps .el { color:var(--muted); font-size:11.5px; font-family:var(--mono); }
  .chips { display:flex; flex-wrap:wrap; gap:5px; }
  .chips code { font-size:11.5px; padding:2px 7px; border:1px solid var(--line); border-radius:5px; background:var(--surface-2); color:var(--muted); }
  .pblock { margin-top:12px; }
  .cmds { display:flex; flex-direction:column; gap:5px; }
  .cmd { display:flex; align-items:center; gap:10px; padding:5px 6px 5px 10px; background:var(--surface-2); border:1px solid var(--line); border-radius:6px; min-width:0; }
  .cmd code { font-size:12.5px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1 1 auto; }
  .cmd small { font-size:12px; color:var(--muted); white-space:nowrap; flex:none; }
  .copy { width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border-radius:5px; color:var(--muted); flex:none; }
  .copy svg { width:15px; height:15px; }
  .copy:hover { background:var(--surface-3); color:var(--text); }
  .copy[data-done="1"] { color:var(--ok); }
  @media (max-width:520px) { .cmd small { display:none; } }
  .tasks li { display:flex; align-items:baseline; gap:8px; font-size:13.5px; padding:4px 0; }
  .tasks .tid { font-family:var(--mono); font-size:12px; color:var(--accent); font-weight:500; flex:none; }
  .tasks .ph { font-family:var(--mono); font-size:11px; color:var(--dim); margin-left:auto; flex:none; white-space:nowrap; }
  .tasks .ph.verify { color:var(--ok); }
  .tasks .tt { color:var(--text); }
  .tasks button.tt { min-height:24px; border-radius:4px; }
  .tasks button.tt:hover { color:var(--accent); }
  .empty { font-size:13px; color:var(--dim); }

  /* flow steps */
  .steps { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:6px 18px; margin-top:10px; }
  .steps li { display:grid; grid-template-columns:22px minmax(0,1fr); gap:2px 8px; font-size:13.5px; padding:5px 0; }
  .steps .n { width:20px; height:20px; border-radius:50%; background:var(--fc); color:var(--on-color); font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; grid-row:span 2; margin-top:1px; }
  .steps .ft { font-weight:600; }
  .steps .ft .el { font-weight:400; }
  .steps .fd { color:var(--muted); font-size:12.5px; text-wrap:pretty; }
  .pflow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .pflow .cmd { flex:0 1 auto; max-width:100%; }
  .pflow p { color:var(--muted); font-size:14px; flex:1 1 320px; }

  /* ---------- Profile row (V4) ---------- */
  .around { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr); gap:26px 36px; margin-top:30px; }
  .around.reduced { margin-top:6px; }
  @media (max-width:980px) { .around { grid-template-columns:1fr 1fr; } }
  @media (max-width:640px) { .around { grid-template-columns:1fr; gap:24px; } }
  .sec { min-width:0; }
  .sec h2 { font-size:15px; margin-bottom:10px; display:flex; align-items:baseline; gap:8px; }
  .sec h2 small { font-size:12.5px; font-weight:400; color:var(--muted); }
  .sec h2.later { margin-top:22px; }
  .specs li { display:grid; grid-template-columns:22px minmax(0,1fr); gap:0 10px; padding:6px 0; }
  .specs .num { width:20px; height:20px; border-radius:50%; background:var(--accent); color:var(--on-accent); font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; margin-top:1px; }
  .specs button.st { min-height:24px; font-weight:600; font-size:14px; border-radius:4px; }
  .specs button.st:hover { color:var(--accent); }
  .specs .sd { grid-column:2; font-size:13px; color:var(--muted); text-wrap:pretty; }
  .cgroup { margin-bottom:12px; }
  .cgroup h3 { font-size:12.5px; font-weight:600; color:var(--dim); margin-bottom:5px; }
  .stack { display:flex; flex-direction:column; gap:2px; }
  .stack .sg { font-size:12px; font-weight:600; color:var(--dim); margin:8px 0 2px; }
  .stack .sg:first-child { margin-top:0; }
  .stack .item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:0 10px; padding:4px 8px; margin:0 -8px; border-radius:6px; font-size:13.5px; line-height:1.35; min-height:24px; }
  .stack button.item:hover { background:var(--surface-3); }
  .stack button.item[aria-pressed="true"] { background:var(--accent-bg); outline:1px solid var(--accent-line); }
  .stack .item b { font-weight:600; }
  .stack .item .v { font-family:var(--mono); font-size:11.5px; color:var(--muted); text-align:right; }
  .stack .item .r { grid-column:1/3; font-size:12px; color:var(--muted); }
  .stack-hint { font-size:12.5px; color:var(--dim); margin-top:8px; }

  /* ---------- Data source (V4, E4) ---------- */
  details.source { margin-top:34px; border-top:1px solid var(--line); padding-top:14px; }
  details.source summary { cursor:pointer; font-size:14px; font-weight:600; display:flex; gap:10px; align-items:baseline; list-style:none; min-height:24px; }
  details.source summary::-webkit-details-marker { display:none; }
  details.source summary::before { content:"▸"; color:var(--dim); font-size:12px; }
  details[open].source summary::before { content:"▾"; }
  details.source summary span { font-weight:400; color:var(--muted); font-size:13px; }
  .src { display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:22px; margin-top:14px; }
  @media (max-width:900px) { .src { grid-template-columns:1fr; } }
  .src h3 { font-size:12.5px; font-weight:600; color:var(--dim); margin-bottom:6px; }
  .src li { font-size:13px; color:var(--muted); padding:3px 0 3px 14px; position:relative; text-wrap:pretty; overflow-wrap:anywhere; }
  .src li::before { content:""; position:absolute; left:0; top:11px; width:6px; height:6px; border-radius:50%; background:var(--line-strong); }
  .src .warn li::before { background:var(--warn); }

  .toast { position:fixed; left:50%; bottom:22px; transform:translate(-50%,10px); opacity:0; pointer-events:none; z-index:var(--z-toast); background:var(--text); color:var(--bg); font-size:13px; font-weight:600; padding:8px 14px; border-radius:8px; transition:opacity .18s var(--ease), transform .18s var(--ease); }
  .toast.on { opacity:1; transform:translate(-50%,0); }

  @media (prefers-reduced-motion:reduce) {
    *, *::before, *::after { animation:none !important; transition-duration:.01ms !important; }
    svg.flowing .edge.hot path { stroke-dasharray:none; }
  }
</style>
<script>
(function () {
  var theme = null;
  try { theme = localStorage.getItem('sbl-theme'); } catch (e) { theme = null; }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
</script>
</head>
<body>
<header class="appbar">
  <div class="brand"><span class="brand-glyph">●</span><b>__PROJECT_NAME__</b></div>
  <nav class="tabs" aria-label="Project pages">
    <a href="../">Dashboard</a>
    <a href="./" aria-current="page">Summary</a>
    <a href="../bb/">Backlog</a>
  </nav>
  <div class="crumb" id="crumb"></div>
  <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Switch color theme">◐</button>
</header>

<main>
  <section class="head" id="head" aria-label="Project profile"></section>

  __SUMMARY_NOTICE__

  <section class="canvas" id="canvas" aria-label="Architecture">
    <div class="toolbar">
      <div class="flows" id="flows"></div>
      <div class="legend" id="legend" aria-label="Legend"></div>
    </div>
    <div class="stage" id="stage"></div>
    <div class="panel" id="panel" aria-live="polite"></div>
  </section>

  <div class="around" id="around"></div>

  <details class="source" id="source"></details>
</main>

<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="sbl-summary">__SBL_SUMMARY_JSON__</script>
<script>
(function () {
  'use strict';
  var S = JSON.parse(document.getElementById('sbl-summary').textContent);
  var A = S.architecture;
  var G = S.layout;

  /* ---------------- helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  /* fixed token lookup; anything else falls back to --line-strong (never raw CSS from the file) */
  var COLOR = { accent: 'var(--accent)', ok: 'var(--ok)', warn: 'var(--warn)', violet: 'var(--violet)', rose: 'var(--rose)', muted: 'var(--muted)', dim: 'var(--dim)' };
  function color(t) { return has(COLOR, t) ? COLOR[t] : 'var(--line-strong)'; }
  var COPY_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>';
  function cmdHTML(c) {
    return '<div class="cmd"><code>' + esc(c.run) + '</code>' + (c.note ? '<small>' + esc(c.note) + '</small>' : '') +
      '<button class="copy" type="button" data-copy="' + esc(c.run) + '" aria-label="Copy command: ' + esc(c.run) + '">' + COPY_ICON + '</button></div>';
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (!has(attrs, k) || attrs[k] == null) continue;
      if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(n);
    return n;
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

  /* ---------------- lookups ---------------- */
  var nodeById = {}, posById = {}, edgeById = {}, geoById = {}, badgeByNode = {};
  if (A && G) {
    A.nodes.forEach(function (n) { nodeById[n.id] = n; });
    G.nodes.forEach(function (n) { posById[n.id] = n; });
    A.edges.forEach(function (e) { edgeById[e.id] = e; });
    G.edges.forEach(function (e) { geoById[e.id] = e; });
    A.highlights.forEach(function (h) { if (!has(badgeByNode, h.node)) badgeByNode[h.node] = h.badge; });
  }
  function kindOf(n) { return has(A.kinds, n.kind) ? A.kinds[n.kind] : { label: n.kind, color: '', dashed: false }; }
  function ins(id) { return A.edges.filter(function (e) { return e.to === id; }); }
  function outs(id) { return A.edges.filter(function (e) { return e.from === id; }); }

  /* ---------------- head ---------------- */
  function renderHead() {
    $('#head').innerHTML =
      '<div><h1>' + esc(S.project) + (S.packageName && S.packageName !== S.project ? ' <span class="pill" title="from ' + esc(S.manifest) + '">' + esc(S.packageName) + '</span>' : '') + '</h1>' +
      (S.pitchHtml ? '<p class="pitch">' + S.pitchHtml + '</p>' : '') + '</div>' +
      '<dl class="facts">' + S.facts.map(function (f) { return '<div><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>'; }).join('') + '</dl>';
  }

  /* ---------------- canvas ---------------- */
  var svg = null;
  var state = { sel: null, flow: null, stack: null };

  function renderToolbar() {
    $('#flows').innerHTML = A.flows.length ? '<span class="fl">Flows</span>' + A.flows.map(function (f) {
      return '<button class="chip" type="button" data-flow="' + esc(f.id) + '" aria-pressed="false" style="--c:' + color(f.color) + '"><span class="dot"></span>' + esc(f.label) + '</button>';
    }).join('') : '';
    $('#legend').innerHTML = Object.keys(A.kinds).map(function (k) {
      var v = A.kinds[k];
      return '<span style="--c:' + color(v.color) + '"><i class="' + (v.dashed ? 'dashed' : '') + '"></i>' + esc(v.label) + '</span>';
    }).join('') + (A.highlights.length ? '<span style="--c:var(--accent)"><i class="round"></i>Highlight</span>' : '');
  }

  function renderSVG() {
    var s = el('svg', { viewBox: '0 0 ' + G.width + ' ' + G.height, role: 'group', 'aria-label': 'Architecture of ' + S.project + ': ' + A.nodes.length + ' components, ' + A.edges.length + ' connections' });
    var defs = el('defs', {}, s);
    var m = el('marker', { id: 'sbl-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 11, markerHeight: 11, markerUnits: 'userSpaceOnUse', orient: 'auto' }, defs);
    el('path', { d: 'M0.5,1 L9,5 L0.5,9 z', fill: 'context-stroke', stroke: 'none' }, m);
    var pat = el('pattern', { id: 'sbl-dots', width: 22, height: 22, patternUnits: 'userSpaceOnUse' }, defs);
    el('circle', { cx: 1, cy: 1, r: 1, style: 'fill:var(--line)' }, pat);
    el('rect', { x: 0, y: 0, width: G.width, height: G.height, class: 'grid' }, s);

    G.zones.forEach(function (z) {
      var g = el('g', { class: 'zone' }, s);
      el('rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: 10 }, g);
      el('text', { x: z.x + 12, y: z.y + 16, text: z.label }, g);
    });

    var eg = el('g', { class: 'edges' }, s);
    G.edges.forEach(function (ge) {
      var e = edgeById[ge.id];
      var g = el('g', { class: 'edge', 'data-id': ge.id, 'data-a': ge.from, 'data-b': ge.to }, eg);
      el('path', { d: ge.d }, g);
      el('text', { class: 'lbl', x: ge.label.x, y: ge.label.y, 'text-anchor': ge.label.anchor, text: e ? e.label : '' }, g);
      var sb = el('g', { class: 'step' }, g);
      el('circle', { cx: ge.badge.x, cy: ge.badge.y, r: 9.5 }, sb);
      el('text', { x: ge.badge.x, y: ge.badge.y + 4, text: '' }, sb);
    });

    var ng = el('g', { class: 'nodes' }, s);
    /* layout nodes come in reading order (row, then column) = tab order */
    G.nodes.forEach(function (p) {
      var n = nodeById[p.id]; if (!n) return;
      var k = kindOf(n);
      var g = el('g', { class: 'node' + (k.dashed ? ' ext' : ''), 'data-id': n.id, tabindex: 0, role: 'button', 'aria-label': n.label + ' (' + k.label + ')', style: '--kc:' + color(k.color) }, ng);
      el('rect', { class: 'box', x: p.x, y: p.y, width: p.w, height: p.h, rx: 8 }, g);
      el('text', { class: 'tt', x: p.x + 12, y: p.y + (n.sub ? 23 : 33), text: n.label, style: n.label.length > 14 ? 'font-size:13px' : null }, g);
      if (n.sub) el('text', { class: 'ts', x: p.x + 12, y: p.y + 41, text: n.sub, style: n.sub.length > 18 ? 'font-size:10.5px' : null }, g);
      if (has(badgeByNode, n.id)) {
        var b = el('g', { class: 'badge' }, g);
        el('circle', { cx: p.x + p.w - 6, cy: p.y, r: 9.5 }, b);
        el('text', { x: p.x + p.w - 6, y: p.y + 4, text: String(badgeByNode[n.id]) }, b);
      }
    });
    return s;
  }

  /* node text never leaves its box */
  function fitText() {
    $$('.node', svg).forEach(function (g) {
      var p = posById[g.getAttribute('data-id')]; var max = p.w - 22;
      $$('.tt, .ts', g).forEach(function (t) {
        var full = t.getAttribute('data-full');
        if (full === null) { full = t.textContent; t.setAttribute('data-full', full); }
        var s = full, guard = 0; t.textContent = s;
        try {
          while (t.getComputedTextLength() > max && s.length > 3 && guard++ < 40) { s = s.slice(0, -2).replace(/\s+$/, '') + '…'; t.textContent = s; }
        } catch (e) { /* not rendered yet */ }
      });
    });
  }

  /* Label re-scoring with measured widths; mirrors slotBox/badgeFor/scoreBox in summary-layout.ts */
  function slotBox(c, tw) {
    var px = c.px, py = c.py;
    if (c.side === 'above') return { x: px, y: py - 7, anchor: 'middle', box: { x0: px - tw / 2, y0: py - 20, x1: px + tw / 2, y1: py - 3 } };
    if (c.side === 'below') return { x: px, y: py + 17, anchor: 'middle', box: { x0: px - tw / 2, y0: py + 4, x1: px + tw / 2, y1: py + 21 } };
    if (c.side === 'right') return { x: px + 8, y: py + 4.5, anchor: 'start', box: { x0: px + 4, y0: py - 10.5, x1: px + 8 + tw, y1: py + 10.5 } };
    return { x: px - 8, y: py + 4.5, anchor: 'end', box: { x0: px - 8 - tw, y0: py - 10.5, x1: px - 4, y1: py + 10.5 } };
  }
  function badgeFor(sg, c, tw) {
    var lo = sg.horizontal ? Math.min(sg.x1, sg.x2) : Math.min(sg.y1, sg.y2);
    var hi = sg.horizontal ? Math.max(sg.x1, sg.x2) : Math.max(sg.y1, sg.y2);
    if (sg.horizontal) {
      var bx = c.px - tw / 2 - 14;
      if (bx < lo + 12) bx = c.px + tw / 2 + 14;
      if (bx > hi - 12) bx = c.px;
      return { x: bx, y: c.py };
    }
    var by = c.py - 18;
    if (by < lo + 12) by = c.py + 18;
    if (by > hi - 12) by = c.py;
    return { x: c.px, y: by };
  }
  function hit(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
  function segHit(sg, b) {
    return sg.horizontal
      ? sg.y1 >= b.y0 && sg.y1 <= b.y1 && Math.min(sg.x1, sg.x2) < b.x1 && Math.max(sg.x1, sg.x2) > b.x0
      : sg.x1 >= b.x0 && sg.x1 <= b.x1 && Math.min(sg.y1, sg.y2) < b.y1 && Math.max(sg.y1, sg.y2) > b.y0;
  }
  function segmentsOf(points) {
    var out = [];
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1];
      out.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], horizontal: a[1] === b[1], length: Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) });
    }
    return out;
  }
  function rescoreLabels() {
    var nodeBoxes = G.nodes.map(function (n) { return { x0: n.x - 1, y0: n.y - 1, x1: n.x + n.w + 1, y1: n.y + n.h + 1 }; });
    var segs = {}; G.edges.forEach(function (e) { segs[e.id] = segmentsOf(e.points); });
    var placed = [];
    var order = G.edges.slice().sort(function (a, b) { return b.segment.length - a.segment.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    order.forEach(function (e) {
      var g = $('.edge[data-id="' + CSS.escape(e.id) + '"]', svg); if (!g) return;
      var txt = $('.lbl', g), tw = 0;
      try { tw = txt.getComputedTextLength(); } catch (err) { tw = 0; }
      tw = tw ? tw + 2 : e.labelWidth;
      var best = 0, bestScore = Infinity;
      for (var i = 0; i < e.candidates.length; i++) {
        var box = slotBox(e.candidates[i], tw).box, s = 0;
        if (box.x0 < 4 || box.x1 > G.width - 4 || box.y0 < 2 || box.y1 > G.height - 2) s += 5;
        nodeBoxes.forEach(function (r) { if (hit(box, r)) s += 3; });
        placed.forEach(function (r) { if (hit(box, r)) s += 2; });
        G.edges.forEach(function (o) { if (o.id !== e.id) segs[o.id].forEach(function (sg) { if (segHit(sg, box)) s += 1; }); });
        if (s < bestScore) { bestScore = s; best = i; if (s === 0) break; }
      }
      var chosen = slotBox(e.candidates[best], tw);
      placed.push(chosen.box);
      txt.setAttribute('x', chosen.x); txt.setAttribute('y', chosen.y); txt.setAttribute('text-anchor', chosen.anchor);
      var bp = badgeFor(e.segment, e.candidates[best], tw);
      var c = $('.step circle', g), bt = $('.step text', g);
      c.setAttribute('cx', bp.x); c.setAttribute('cy', bp.y); bt.setAttribute('x', bp.x); bt.setAttribute('y', bp.y + 4);
    });
  }

  /* ---------------- panel ---------------- */
  function hintHTML() {
    return '<div class="hint"><span>Select a component for its purpose, files, connections and commands. Pick a flow to follow it step by step.</span>' +
      '<span><kbd>Tab</kbd> <kbd>Enter</kbd> navigate · <kbd>Esc</kbd> back</span></div>';
  }
  function phaseText(t) { return t.phase ? t.status + ' · phase/' + t.phase : t.status; }
  function taskHTML(t) {
    var title = t.node && has(nodeById, t.node)
      ? '<button class="tt" type="button" data-sel="' + esc(t.node) + '">' + esc(t.title) + '</button>'
      : '<span class="tt">' + esc(t.title) + '</span>';
    return '<li><span class="tid">' + esc(t.id) + '</span>' + title + '<span class="ph' + (t.phase === 'verify' ? ' verify' : '') + '">' + esc(phaseText(t)) + '</span></li>';
  }
  function closeBtn() { return '<button class="pclose" type="button" data-close>Close · Esc</button>'; }
  function nodePanel(n) {
    var k = kindOf(n);
    var tasks = S.tasks.filter(function (t) { return t.node === n.id; });
    var conn = ins(n.id).map(function (e) {
      return '<li><span class="arr">←</span><button type="button" data-sel="' + esc(e.from) + '">' + esc(nodeById[e.from].label) + '</button><span class="el">' + esc(e.label) + '</span></li>';
    }).concat(outs(n.id).map(function (e) {
      return '<li><span class="arr">→</span><button type="button" data-sel="' + esc(e.to) + '">' + esc(nodeById[e.to].label) + '</button><span class="el">' + esc(e.label) + '</span></li>';
    })).join('');
    var badge = has(badgeByNode, n.id) ? '<span class="num" title="Highlight ' + badgeByNode[n.id] + '">' + badgeByNode[n.id] + '</span>' : '';
    return '<div class="ptitle"><h3><i class="kd" style="--kc:' + color(k.color) + '"></i>' + esc(n.label) + '</h3>' +
      (n.sub ? '<span class="sub">' + esc(n.sub) + '</span>' : '') + badge + closeBtn() + '</div>' +
      '<div class="pgrid"><div>' +
      (n.purpose ? '<p>' + esc(n.purpose) + '</p>' : '') +
      (n.why ? '<p class="why"><b>Why it is built this way:</b> ' + esc(n.why) + '</p>' : '') +
      (n.files.length ? '<div class="pblock"><h4>Files</h4><div class="chips">' + n.files.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join('') + '</div></div>' : '') +
      '</div><div>' +
      '<h4>Connections</h4><ul class="conn">' + (conn || '<li class="el">none</li>') + '</ul>' +
      (tasks.length ? '<div class="pblock"><h4>Open work</h4><ul class="tasks">' + tasks.map(taskHTML).join('') + '</ul></div>' : '') +
      (n.commands.length ? '<div class="pblock"><h4>Commands</h4><div class="cmds">' + n.commands.map(cmdHTML).join('') + '</div></div>' : '') +
      '</div></div>';
  }
  function flowPanel(f) {
    var steps = f.steps.map(function (id, i) {
      var e = edgeById[id]; if (!e) return '';
      return '<li><span class="n">' + (i + 1) + '</span><span class="ft"><button type="button" data-sel="' + esc(e.from) + '">' + esc(nodeById[e.from].label) + '</button> → ' +
        '<button type="button" data-sel="' + esc(e.to) + '">' + esc(nodeById[e.to].label) + '</button> <span class="el">' + esc(e.label) + '</span></span>' +
        '<span class="fd">' + esc(e.text || '') + '</span></li>';
    }).join('');
    return '<div class="ptitle"><h3><i class="kd" style="--kc:' + color(f.color) + ';background:' + color(f.color) + '"></i>' + esc(f.label) + '</h3>' +
      '<span class="sub">' + f.steps.length + (f.steps.length === 1 ? ' step' : ' steps') + '</span>' + closeBtn() + '</div>' +
      ((f.text || f.command) ? '<div class="pflow">' + (f.text ? '<p>' + esc(f.text) + '</p>' : '') + (f.command ? cmdHTML({ run: f.command, note: 'command' }) : '') + '</div>' : '') +
      '<ol class="steps" style="--fc:' + color(f.color) + '">' + steps + '</ol>';
  }
  function setPanel(html) { $('#panel').innerHTML = html; }

  /* ---------------- interaction (V5) ---------------- */
  function clearSel() {
    state.sel = null;
    $$('.node.sel, .node.kin', svg).forEach(function (n) { n.classList.remove('sel', 'kin'); });
    $$('.edge.near', svg).forEach(function (e) { e.classList.remove('near'); });
  }
  function clearFlow() {
    state.flow = null;
    svg.classList.remove('flowing');
    $$('.edge.hot, .node.hot', svg).forEach(function (e) { e.classList.remove('hot'); e.style.removeProperty('--fc'); });
    $$('#flows .chip').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  }
  function clearStack() {
    state.stack = null;
    svg.classList.remove('filtering');
    $$('.node.used', svg).forEach(function (n) { n.classList.remove('used'); });
    $$('.stack button.item').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  }
  function clearAll() { clearSel(); clearFlow(); clearStack(); setPanel(hintHTML()); }
  function nodeEl(id) { return $('.node[data-id="' + CSS.escape(id) + '"]', svg); }
  function near(id, on) {
    $$('.edge', svg).forEach(function (e) {
      if (e.getAttribute('data-a') === id || e.getAttribute('data-b') === id) e.classList.toggle('near', on);
    });
  }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function select(id, opts) {
    opts = opts || {};
    var n = nodeById[id]; if (!n) return;
    clearFlow(); clearStack(); clearSel();
    state.sel = id;
    var g = nodeEl(id);
    g.classList.add('sel'); near(id, true);
    ins(id).map(function (e) { return e.from; }).concat(outs(id).map(function (e) { return e.to; })).forEach(function (o) {
      var k = nodeEl(o); if (k) k.classList.add('kin');
    });
    setPanel(nodePanel(n));
    if (opts.focus) g.focus({ preventScroll: true });
    if (opts.scroll) $('#canvas').scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  function setFlow(id) {
    if (state.flow === id) { clearAll(); return; }
    var f = A.flows.filter(function (x) { return x.id === id; })[0]; if (!f) return;
    clearSel(); clearStack(); clearFlow();
    state.flow = id;
    svg.classList.add('flowing');
    var col = color(f.color);
    f.steps.forEach(function (eid, i) {
      var eg = $('.edge[data-id="' + CSS.escape(eid) + '"]', svg); if (!eg) return;
      eg.classList.add('hot'); eg.style.setProperty('--fc', col);
      $('.step text', eg).textContent = String(i + 1);
      var a = nodeEl(eg.getAttribute('data-a')), b = nodeEl(eg.getAttribute('data-b'));
      if (a) a.classList.add('hot');
      if (b) b.classList.add('hot');
    });
    $$('#flows .chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-flow') === id)); });
    setPanel(flowPanel(f));
  }
  function setStack(idx) {
    if (state.stack === idx) { clearAll(); return; }
    var s = S.stack[idx]; if (!s || !svg) return;
    clearSel(); clearFlow(); clearStack();
    state.stack = idx;
    svg.classList.add('filtering');
    s.nodes.forEach(function (id) { var n = nodeEl(id); if (n) n.classList.add('used'); });
    $$('.stack button.item').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-stack') === idx)); });
    setPanel('<div class="ptitle"><h3>' + esc(s.name) + ' <span class="sub">' + esc(s.version) + '</span></h3>' + closeBtn() + '</div>' +
      '<div class="pgrid"><div><p>' + esc(s.role) + '</p></div><div><h4>Used in</h4><ul class="conn">' +
      s.nodes.map(function (id) { return has(nodeById, id) ? '<li><span class="arr">·</span><button type="button" data-sel="' + esc(id) + '">' + esc(nodeById[id].label) + '</button></li>' : ''; }).join('') +
      '</ul></div></div>');
  }

  /* ---------------- profile row + data source ---------------- */
  function renderAround() {
    var html = '';
    if (A && A.highlights.length) {
      html += '<section class="sec"><h2>Highlights <small>numbers in the diagram</small></h2><ol class="specs">' +
        A.highlights.map(function (h) {
          return '<li><span class="num">' + h.badge + '</span><button class="st" type="button" data-sel="' + esc(h.node) + '" data-scroll>' + esc(h.title) + '</button><span class="sd">' + esc(h.text) + '</span></li>';
        }).join('') + '</ol></section>';
    }
    html += '<section class="sec"><h2>Open work <small>' + S.tasks.length + (S.tasks.length === 1 ? ' task' : ' tasks') + '</small></h2>' +
      (S.tasks.length ? '<ul class="tasks">' + S.tasks.map(taskHTML).join('') + '</ul>' : '<p class="empty">No open tasks.</p>') +
      '<h2 class="later">Commands</h2>' +
      (S.commands.length ? S.commands.map(function (g) {
        return '<div class="cgroup"><h3>' + esc(g.group) + '</h3><div class="cmds">' + g.entries.map(cmdHTML).join('') + '</div></div>';
      }).join('') : '<p class="empty">No commands found.</p>') + '</section>';
    var groups = [], byGroup = {};
    S.stack.forEach(function (s, i) {
      if (!has(byGroup, s.group)) { byGroup[s.group] = []; groups.push(s.group); }
      byGroup[s.group].push({ s: s, i: i });
    });
    var linkable = !!svg;
    html += '<section class="sec"><h2>Tech stack <small>' + S.stack.length + (S.stack.length === 1 ? ' entry' : ' entries') + '</small></h2>' +
      (S.stack.length ? '<div class="stack">' + groups.map(function (g) {
        return '<div class="sg">' + esc(g) + '</div>' + byGroup[g].map(function (x) {
          var inner = '<b>' + esc(x.s.name) + '</b><span class="v">' + esc(x.s.version) + '</span>' + (x.s.role ? '<span class="r">' + esc(x.s.role) + '</span>' : '');
          return linkable && x.s.nodes.length
            ? '<button class="item" type="button" data-stack="' + x.i + '" aria-pressed="false">' + inner + '</button>'
            : '<div class="item">' + inner + '</div>';
        }).join('');
      }).join('') + '</div>' : '<p class="empty">No dependencies found.</p>') +
      (linkable && S.stack.some(function (s) { return s.nodes.length; }) ? '<p class="stack-hint">Select an entry to see which components use it.</p>' : '') +
      '</section>';
    var around = $('#around');
    around.innerHTML = html;
    if (!svg) around.classList.add('reduced');
  }
  function renderSource() {
    function list(items, cls) { return '<ul' + (cls ? ' class="' + cls + '"' : '') + '>' + items.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>'; }
    $('#source').innerHTML = '<summary>Data source <span>automatic and curated</span></summary><div class="src">' +
      '<div><h3>Automatic</h3>' + list(S.source.auto) + '</div>' +
      '<div><h3>Curated</h3>' + list(S.source.curated) + '<p class="empty">File: <code>' + esc(S.source.file) + '</code></p></div>' +
      '<div><h3>Warnings</h3>' + (S.source.warnings.length ? list(S.source.warnings, 'warn') : '<p class="empty">None.</p>') + '</div>' +
      '</div>';
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var copy = t.closest('.copy'); if (copy) { copyText(copy.getAttribute('data-copy'), copy); return; }
    if (!svg) return;
    var sel = t.closest('[data-sel]'); if (sel) { select(sel.getAttribute('data-sel'), { scroll: sel.hasAttribute('data-scroll') || !sel.closest('#panel') }); return; }
    var fl = t.closest('[data-flow]'); if (fl) { setFlow(fl.getAttribute('data-flow')); return; }
    var st = t.closest('[data-stack]'); if (st) { setStack(+st.getAttribute('data-stack')); return; }
    if (t.closest('[data-close]')) { clearAll(); return; }
    var node = t.closest('.node'); if (node) { if (state.sel === node.getAttribute('data-id')) clearAll(); else select(node.getAttribute('data-id')); }
  });
  document.addEventListener('keydown', function (e) {
    if (!svg) return;
    var active = document.activeElement;
    if (e.key === 'Escape') {
      if (state.sel || state.flow || state.stack !== null) clearAll();
      if (active && active.classList && active.classList.contains('node')) active.blur();
      return;
    }
    var node = e.target.closest ? e.target.closest('.node') : null;
    if (node && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (state.sel === node.getAttribute('data-id')) clearAll(); else select(node.getAttribute('data-id'), { focus: true });
    }
  });
  function hover(on) {
    return function (e) {
      var n = e.target.closest ? e.target.closest('.node') : null;
      if (n && !state.flow && state.sel !== n.getAttribute('data-id')) near(n.getAttribute('data-id'), on);
    };
  }
  var stage = $('#stage');
  stage.addEventListener('mouseover', hover(true));
  stage.addEventListener('mouseout', hover(false));
  stage.addEventListener('focusin', hover(true));
  stage.addEventListener('focusout', hover(false));

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
  if (A && G) {
    renderToolbar();
    svg = renderSVG();
    stage.appendChild(svg);
    fitText();
    rescoreLabels();
    setPanel(hintHTML());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitText(); rescoreLabels(); });
  } else {
    $('#canvas').hidden = true;
  }
  renderAround();
  renderSource();
})();
</script>
<script>
(function () {
  if (!window.EventSource || (location.protocol !== 'http:' && location.protocol !== 'https:')) return;
  var es = new EventSource('../api/events');
  es.addEventListener('reload', function () { location.reload(); });
  es.addEventListener('error', function () {});
})();
</script>
</body>
</html>
```

- [ ] **Step 7: Implement the renderer.** Create `src/dashboard/summary-render.ts`:

```ts
// src/dashboard/summary-render.ts
// Project summary page (spec 2026-10-09, R2, D5-D6, E1-E4, V1-V4): facts + curated
// architecture + layout -> one static HTML file next to the dashboard file.
import { atomicWrite } from '../lib/atomic.js';
import type { Phase } from '../lib/phase.js';
import type { DashboardData } from './data.js';
import { isDone } from './metrics.js';
import { esc, jsonIsland, readTemplate } from './render.js';
import { collectSummaryFacts, type FactsDeps, type SummaryFacts } from './summary-facts.js';
import { layoutArchitecture, type LayoutResult } from './summary-layout.js';
import {
  ARCHITECTURE_PATH,
  loadArchitecture,
  type Architecture,
  type ArchitectureLoadResult,
  type ArchStackEntry,
} from './summary-schema.js';

export const SUMMARY_DOCS_URL = 'https://adam-s-k-i.github.io/super-backlog/guide/project-summary';
/** E2: the notice lists at most this many problems. */
export const MAX_NOTICE_PROBLEMS = 20;

export interface SummaryModel {
  facts: SummaryFacts;
  load: ArchitectureLoadResult;
  /** null unless the architecture file is valid (or when rendering fell back, E3) */
  layout: LayoutResult | null;
  /** E3: message of the error that stopped the full render */
  renderError: string | null;
}

export interface SummaryDeps extends FactsDeps {
  loadArchitecture?: typeof loadArchitecture;
  layoutArchitecture?: typeof layoutArchitecture;
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
  /** node id from `tasks:` in architecture.yml, or null when unmapped */
  node: string | null;
}

export interface SummaryStackItem {
  name: string;
  group: string;
  version: string;
  role: string;
  nodes: string[];
}

/** The JSON island the client renders from (`#sbl-summary`). */
export interface SummaryView {
  project: string;
  /** escaped pitch; `**bold**` already turned into <b> (the only markup allowed) */
  pitchHtml: string;
  /** package name from the manifest, shown as the pill next to the title */
  packageName: string | null;
  manifest: string | null;
  facts: SummaryFact[];
  architecture: Pick<Architecture, 'kinds' | 'nodes' | 'edges' | 'flows' | 'highlights'> | null;
  layout: LayoutResult | null;
  tasks: SummaryTask[];
  commands: { group: string; entries: { run: string; note?: string }[] }[];
  stack: SummaryStackItem[];
  source: { auto: string[]; curated: string[]; warnings: string[]; file: string };
}

/** `<dashboard file without .html>.summary.html` (R2). */
export function summaryFileFor(dashboardFile: string): string {
  return `${dashboardFile.replace(/\.html$/i, '')}.summary.html`;
}

/** Escapes the pitch, then turns `**text**` into <b>text</b>. Nothing else becomes markup. */
export function formatPitch(pitch: string): string {
  return esc(pitch).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
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

/** Collects facts, loads and lays out the architecture file. Throws only on unexpected errors. */
export function buildSummaryModel(cwd: string, data: DashboardData, deps: SummaryDeps = {}): SummaryModel {
  const facts = collectSummaryFacts(cwd, deps);
  const load = (deps.loadArchitecture ?? loadArchitecture)(cwd, { taskIds: data.tasks.map((t) => t.id) });
  const layout = load.status === 'valid' ? (deps.layoutArchitecture ?? layoutArchitecture)(load.architecture) : null;
  return { facts, load, layout, renderError: null };
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

function stackItems(arch: Architecture | null, facts: SummaryFacts): SummaryStackItem[] {
  if (arch && arch.stack.length > 0) {
    return arch.stack.map((s: ArchStackEntry) => ({
      name: s.name,
      group: s.group,
      version: s.version ?? facts.versions[s.package ?? s.name] ?? '',
      role: s.role ?? '',
      nodes: s.nodes,
    }));
  }
  return facts.packages.map((p) => ({ name: p.name, group: p.group, version: p.version, role: '', nodes: [] }));
}

function autoSource(data: DashboardData, facts: SummaryFacts): string[] {
  const out: string[] = [];
  out.push(
    facts.manifest
      ? `Name, version and license from ${facts.manifest}${facts.manifests.length > 1 ? ` (also read: ${facts.manifests.filter((m) => m !== facts.manifest).join(', ')})` : ''}`
      : 'No manifest found (package.json, composer.json or a WordPress header)',
  );
  const exts = facts.extensions.length > 0 ? ` (${facts.extensions.join(' ')})` : '';
  out.push(
    `${facts.sourceFiles} source files${exts} from ${facts.fileSource === 'git' ? 'git ls-files' : 'a directory walk'}` +
      (facts.locApprox ? '; line count stopped at the 10 MB read budget' : ''),
  );
  out.push(`${facts.dependencies} runtime and ${facts.devDependencies} development dependencies; versions from lockfiles where present`);
  out.push(facts.releasesNote ? `Releases: ${facts.releasesNote}` : `${facts.releases} releases from git version tags`);
  out.push(`${facts.workflows} GitHub Actions ${plural(facts.workflows, 'workflow', 'workflows')}`);
  out.push(data.source === 'backlog-json' ? 'Open work from backlog task list' : 'Open work: no backlog data');
  return out;
}

function curatedSource(load: ArchitectureLoadResult): string[] {
  if (load.status === 'missing') return ['No curated file yet; this page shows the automatic facts only.'];
  if (load.status === 'invalid') {
    const n = load.problems.filter((p) => p.level === 'error').length;
    return [`${ARCHITECTURE_PATH} has ${n} ${plural(n, 'problem', 'problems')}; see the notice above.`];
  }
  const a = load.architecture;
  return [
    `Pitch, ${a.nodes.length} components, ${a.edges.length} connections, ${a.flows.length} flows`,
    `${a.highlights.length} highlights, ${a.stack.length} stack entries, ${Object.keys(a.commands).length} command groups`,
    `${Object.keys(a.tasks).length} task-to-component mappings (status comes from the backlog CLI)`,
  ];
}

/** Builds the client view model; every string stays raw here and is escaped by the client (or jsonIsland). */
export function buildSummaryView(data: DashboardData, model: SummaryModel): SummaryView {
  const { facts, load, layout } = model;
  const arch = load.status === 'valid' && layout ? load.architecture : null;
  const open = data.tasks.filter((t) => !isDone(t.status));
  const tasks: SummaryTask[] = open.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    phase: t.phase,
    node: arch?.tasks[t.id.toUpperCase()] ?? null,
  }));
  const commands =
    arch && Object.keys(arch.commands).length > 0
      ? Object.entries(arch.commands).map(([group, entries]) => ({ group, entries }))
      : facts.commands;
  const warnings = [
    ...(load.status === 'valid' ? load.problems.filter((p) => p.level === 'warning').map((p) => `${p.path}: ${p.message}`) : []),
    ...(layout ? layout.warnings.map((w) => `layout ${w.code} ${w.edge}: ${w.message}`) : []),
    ...facts.warnings,
  ];
  return {
    project: data.project.name,
    pitchHtml: arch ? formatPitch(arch.pitch) : esc(data.project.description),
    packageName: facts.name,
    manifest: facts.manifest,
    facts: headerFacts(facts, open.length),
    architecture: arch
      ? { kinds: arch.kinds, nodes: arch.nodes, edges: arch.edges, flows: arch.flows, highlights: arch.highlights }
      : null,
    layout: arch ? layout : null,
    tasks,
    commands,
    stack: stackItems(arch, facts),
    source: { auto: autoSource(data, facts), curated: curatedSource(load), warnings, file: ARCHITECTURE_PATH },
  };
}

/** Server-rendered notice between header and canvas (D6, E2, E3); empty for a valid file. */
export function noticeHtml(model: SummaryModel): string {
  if (model.renderError !== null) {
    return (
      '<div class="notice notice-error" role="alert"><p>Summary could not be rendered ' +
      `(<code>${esc(model.renderError)}</code>). Showing the automatic facts only.</p></div>`
    );
  }
  const { load } = model;
  if (load.status === 'missing') {
    return (
      '<div class="notice"><p>No architecture file yet. Run the <code>architecture-summary</code> skill in your agent ' +
      `or create <code>${ARCHITECTURE_PATH}</code> (schema: <a href="${SUMMARY_DOCS_URL}">docs</a>).</p></div>`
    );
  }
  if (load.status === 'invalid') {
    const errors = load.problems.filter((p) => p.level === 'error');
    const shown = errors.slice(0, MAX_NOTICE_PROBLEMS);
    const more = errors.length - shown.length;
    return (
      '<div class="notice notice-error" role="alert">' +
      `<p><code>${ARCHITECTURE_PATH}</code> has ${errors.length} ${plural(errors.length, 'problem', 'problems')}; ` +
      `showing the automatic facts only (schema: <a href="${SUMMARY_DOCS_URL}">docs</a>).</p>` +
      `<ul>${shown.map((p) => `<li><code>${esc(p.path)}</code>: ${esc(p.message)}</li>`).join('')}</ul>` +
      (more > 0 ? `<p>… and ${more} more</p>` : '') +
      '</div>'
    );
  }
  return '';
}

/** Fills the summary template (V1). Pure apart from reading the two template files. */
export function renderSummary(data: DashboardData, model: SummaryModel): string {
  const view = buildSummaryView(data, model);
  return readTemplate('summary.html')
    .replaceAll('__SBL_TOKENS_CSS__', () => readTemplate('sbl-tokens.css').replace(/\r\n/g, '\n').trimEnd())
    .replaceAll('__PROJECT_NAME__', () => esc(data.project.name))
    .replaceAll('__SUMMARY_NOTICE__', () => noticeHtml(model))
    .replaceAll('__SBL_SUMMARY_JSON__', () => jsonIsland(view));
}

function minimalPage(data: DashboardData, message: string): string {
  return (
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    `<title>${esc(data.project.name)} &middot; Project Summary</title></head>` +
    `<body><p>Summary could not be rendered (<code>${esc(message)}</code>).</p><p><a href="../">Dashboard</a></p></body></html>\n`
  );
}

/**
 * Writes the summary page next to `dashboardFile` (R2). Never throws: a broken
 * architecture file or a render error degrades to the reduced view (E3), and a
 * failed write leaves the dashboard untouched.
 */
export function writeSummaryPage(cwd: string, data: DashboardData, dashboardFile: string, deps: SummaryDeps = {}): string {
  const file = summaryFileFor(dashboardFile);
  let html: string;
  try {
    html = renderSummary(data, buildSummaryModel(cwd, data, deps));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      let facts: SummaryFacts;
      try {
        facts = collectSummaryFacts(cwd, deps);
      } catch {
        facts = emptyFacts();
      }
      html = renderSummary(data, { facts, load: { status: 'missing', path: ARCHITECTURE_PATH }, layout: null, renderError: message });
    } catch {
      html = minimalPage(data, message);
    }
  }
  try {
    atomicWrite(file, html);
  } catch {
    /* the dashboard never depends on the summary page */
  }
  return file;
}
```

- [ ] **Step 8: Run the new tests and watch them pass**

Run: `npx vitest run test/unit/summary-render.test.ts`
Expected: PASS, 32 tests. The first run writes `test/unit/__snapshots__/summary-render.test.ts.snap` with two snapshots (full view, reduced view). Open it and check two things: the full view lists the fixture's nodes and flows, and the reduced view has no `layout`.

- [ ] **Step 9: Update the dashboard snapshot**

Run: `npx vitest run -u test/unit/dashboard-render.test.ts`
Then: `git diff --stat test/unit/__snapshots__/dashboard-render.test.ts.snap`
Expected: 18 insertions, exactly the nine new tokens in each theme block (`--surface-3`, `--violet*`, `--rose*`, `--on-accent`, `--on-color`). If the diff shows anything else (for example line-ending churn), stop and investigate.

- [ ] **Step 10: Run the dashboard tests and build**

Run: `npx vitest run test/unit/dashboard-render.test.ts test/unit/summary-render.test.ts`
Expected: PASS (92 + 32).
Run: `npm run build`
Expected: exit 0, and `dist/templates/sbl-tokens.css` and `dist/templates/summary.html` exist.

- [ ] **Step 11: Manual check (spec "Manual" list, part 1).** Create a preview script in `$env:TEMP` (not in the repo) named `sbl-summary-preview.mjs`:

```js
// Preview the summary page with the super-backlog fixture. Run from the repo root after `npm run build`.
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mod = (p) => import(pathToFileURL(join(process.cwd(), p)).href);
const { collectDashboardData } = await mod('dist/dashboard/data.js');
const { writeSummaryPage } = await mod('dist/dashboard/summary-render.js');
const { checkArchitectureText } = await mod('dist/dashboard/summary-schema.js');

const text = readFileSync('test/fixtures/summary/architecture.super-backlog.yml', 'utf8');
const data = collectDashboardData(process.cwd(), { kitVersion: 'preview' });
const ids = data.tasks.map((t) => t.id);
console.log(writeSummaryPage(process.cwd(), data, join(tmpdir(), 'sbl-preview.html'), {
  loadArchitecture: () => checkArchitectureText(text, 'architecture.yml', ids),
}));
```

Run from the repo root: `node "$env:TEMP\sbl-summary-preview.mjs"`. It prints `…\sbl-preview.summary.html`; open that file in a browser and check:
- the pitch shows bold text;
- the diagram has no crossing lines or overlapping labels;
- keyboard only: Tab reaches the nodes in reading order; Enter fills the panel; Esc clears it and blurs the node; flow chips and stack buttons toggle with `aria-pressed`;
- the theme toggle switches dark/light;
- with DevTools → Rendering → "prefers-reduced-motion: reduce", the dashed animation stops;
- at a 380 px width, the canvas scrolls horizontally and the profile collapses to one column.

Delete the two temp files afterwards.

- [ ] **Step 12: Commit**

```powershell
git add src/templates/sbl-tokens.css src/templates/summary.html src/templates/dashboard.html src/dashboard/summary-render.ts src/dashboard/render.ts src/dashboard/metrics.ts test/unit/summary-render.test.ts test/unit/__snapshots__/summary-render.test.ts.snap test/unit/__snapshots__/dashboard-render.test.ts.snap
git commit -m "feat(summary): summary page template, shared tokens and renderer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 13: Hand over to verify**

Run: `node dist/bin.js phase TASK-89 verify`

---

### Task 6: Hub route, page tabs and docs (TASK-90)

**Files:**
- Modify: `src/dashboard/hub.ts`, `src/commands/dashboard.ts`, `src/templates/dashboard.html`
- Create: `docs/guide/project-summary.md`
- Modify: `docs/.vitepress/config.mts`, `docs/guide/quickstart.md`, `README.md`
- Test: `test/integration/serve.test.ts`, `test/unit/hub.test.ts`, `test/unit/dashboard-render.test.ts`; `test/unit/__snapshots__/dashboard-render.test.ts.snap` (updated with `-u`)

**Interfaces:**
- Consumes: `summaryFileFor`, `writeSummaryPage` from Task 5.
- Produces:
  - routes `GET /p/<slug>/summary/` and `/p/<slug>/summary/index.html` serve the summary file with 200 and `no-store`;
  - `/p/<slug>/summary` returns 302 to `/p/<slug>/summary/`;
  - a missing file returns 404 `summary not generated yet`;
  - `serveFile(file, res, notFound = 'dashboard not generated yet')` (private to `hub.ts`);
  - every regenerate (hub and `regenerateInto`) writes the summary right after the dashboard.

**Decisions:**
- The dashboard's page tabs are `hidden` by default. An inline script unhides them only when the path matches `/p/<slug>/` or `/p/<slug>/index.html`. A static copy of `dashboard.html` (for example on GitHub Pages, out of scope) therefore never shows a dead Summary link.
- Running `-u` on the dashboard snapshot here is a planned deviation from "no snapshot updates". The spec lists "`dashboard.html` snapshot updated for the page tabs" under Testing, so it is expected.
- In this task the guide's "Create the architecture file" section describes manual editing only. Task 7 replaces it with the skill and `sbl doctor` text, so the docs on each branch describe what that branch ships.
- The watcher integration test reuses the existing `watcherIt` guard, so it is skipped on win32 with Node ≥24, like the existing reload tests.

- [ ] **Step 1: Start the phase**

Run: `node dist/bin.js phase TASK-90 impl`

- [ ] **Step 2: Write the failing integration tests.** In `test/integration/serve.test.ts`, add this import after `import { startServeServer } from '../../src/dashboard/server.js';`:

```ts
import { summaryFileFor, writeSummaryPage } from '../../src/dashboard/summary-render.js';
```

Append at the end of the file (after the closing `});` of `describe('startServeServer', …)`):

```ts
const SUMMARY_PATH = `${PROJECT_PATH}summary/`;

const ARCH_YML = [
  'schema: 1',
  'pitch: A **small** demo.',
  'grid: { cols: 2, rows: 2 }',
  'nodes:',
  '  - { id: core, label: Watcher Core, kind: core, cell: [0, 0] }',
  '  - { id: out, label: Report Sink, kind: output, cell: [1, 0] }',
  'edges:',
  '  - { from: core, to: out, label: writes }',
  '',
].join('\n');

/** Dashboard plus summary page, exactly like the hub's own regenerate chain. */
async function writeProjectPages(dir: string): Promise<void> {
  const data = await collectDashboardData(dir, { kitVersion: 'test' });
  const file = join(dir, 'dashboard.html');
  writeFileSync(file, renderDashboard(data));
  writeSummaryPage(dir, data, file);
}

function writeArchitecture(dir: string, text: string): void {
  mkdirSync(join(dir, 'backlog', 'docs'), { recursive: true });
  writeFileSync(join(dir, 'backlog', 'docs', 'architecture.yml'), text);
}

function fetchRaw(port: number, path: string): Promise<{ status: number; location: string; body: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () =>
        resolvePromise({ status: res.statusCode ?? 0, location: String(res.headers.location ?? ''), body }),
      );
    });
    req.on('error', rejectPromise);
    req.end();
  });
}

describe('summary page route', () => {
  it('serves the generated summary page with its marker', async () => {
    const dir = freshProject();
    await writeProjectPages(dir);
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toContain('<meta name="sbl-page" content="summary">');
    expect(res.body).toContain('No architecture file yet');
    const viaIndex = await fetchRaw(handle.port, `${SUMMARY_PATH}index.html`);
    expect(viaIndex.status).toBe(200);
  });

  it('redirects /summary to /summary/', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await fetchRaw(handle.port, `${PROJECT_PATH}summary`);
    expect(res.status).toBe(302);
    expect(res.location).toBe(SUMMARY_PATH);
  });

  it('answers 404 with a plain text body while the summary is not generated', async () => {
    const dir = freshProject();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.status).toBe(404);
    expect(res.body).toBe('summary not generated yet');
  });

  it('shows architecture nodes after architecture.yml is written and pages regenerate', async () => {
    const dir = freshProject();
    await writeProjectPages(dir);
    const regenerate = async (): Promise<void> => {
      await writeProjectPages(dir);
    };
    const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
    handles.push(handle);

    expect((await fetchRaw(handle.port, SUMMARY_PATH)).body).not.toContain('Watcher Core');
    writeArchitecture(dir, ARCH_YML);
    await regenerate();
    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Watcher Core');
  });

  watcherIt('regenerates and broadcasts a reload when architecture.yml changes', async () => {
    const dir = freshProject();
    await writeProjectPages(dir);
    const regenerate = vi.fn(async () => {
      await writeProjectPages(dir);
    });
    const handle = await startServeServer(dir, { port: 0, regenerate, openBrowser: false });
    handles.push(handle);

    const received: string[] = [];
    const req = request({ host: '127.0.0.1', port: handle.port, path: `${PROJECT_PATH}api/events`, method: 'GET' }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (c: string) => received.push(c));
    });
    req.on('error', () => {});
    req.end();
    expect(await until(2000, () => received.join('').includes(':'))).toBe(true);

    writeArchitecture(dir, ARCH_YML);

    expect(await until(3000, () => received.join('').includes('event: reload'))).toBe(true);
    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.body).toContain('Watcher Core');
    req.destroy();
  });

  it('serves an invalid architecture.yml as 200 with a notice', async () => {
    const dir = freshProject();
    writeArchitecture(dir, 'schema: 2\n');
    await writeProjectPages(dir);
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const res = await fetchRaw(handle.port, SUMMARY_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toMatch(/class="notice[^"]*"/);
    expect(res.body).toContain('backlog/docs/architecture.yml');
  });

  it('keeps the dashboard intact when the summary chain fails', async () => {
    const dir = freshProject();
    // a directory where the summary file should go makes the summary write fail
    mkdirSync(summaryFileFor(join(dir, 'dashboard.html')), { recursive: true });
    await expect(writeProjectPages(dir)).resolves.toBeUndefined();
    const handle = await startServeServer(dir, { port: 0, openBrowser: false });
    handles.push(handle);

    const dash = await fetchRaw(handle.port, PROJECT_PATH);
    expect(dash.status).toBe(200);
    expect(dash.body.startsWith('<!doctype html>')).toBe(true);
    expect((await fetchRaw(handle.port, SUMMARY_PATH)).status).toBe(404);
  });
});
```

In `test/unit/hub.test.ts`, insert this test after the test `'registers a second project via POST and serves GET /p/slug-b/'`, before `'does not send project A reload events to project B SSE clients'`:

```ts
  it('generates the summary page on POST register and serves it at /p/<slug>/summary/', async () => {
    const { cwd } = fixture('sbl-hub-sum-', 'sum-demo');
    dirs.push(cwd);
    const hub = await startHubServer({ port: 0, token: 't' });
    handles.push(hub);
    const res = await req(hub.port, '/api/hub/register', 'POST', JSON.stringify({ cwd, token: 't' }));
    expect(res.status).toBe(200);
    const page = await req(hub.port, '/p/sum-demo/summary/');
    expect(page.status).toBe(200);
    expect(page.body).toContain('<meta name="sbl-page" content="summary">');
    const redirect = await req(hub.port, '/p/sum-demo/summary');
    expect(redirect.status).toBe(302);
    expect(redirect.location).toBe('/p/sum-demo/summary/');
  });
```

In `test/unit/dashboard-render.test.ts`, inside `describe('v2 structure', …)`, insert after the test `'hosts drafts in their own section 05'`:

```ts
  it('offers Dashboard/Summary page tabs that only appear when served by the hub', () => {
    const nav = /<nav class="page-tabs" id="page-tabs" aria-label="Project pages" hidden>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
    expect(nav).toContain('<a href="./" aria-current="page">Dashboard</a>');
    expect(nav).toContain('<a href="summary/">Summary</a>');
    expect(html).toContain(String.raw`if (/^\/p\/[^/]+\/(index\.html)?$/.test(location.pathname)) document.getElementById('page-tabs').hidden = false;`);
  });
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run test/integration/serve.test.ts test/unit/hub.test.ts test/unit/dashboard-render.test.ts`
Expected: FAIL. The summary route tests get 404 `not found` instead of 200/302. The hub test fails on the summary GET. The page-tabs test finds no `<nav class="page-tabs"`.

- [ ] **Step 4: Serve and regenerate the summary in the hub.** In `src/dashboard/hub.ts`:

1. After `import { renderDashboard } from './render.js';` add:

```ts
import { summaryFileFor, writeSummaryPage } from './summary-render.js';
```

2. Give `serveFile` a configurable 404 body:

```ts
function serveFile(file: string, res: ServerResponse, notFound = 'dashboard not generated yet'): void {
```

and in its `.catch` replace `sendText(res, 404, 'dashboard not generated yet');` with `sendText(res, 404, notFound);`.

3. In `generateDashboard`, after `atomicWrite(file, renderDashboard(data));` add:

```ts
  writeSummaryPage(cwd, data, file);
```

4. In the per-project request handler, directly after the index route block (`if (method === 'GET' && (rest === '/' || rest === '/index.html')) { serveFile(entry.file, res); return; }`) and before `sendText(res, 404, 'not found');`, insert:

```ts
    if (rest === '/summary') {
      res.writeHead(302, { location: `/p/${slug}/summary/` });
      res.end();
      return;
    }

    if (method === 'GET' && (rest === '/summary/' || rest === '/summary/index.html')) {
      serveFile(summaryFileFor(entry.file), res, 'summary not generated yet');
      return;
    }
```

In `src/commands/dashboard.ts`, after `import { renderDashboard } from '../dashboard/render.js';` add:

```ts
import { writeSummaryPage } from '../dashboard/summary-render.js';
```

and in `regenerateInto`, after `atomicWrite(outPath, renderDashboard(data));` add:

```ts
  writeSummaryPage(cwd, data, outPath);
```

- [ ] **Step 5: Add the page tabs to the dashboard.** In `src/templates/dashboard.html`, after the CSS line that starts with `  nav a .n { color: var(--accent);` insert:

```css
  nav.page-tabs { display: flex; gap: 4px; margin: 2px 0 14px; }
  nav.page-tabs[hidden] { display: none; }
  nav.page-tabs a { padding: 4px 10px; font-size: .82rem; min-height: 24px; }
  nav.page-tabs a[aria-current="page"] { color: var(--text); background: var(--surface-3); border-color: var(--line); }
```

In the sidebar markup, the brand row ends with the theme toggle button (`<button type="button" id="theme-toggle" …>◐</button>`) and its closing `  </div>`; the next line is `  <div class="kicker">SUPERPOWERS × BACKLOG.MD</div>`. Insert between that closing `  </div>` and the kicker line:

```html
  <nav class="page-tabs" id="page-tabs" aria-label="Project pages" hidden>
    <a href="./" aria-current="page">Dashboard</a>
    <a href="summary/">Summary</a>
  </nav>
  <script>if (/^\/p\/[^/]+\/(index\.html)?$/.test(location.pathname)) document.getElementById('page-tabs').hidden = false;</script>
```

- [ ] **Step 6: Update the dashboard snapshot**

Run: `npx vitest run -u test/unit/dashboard-render.test.ts`
Then: `git diff --stat test/unit/__snapshots__/dashboard-render.test.ts.snap`
Expected: 9 insertions (4 CSS lines, 5 markup lines), nothing else.

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npx vitest run test/integration/serve.test.ts test/unit/hub.test.ts test/unit/dashboard-render.test.ts`
Expected: PASS. `serve.test.ts` has 16 tests (7 new); on win32 with Node ≥24, 12 pass and 4 watcher tests are skipped by `watcherIt`, one of them new. In `hub.test.ts`, 14 tests. In `dashboard-render.test.ts`, 93 tests.

- [ ] **Step 8: Write the guide.** Create `docs/guide/project-summary.md`:

````markdown
---
type: how-to
---

# Project summary page

Every project registered with the dashboard hub gets a second page next to the
dashboard: a management summary at `/p/<slug>/summary/`. The dashboard is about
work in progress; the summary answers what the project is, how it is built and
where the open work sits.

## Open the page

```bash
sbl dashboard
```

Use the **Summary** tab under the project name in the dashboard sidebar, or open
`http://localhost:6428/p/<slug>/summary/` directly. The summary page has tabs
back to the **Dashboard** and to the full-page **Backlog** browser. Both pages
share the theme toggle and reload automatically when anything under `backlog/`
changes, including the architecture file.

## What the page shows

The page combines two sources and says which block came from where (the
collapsible **Data source** section at the bottom).

- **Automatic facts**, computed by the hub on every regenerate: name, version
  and license from `package.json`, `composer.json` or a WordPress theme/plugin
  header; lines of code and test files; runtime and development dependencies;
  releases (git tags such as `v1.2.0`); CI workflows; open tasks from the
  backlog; commands from the manifest scripts.
- **Curated content** from `backlog/docs/architecture.yml`: a one-paragraph
  pitch, an architecture diagram with zones, components and labelled
  connections, flows that walk through the diagram step by step, numbered
  highlights, the tech stack with the role of each package, grouped commands,
  and a mapping from open tasks to components.

Without the curated file the page shows a reduced view: the facts, all open
tasks, the manifest commands and the tech stack from the manifests, plus a
notice that explains how to add the file.

## Create the architecture file

Write `backlog/docs/architecture.yml` by hand, starting from the minimal file
under [File format](#file-format). Keep `sbl dashboard` open while you edit: the
page reloads on every save, and an invalid file shows a notice with every
problem and its path in place of the diagram.

## File format

A minimal file:

```yaml
schema: 1
pitch: A **small** service that turns uploads into reports.
grid: { cols: 3, rows: 2 }
nodes:
  - { id: api, label: Upload API, kind: core, cell: [0, 0] }
  - { id: store, label: Report store, kind: output, cell: [2, 0] }
  - { id: mail, label: Mail relay, kind: external, cell: [2, 1] }
edges:
  - { from: api, to: store, label: writes }
  - { from: store, to: mail, label: notifies }
```

| Key | Required | Content |
| --- | --- | --- |
| `schema` | yes | Always `1`. |
| `pitch` | yes | At most 400 characters. `**bold**` is the only markup. |
| `grid` | yes | `{ cols, rows }`, 2 to 8 each. Nodes sit on grid cells. |
| `kinds` | no | Map of kind id to `{ label, color, dashed? }`; replaces the default kinds `actor`, `core`, `output`, `optional`, `external`. At most 6. |
| `zones` | no | `{ label, cols: [c0, c1], rows: [r0, r1] }`, inclusive cell ranges that may not overlap. |
| `nodes` | yes | At least 2, at most 40: `id`, `label` (28 characters), `kind`, `cell: [col, row]`, optional `sub`, `purpose`, `why`, `files`, `commands` (`{ run, note? }`). |
| `edges` | yes | At least 1, at most 120: `{ from, to, label, text? }`. Read as "from → label → to"; the arrow points at the target. |
| `flows` | no | Up to 12 `{ id, label, color?, command?, text?, steps }`, each step `from>to` naming an existing edge. |
| `highlights` | no | Up to 12 `{ node, title, text }`; the list position is the badge number on the node, one badge per node. |
| `stack` | no | Up to 40 `{ name, group, package?, version?, role?, nodes }`. Versions resolve from `package-lock.json` or `composer.lock` unless `version` is set. |
| `commands` | no | Map of group name to `{ run, note? }` entries; at most 6 groups of 8. |
| `tasks` | no | Map of task id to node id; shows open tasks on their component. |

Identifiers (`id`, kind keys, flow ids) match `^[a-z][a-z0-9-]{0,31}$`. Colors
are one of `accent`, `ok`, `warn`, `violet`, `rose`, `muted`, `dim`. The file
may be at most 256 KB.

### YAML subset

The file is YAML, read by a small built-in parser instead of a full YAML
library:

- block mappings and sequences with two-space indentation;
- single-line flow collections `[a, b]` and `{ k: v }`; a flow mapping may hold
  a flow sequence (`cell: [0, 1]`), but no deeper nesting;
- plain, single-quoted and double-quoted scalars, integers, `true`/`false`,
  `>` and `|` block scalars, and `#` comments.

Quote a value when it contains a comma inside `{ }` or `[ ]`, a colon followed
by a space, or a `#`. Tabs, anchors, aliases, tags and multiple documents are
rejected with the line and column of the problem.

## When something is wrong

- **No file:** the reduced view, without a warning.
- **Invalid file:** the reduced view plus a notice that lists up to 20 problems
  as `path: message`, for example `nodes[3].cell: outside grid 5x5`. The page
  never fails to load.
- **Unexpected render error:** the reduced view with the error message. The
  dashboard is never affected.
- **Warnings only:** the full page; the warnings appear in **Data source**.
````

In `docs/.vitepress/config.mts`, add the sidebar entry after `{ text: 'Pipeline phases', link: '/guide/pipeline-phases' },`:

```ts
          { text: 'Project summary', link: '/guide/project-summary' },
```

In `docs/guide/quickstart.md`, section `## Project dashboard`, after the line ``There is no static `dashboard.html` written to your project.``, add an empty line and:

```markdown
Each project also gets a [project summary page](./project-summary) at `/p/<slug>/summary/`: architecture diagram, tech stack, commands and open work at a glance.
```

In `README.md`, section `## Project Dashboard`, after the line `![Project Dashboard](docs/assets/dashboard.png)`, add an empty line and:

```markdown
Next to the dashboard, every project gets a summary page with an architecture diagram, tech stack, commands and open work: [docs/guide/project-summary.md](docs/guide/project-summary.md).
```

- [ ] **Step 9: Lint and run the full suite**

Run: `npm run lint`
Expected: exit 0 (markdownlint and cspell clean).
Run: `npm test`
Expected: all tests pass, with only the existing platform skips. If the dashboard snapshot shows line-ending churn only, revert it with `git checkout -- test/unit/__snapshots__/dashboard-render.test.ts.snap`.

- [ ] **Step 10: Manual check (spec "Manual" list, part 2).** Run `node dist/bin.js dashboard`. In the browser:
- the dashboard shows the Dashboard/Summary tabs under the project name, and Summary opens `/p/super-backlog/summary/`;
- the summary page shows the reduced view with the "No architecture file yet" box, because this repo has no `architecture.yml` yet;
- the summary page's Dashboard tab returns, and its Backlog tab opens `../bb/` in the same tab;
- switching the theme on one page carries over to the other after navigation (shared `sbl-theme` key).

Stop the hub with Ctrl+C.

- [ ] **Step 11: Commit**

```powershell
git add src/dashboard/hub.ts src/commands/dashboard.ts src/templates/dashboard.html test/integration/serve.test.ts test/unit/hub.test.ts test/unit/dashboard-render.test.ts test/unit/__snapshots__/dashboard-render.test.ts.snap docs/guide/project-summary.md docs/.vitepress/config.mts docs/guide/quickstart.md README.md
git commit -m "feat(summary): serve the summary page in the hub with page tabs and guide" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Hand over to verify**

Run: `node dist/bin.js phase TASK-90 verify`

- [ ] **Step 13: Branch for the skill**

Run: `git checkout -b feat/architecture-summary-skill`
Expected: `Switched to a new branch 'feat/architecture-summary-skill'` (based on the Task 6 commit).

---

### Task 7: `architecture-summary` skill and doctor check 5 (TASK-91)

**Files:**
- Create: `src/templates/skill-architecture-summary.md`
- Modify: `src/init/execute.ts`, `src/commands/uninstall.ts`, `src/commands/doctor.ts`
- Modify (docs): `docs/guide/project-summary.md`, `docs/guide/harness-support.md`, `docs/guide/quickstart.md`, `README.md`
- Test: `test/unit/glue-skills.test.ts`, `test/unit/doctor.test.ts`, `test/e2e/init.e2e.test.ts`, `test/e2e/uninstall.e2e.test.ts`

**Interfaces:**
- Consumes: `ARCHITECTURE_PATH`, `loadArchitecture`, `ArchitectureLoadResult`, `checkArchitectureText` (Task 2); `layoutArchitecture` (Task 4).
- Produces:
  - `GLUE_SKILLS` includes `'architecture-summary'`, so `sbl init`/`sbl update` copy it to `.claude/skills/architecture-summary/SKILL.md` and `.opencode/skill/architecture-summary/SKILL.md`, and `OWNED_SKILL_DIRS` removes both on uninstall.
  - `DoctorDeps` gains `loadArchitecture?: (cwd: string) => ArchitectureLoadResult` and `layoutArchitecture?: typeof layoutArchitecture`.
  - Doctor check 5 outcomes:
    - `[skip]` when the file is absent;
    - `[fail]` with exit 1, one line per problem (`error: <path>: <message>`), plus a fix line;
    - `[warn]` with exit 4 for schema or layout warnings;
    - `[ok]` with node/edge counts.

**Decisions:**
- Check 5 does not pass task ids to `loadArchitecture`. Mappings to archived tasks are expected drift, not a doctor warning, and this keeps `test/e2e/doctor.e2e.test.ts` (which runs in the repo root and expects no `[warn]`) stable.
- An invalid file is one `[fail]` entry listing every problem as an extra line. Layout warnings print as `layout <code> <edge>: <message>`.
- `makeDeps` in `doctor.test.ts` gets a valid default `loadArchitecture`, so the existing tests stay hermetic.
- The summary file is not added to uninstall: it lives next to the hub's dashboard file in the temp directory, not in the project.

- [ ] **Step 1: Start the phase**

Run: `node dist/bin.js phase TASK-91 impl`

- [ ] **Step 2: Write the failing glue-skill tests.** In `test/unit/glue-skills.test.ts`, in `describe('all glue skills exist', …)`, rename the test to `'all four glue skill templates are present'` and add `'skill-architecture-summary.md',` after `'skill-task-review-gate.md',` in its file list. Append at the end of the file:

```ts
describe('skill-architecture-summary.md', () => {
  const t = read('skill-architecture-summary.md');
  it('has frontmatter with name and description', () => {
    expect(t.startsWith('---')).toBe(true);
    expect(t).toMatch(/^name: architecture-summary$/m);
    expect(t).toMatch(/^description: .+/m);
  });
  it('writes the curated file and loops on sbl doctor until check 5 is clean', () => {
    expect(t).toContain('backlog/docs/architecture.yml');
    expect(t).toContain('sbl doctor');
    expect(t).toMatch(/run `sbl doctor` again until check 5/i);
  });
  it('keeps curated prose and stops for review', () => {
    expect(t).toMatch(/keep curated prose/i);
    expect(t).toMatch(/STOP/);
  });
  it('never invents files or commands', () => {
    expect(t).toMatch(/never invent files, commands/i);
  });
  it('links the schema reference', () => {
    expect(t).toContain('https://adam-s-k-i.github.io/super-backlog/guide/project-summary');
  });
});
```

In `test/e2e/init.e2e.test.ts`, after the two `spec-to-backlog` `SKILL.md` assertions, add:

```ts
    expect(existsSync(join(dir, '.opencode', 'skill', 'architecture-summary', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dir, '.claude', 'skills', 'architecture-summary', 'SKILL.md'))).toBe(true);
```

In `test/e2e/uninstall.e2e.test.ts`, after the two `spec-to-backlog` `toBe(false)` assertions, add:

```ts
    expect(existsSync(join(dir, '.opencode', 'skill', 'architecture-summary'))).toBe(false);
    expect(existsSync(join(dir, '.claude', 'skills', 'architecture-summary'))).toBe(false);
```

- [ ] **Step 3: Write the failing doctor tests.** In `test/unit/doctor.test.ts`, below `import { runDoctor, type DoctorDeps } from '../../src/commands/doctor.js';` add:

```ts
import { layoutArchitecture } from '../../src/dashboard/summary-layout.js';
import { checkArchitectureText } from '../../src/dashboard/summary-schema.js';

const ARCH_OK = [
  'schema: 1',
  'pitch: A **small** demo.',
  'grid: { cols: 3, rows: 2 }',
  'nodes:',
  '  - { id: a, label: Alpha, kind: core, cell: [0, 0] }',
  '  - { id: b, label: Beta, kind: output, cell: [2, 0] }',
  '  - { id: c, label: Gamma, kind: external, cell: [2, 1] }',
  'edges:',
  '  - { from: a, to: b, label: calls }',
  '  - { from: b, to: c, label: writes }',
  '',
].join('\n');
```

In `makeDeps`, add after `readTaskLabels: () => [],`:

```ts
    loadArchitecture: () => checkArchitectureText(ARCH_OK, 'architecture.yml'),
```

Append at the end of the file:

```ts
describe('check 5: architecture.yml', () => {
  it('passes on a clean file and reports its size', () => {
    const d = makeDeps();
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines.some((l) => l.includes('[ok]') && l.includes('backlog/docs/architecture.yml valid (3 nodes, 2 edges, layout clean)'))).toBe(true);
  });

  it('is skipped when the file is absent', () => {
    const d = makeDeps({ loadArchitecture: () => ({ status: 'missing', path: '/proj/backlog/docs/architecture.yml' }) });
    expect(runDoctor('/proj', d)).toBe(0);
    expect(d.lines.some((l) => l.includes('[skip]') && l.includes('backlog/docs/architecture.yml not present'))).toBe(true);
  });

  it('fails and lists every problem with its path', () => {
    const broken = ARCH_OK.replace('kind: output', 'kind: robot').replace('cell: [2, 1]', 'cell: [9, 9]');
    const d = makeDeps({ loadArchitecture: () => checkArchitectureText(broken, 'architecture.yml') });
    expect(runDoctor('/proj', d)).toBe(1);
    const out = d.lines.join('\n');
    expect(d.lines.some((l) => l.includes('[fail]') && l.includes('backlog/docs/architecture.yml: 2 error(s)'))).toBe(true);
    expect(out).toContain('error: nodes[1].kind:');
    expect(out).toContain('error: nodes[2].cell:');
    expect(out).toContain('fix: edit the file or run the architecture-summary skill');
  });

  it('reports a parse error with line and column', () => {
    const d = makeDeps({ loadArchitecture: () => checkArchitectureText('schema: 1\n\tpitch: x\n', 'architecture.yml') });
    expect(runDoctor('/proj', d)).toBe(1);
    expect(d.lines.join('\n')).toMatch(/error: line 2, column 1: /);
  });

  it('warns on schema warnings and layout warnings', () => {
    const withUnknownKey = `${ARCH_OK}colour: red\n`;
    const d = makeDeps({
      loadArchitecture: () => checkArchitectureText(withUnknownKey, 'architecture.yml'),
      layoutArchitecture: (input) => ({
        ...layoutArchitecture(input),
        warnings: [{ code: 'route-fallback', edge: 'a>b', message: 'no straight or single-corner route from a to b; move one of the cells' }],
      }),
    });
    expect(runDoctor('/proj', d)).toBe(4);
    const out = d.lines.join('\n');
    expect(d.lines.some((l) => l.includes('[warn]') && l.includes('valid with 2 warning(s)'))).toBe(true);
    expect(out).toContain('warning: colour:');
    expect(out).toContain('layout route-fallback a>b: no straight or single-corner route from a to b');
  });
});
```

- [ ] **Step 4: Run the unit tests and watch them fail**

Run: `npx vitest run test/unit/glue-skills.test.ts test/unit/doctor.test.ts`
Expected: FAIL. The template file `skill-architecture-summary.md` is missing. In the doctor tests, `loadArchitecture` is not a known dependency, so no check-5 line is printed and the five check-5 tests fail; the TypeScript excess-property error shows up in `npm run build`, not in Vitest.

- [ ] **Step 5: Write the skill.** Create `src/templates/skill-architecture-summary.md`:

```markdown
---
name: architecture-summary
description: Create or refresh backlog/docs/architecture.yml, the curated source of the project summary page (architecture diagram, flows, highlights, tech stack, commands). Use when the user asks for a project summary, an architecture overview or diagram, or after structural changes to the codebase.
---

# Architecture Summary: curate the project summary page

Writes `backlog/docs/architecture.yml`. The dashboard hub renders it at
`/p/<slug>/summary/` next to facts it computes itself (versions, LOC, tests,
releases, CI, open work). Schema and YAML subset:
<https://adam-s-k-i.github.io/super-backlog/guide/project-summary>.

## When this skill runs

- The user asks for a project summary, an architecture overview or a diagram.
- The summary page shows "No architecture file yet".
- After structural changes: new modules, removed components, renamed commands.

## Procedure

1. Read the facts first: manifests (`package.json`, `composer.json`, WordPress
   headers in `style.css` or the main plugin file), the top-level directory
   layout, the entry points, and the test layout.
2. If `backlog/docs/architecture.yml` exists, read it. Keep curated prose
   (`pitch`, `purpose`, `why`, highlight texts) unless the code contradicts it;
   change only what is outdated or missing.
3. Propose the content:
   - `pitch`: one or two sentences, `**bold**` is the only markup.
   - 6 to 14 `nodes` with `kind`, a short `label` (at most 28 characters),
     `purpose`, `why`, real `files` and real `commands`.
   - `zones` that group nodes by layer; zones may not overlap.
   - `edges` that read "from → label → to" (the source uses, calls or writes
     the target).
   - 3 to 5 `flows` that walk existing edges, each step written as `from>to`.
   - 4 to 6 `highlights`, at most one per node.
   - `stack`, `commands` and `tasks` (open task id → node id) where they help.
4. Place nodes on the `grid` so that every edge is a straight line or has a
   single corner: connected nodes share a row or a column, or the corner cell
   between them stays free.
5. Write the file with two-space indentation, no tabs, and quote every value
   that contains a comma, a colon followed by a space, or a `#`.
6. Run `sbl doctor`. Check 5 validates the file and prints every problem with
   its path, plus the layout warnings (`route-fallback`, `label-collision`,
   `crossing`). Fix the file and run `sbl doctor` again until check 5 reports
   `[ok]`.
7. Present the diff of `backlog/docs/architecture.yml` for review and STOP
   until the user approves the prose. Point to the live page:
   `sbl dashboard`, then the **Summary** tab.

## Boundaries

- Never invent files, commands, packages or versions: every path in `files`
  must exist, every `run` must be a command that works in this project.
- Keep `purpose` and `why` under three sentences each.
- The hub computes the facts (versions, LOC, tests, releases, CI); never copy
  them into the file.
- Write curated text in the language the user works in; keys stay English.
- Only touch `backlog/docs/architecture.yml`; never edit tasks or other
  backlog files.
```

- [ ] **Step 6: Register the skill for install and uninstall.** In `src/init/execute.ts` replace the `GLUE_SKILLS` line with:

```ts
const GLUE_SKILLS = ['spec-to-backlog', 'backlog-status-report', 'task-review-gate', 'architecture-summary'] as const;
```

In `src/commands/uninstall.ts`, `OWNED_SKILL_DIRS`: add `'.opencode/skill/architecture-summary',` after `'.opencode/skill/task-review-gate',` and add `'.claude/skills/architecture-summary',` after `'.claude/skills/task-review-gate',`.

- [ ] **Step 7: Implement doctor check 5.** In `src/commands/doctor.ts`, between `import process from 'node:process';` (plus its empty line) and `import { extractPhaseLabels, PHASES } from '../lib/phase.js';`, add:

```ts
import { ARCHITECTURE_PATH, loadArchitecture, type ArchitectureLoadResult } from '../dashboard/summary-schema.js';
import { layoutArchitecture } from '../dashboard/summary-layout.js';
```

In `interface DoctorDeps`, after `readTaskLabels?: (cwd: string) => TaskLabelRow[] | null;` add:

```ts
  /** Seam for check 5; defaults to reading backlog/docs/architecture.yml. */
  loadArchitecture?: (cwd: string) => ArchitectureLoadResult;
  /** Seam for check 5; defaults to the summary page's layout engine. */
  layoutArchitecture?: typeof layoutArchitecture;
```

Insert check 5 after the end of check 4 (the block that ends with ``emit('ok', `phase label hygiene clean (${taskRows.length} tasks)`);`` and its two closing braces). It goes before the line ``log(`doctor summary: ${okCount} ok, …`);``, followed by an empty line:

```ts
  // check 5: curated architecture file of the summary page. Task ids are not
  // passed: mappings to archived tasks are expected drift, not a doctor warning.
  const arch = (deps.loadArchitecture ?? ((c: string) => loadArchitecture(c)))(cwd);
  if (arch.status === 'missing') {
    emit('skip', `${ARCHITECTURE_PATH} not present (summary page shows the reduced view)`);
  } else if (arch.status === 'invalid') {
    const errors = arch.problems.filter((p) => p.level === 'error').length;
    emit('fail', `${ARCHITECTURE_PATH}: ${errors} error(s)`, [
      ...arch.problems.map((p) => `${p.level}: ${p.path}: ${p.message}`),
      'fix: edit the file or run the architecture-summary skill, then sbl doctor again',
    ]);
  } else {
    const layout = (deps.layoutArchitecture ?? layoutArchitecture)(arch.architecture);
    const warnings = [
      ...arch.problems.map((p) => `warning: ${p.path}: ${p.message}`),
      ...layout.warnings.map((w) => `layout ${w.code} ${w.edge}: ${w.message}`),
    ];
    const size = `${arch.architecture.nodes.length} nodes, ${arch.architecture.edges.length} edges`;
    if (warnings.length === 0) emit('ok', `${ARCHITECTURE_PATH} valid (${size}, layout clean)`);
    else emit('warn', `${ARCHITECTURE_PATH} valid with ${warnings.length} warning(s) (${size})`, warnings);
```

- [ ] **Step 8: Run the unit tests and watch them pass**

Run: `npx vitest run test/unit/glue-skills.test.ts test/unit/doctor.test.ts`
Expected: PASS, 14 + 19 tests.

- [ ] **Step 9: Update the docs.** In `docs/guide/project-summary.md`, replace the whole section `## Create the architecture file` (from its heading up to, not including, `## File format`) with:

````markdown
## Create the architecture file

Let your agent write it. `sbl init` and `sbl update` install the
`architecture-summary` skill for Claude Code and OpenCode. Ask for "an
architecture summary of this project"; the skill reads manifests, layout and
tests, writes `backlog/docs/architecture.yml`, runs `sbl doctor` until the file
is clean and stops for your review.

To check the file yourself:

```bash
sbl doctor
```

Check 5 validates `backlog/docs/architecture.yml`. It is skipped when the file
does not exist, fails with every problem and its path when the file is invalid,
and warns when the file is valid but the diagram cannot be drawn cleanly
(an edge without a straight or single-corner route, an overlapping label, or a
crossing).
````

In `docs/guide/harness-support.md`, change `The glue skills (spec-to-backlog, backlog-status-report, task-review-gate)` to `The glue skills (spec-to-backlog, backlog-status-report, task-review-gate, architecture-summary)`.

In `docs/guide/quickstart.md`, change the `sbl doctor` row of the command table to:

```markdown
| `sbl doctor` | Check Node, PowerShell policy, the `backlog` CLI, phase-label hygiene, and the summary page's `architecture.yml`. |
```

In `README.md`, change the table row that starts with ``| `.opencode/skill/` + `.claude/skills/` | Glue skills:`` to:

```markdown
| `.opencode/skill/` + `.claude/skills/` | Glue skills: `spec-to-backlog`, `task-review-gate`, `backlog-status-report`, `architecture-summary` |
```

- [ ] **Step 10: Build, lint, full suite**

Run: `npm run build`
Expected: exit 0.
Run: `npm run lint`
Expected: exit 0.
Run: `npm test`
Expected: all tests pass, including `init.e2e`, `uninstall.e2e` and `doctor.e2e`. This repo has no `architecture.yml` yet, so check 5 prints `[skip]` and `doctor.e2e` still sees exit 0 without `[warn]`.

- [ ] **Step 11: Commit**

```powershell
git add src/templates/skill-architecture-summary.md src/init/execute.ts src/commands/uninstall.ts src/commands/doctor.ts test/unit/glue-skills.test.ts test/unit/doctor.test.ts test/e2e/init.e2e.test.ts test/e2e/uninstall.e2e.test.ts docs/guide/project-summary.md docs/guide/harness-support.md docs/guide/quickstart.md README.md
git commit -m "feat(skills): architecture-summary skill and doctor check 5" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Hand over to verify**

Run: `node dist/bin.js phase TASK-91 verify`

---

### Task 8: Dogfood `architecture.yml` for super-backlog (TASK-92)

**Files:**
- Create: `backlog/docs/architecture.yml` (written by the skill, approved by the user)
- Create: `.claude/skills/architecture-summary/SKILL.md`, `.opencode/skill/architecture-summary/SKILL.md` (installed by `sbl update`)
- Create: `docs/assets/project-summary.png`
- Modify: `docs/guide/project-summary.md` (screenshot)

**Interfaces:**
- Consumes: everything above; the skill from Task 7; the spec's example file and `test/fixtures/summary/architecture.super-backlog.yml` as the starting point.
- Produces: the repo's own curated summary. From now on, `test/e2e/doctor.e2e.test.ts` (which runs `sbl doctor` in the repo root and asserts exit 0 with no `[warn]`) also guards this file: **check 5 must stay `[ok]` with zero schema and layout warnings.**

- [ ] **Step 1: Build and install the new skill into this repo**

Run: `npm run build`
Run: `node dist/bin.js update --no-self`
Expected: `.claude/skills/architecture-summary/SKILL.md` and `.opencode/skill/architecture-summary/SKILL.md` exist. Run `git status --short` and check that no other managed file changed unexpectedly. If it did, report it to the controller and do not commit that file.

- [ ] **Step 2: Start the phase**

Run: `node dist/bin.js phase TASK-92 impl`

- [ ] **Step 3: Run the skill.** Follow `.claude/skills/architecture-summary/SKILL.md` for this repository. Use the spec's example and `test/fixtures/summary/architecture.super-backlog.yml` as a seed, but verify every `files` path and every `run` command against the repo; delete what does not exist. Map open tasks in `tasks:` only to ids that `backlog task list --plain` shows as open. Write `backlog/docs/architecture.yml`.

- [ ] **Step 4: Validate until clean**

Run: `node dist/bin.js doctor`
Expected: check 5 prints `[ok] backlog/docs/architecture.yml valid (<n> nodes, <m> edges, layout clean)` and the command exits 0. On `[fail]` or `[warn]`, fix the file (move cells for `route-fallback`/`crossing`, shorten labels for `label-collision`) and run it again.

- [ ] **Step 5: STOP — user review of the prose.** Show the user the full `backlog/docs/architecture.yml` (pitch, node purposes and whys, highlights, flows). Wait for explicit approval in chat. Apply requested changes, re-run Step 4 after each change, and do not continue until the user approves.

- [ ] **Step 6: Verify in the live hub**

Run: `node dist/bin.js dashboard --no-open`
Open `http://localhost:6428/p/super-backlog/summary/` and check:
- Data source lists no warnings;
- the diagram has no crossings;
- both themes look right;
- the keyboard tour works (Tab, Enter, Esc, flow chips);
- saving a whitespace change to `backlog/docs/architecture.yml` reloads the page (where the watcher is supported).

- [ ] **Step 7: Screenshot for the guide.** Take a 1440 × 1000 screenshot of the summary page in the dark theme with one flow selected, and save it as `docs/assets/project-summary.png`. Keep it under 400 KB; compare with `docs/assets/dashboard.png`. Stop the hub with Ctrl+C. In `docs/guide/project-summary.md`, section `## Open the page`, add after the paragraph that ends with "including the architecture file.":

```markdown

![Project summary page](../assets/project-summary.png)
```

- [ ] **Step 8: Lint and full suite**

Run: `npm run lint`
Expected: exit 0.
Run: `npm test`
Expected: all tests pass. In particular, `test/e2e/doctor.e2e.test.ts` passes with the new file in the repo root.

- [ ] **Step 9: Commit**

```powershell
git add backlog/docs/architecture.yml .claude/skills/architecture-summary/SKILL.md .opencode/skill/architecture-summary/SKILL.md docs/assets/project-summary.png docs/guide/project-summary.md
git commit -m "docs(summary): dogfood architecture.yml for super-backlog with guide screenshot" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Hand over to verify**

Run: `node dist/bin.js phase TASK-92 verify`

---

## Self-review

**Spec coverage:**

| Spec item | Task |
|---|---|
| D7 parser | 1 |
| Schema section, limits, E2 paths | 2 |
| D2–D4 facts | 3 |
| L1–L7 layout | 4 |
| V1–V7, Accessibility, Theming, Security, E1–E4, D5/D6 | 5 |
| R1–R6 | 6 |
| Docs page (Docs section) | 6 and 7 |
| Generator skill and doctor check 5 | 7 |
| Dogfood | 8 |

The "Manual" testing list is split across Task 5 Step 11 and Task 6 Step 10 (keyboard, reduced motion, 380 px, theme round trip), with the final check in Task 8 Step 6.

**Backlog ACs:**
- TASK-85: constructs, line/column, CRLF and 256 KB are all tested in Task 1.
- TASK-86: the spec example, one test per rule and both fixtures are in Task 2.
- TASK-87: the walk fallback, the 10 MB flag, tags through `runCapture` and scripts per package manager are in Task 3.
- TASK-88: zero crossings and collisions, determinism, H/V/VH/HV, fallback, port order and label scoring are in Task 4.
- TASK-89: both snapshots, the notice, escaping, bold only in the pitch, `../api/events`, `sbl-theme`, the new hues in both blocks and the manual checks are in Task 5.
- TASK-90: the routes, the 302, the 404 text, the reload (skipped where the watcher is unsupported), invalid → 200 with notice, the dashboard staying intact on a summary failure, the page tabs and the guide plus its links are in Task 6.
- TASK-91: frontmatter, the doctor loop, never-invent, `GLUE_SKILLS`, uninstall, check 5 pass/fail/skip and the tests are in Task 7.
- TASK-92: skill-generated and user-approved, check 5 `[ok]`, the live hub and the screenshot are in Task 8.

**Placeholder scan:** every code step contains the complete file or the exact edit; there is no "TBD", "similar to" or "add error handling". The only conditional instruction is the template-copy check in Task 5 Step 5, with a concrete action for both outcomes.

**Type consistency:**
- `ArchitectureLoadResult`, `SchemaProblem.level/path/message` and `LayoutWarning.code/edge/message` are used identically in `summary-render.ts`, `doctor.ts` and the tests.
- The edge id `from>to` is shared by layout warnings, flow steps and the doctor output.
- `summaryFileFor` is used by `hub.ts` and `serve.test.ts`.
- The `<meta name="sbl-page" content="summary">` marker is asserted in the render, hub and serve tests.

**Order and isolation:**
- Tasks 2–4 depend only on Task 1 (Task 4 also uses the fixtures from Task 2).
- Task 5 needs 1–4, Task 6 needs 5, Task 7 needs 2 and 4, and Task 8 needs everything.
- Each task leaves `npm run build` green, and every commit stages only its listed files.

**Known risks:**
- **Doctor e2e coupling:** `doctor.e2e` runs in the repo root, so from Task 8 on any check-5 warning in this repo's `architecture.yml` fails `npm test`. Task 8 Step 4 makes `[ok]` a hard gate, and Task 7 keeps task-id drift out of the doctor.
- **Watcher test:** the watcher-based reload test is skipped locally (win32, Node 24); it runs on Linux CI.
