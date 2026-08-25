// test/unit/markers.test.ts
import { describe, expect, it } from 'vitest';
import { MARKER_END, injectBlock, markerStart, stripOwned } from '../../src/lib/markers.js';

const BLOCK = '## Workflow\n\nrules here';

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
});
