// src/lib/yamlmini.ts
import { existsSync, readFileSync } from 'node:fs';

export function readSimpleKeys(filePath: string, keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) out[k] = undefined;
  if (!existsSync(filePath)) return out;
  const wanted = new Set(keys);
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!m || !wanted.has(m[1])) continue;
    const raw = m[2].trim();
    out[m[1]] = raw.replace(/^["'](.*)["']$/, '$1');
  }
  return out;
}

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
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  return new Parser(normalized).parseDocument();
}
