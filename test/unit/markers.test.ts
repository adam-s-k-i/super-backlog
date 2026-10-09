// test/unit/markers.test.ts
import { describe, expect, it } from 'vitest';
import { MARKER_END, injectBlock, markerStart, stripOwned } from '../../src/lib/markers.js';

const BLOCK = '## Workflow\n\nrules here';
const crlf = (s: string): string => s.replace(/\n/g, '\r\n');
const LONE_LF = /(?<!\r)\n/;

describe('injectBlock', () => {
  it('creates block in empty content', () => {
    const r = injectBlock('', '1.2.3', BLOCK);
    expect(r.action).toBe('created');
    expect(r.content).toBe(`${markerStart('1.2.3')}\n${BLOCK}\n${MARKER_END}\n`);
  });

  it('preserves surrounding content byte-exactly', () => {
    const before = '# My Project\n\nintro text\n';
    const after = '\n## Setup\n\nnpm i\n';
    const first = injectBlock(before, '1.0.0', BLOCK).content + after;
    const second = injectBlock(first, '1.1.0', BLOCK).content;
    expect(second.startsWith(before)).toBe(true);
    expect(second.endsWith(after)).toBe(true);
  });

  it('replaces existing owned block on re-inject', () => {
    const once = injectBlock('# T\n', '1.0.0', BLOCK).content;
    const twice = injectBlock(once, '2.0.0', BLOCK);
    expect(twice.action).toBe('replaced');
    expect(twice.content).toContain(markerStart('2.0.0'));
    expect(twice.content).not.toContain(markerStart('1.0.0'));
  });

  it('is unchanged when identical block+version present', () => {
    const once = injectBlock('# T\n', '1.0.0', BLOCK).content;
    const again = injectBlock(once, '1.0.0', BLOCK);
    expect(again.action).toBe('unchanged');
  });

  it('never touches foreign markers-like content outside block', () => {
    const content = '<!-- SUPER-BACKLOG:something else -->\nkeep me';
    const r = injectBlock(content, '1.0.0', BLOCK);
    expect(r.content).toContain('<!-- SUPER-BACKLOG:something else -->');
    expect(r.content).toContain('keep me');
  });
});

describe('stripOwned', () => {
  it('removes owned block including markers', () => {
    const doc = injectBlock('# H\n', '1.0.0', BLOCK).content;
    const r = stripOwned(doc);
    expect(r.removed).toBe(true);
    expect(r.content).not.toContain(BLOCK);
    expect(r.content).not.toContain(MARKER_END);
    expect(r.content).toContain('# H\n');
  });
  it('reports removed=false when absent', () => {
    expect(stripOwned('# plain\n').removed).toBe(false);
  });
  it('leaves unrelated blank-line runs elsewhere untouched', () => {
    const doc = injectBlock('# H\n\n\n\nkept spacing', '1.0.0', BLOCK).content;
    const r = stripOwned(doc);
    expect(r.removed).toBe(true);
    expect(r.content).toContain('# H\n\n\n\nkept spacing');
  });
});

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
