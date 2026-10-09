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
