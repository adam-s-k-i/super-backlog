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

  it('appends with CRLF into a CRLF file', () => {
    expect(refreshPointer('# Notes\r\n', TPL)).toEqual({ action: 'created', content: crlf(`# Notes\n\n${TPL}`) });
    expect(refreshPointer('# Notes\r\n\r\n', TPL).content).toBe(crlf(`# Notes\n\n${TPL}`));
    expect(refreshPointer('a\r\n# Notes', TPL).content).toBe(`a\r\n# Notes${crlf(`\n\n${TPL}`)}`);
  });

  it('heals a legacy pointer appended with a lone-LF separator into a CRLF file', () => {
    const r = refreshPointer(`# Notes\r\n\n${HEADING}\nOld.\n`, TPL);
    expect(r.action).toBe('replaced');
    expect(r.content).not.toMatch(/(?<!\r)\n/);
  });

  it('heals the line above a legacy pointer separator (no trailing newline before the append)', () => {
    const legacy = `a\r\n# Notes\n\n${HEADING}\nOld.\n`;
    const r = refreshPointer(legacy, TPL);
    expect(r.action).toBe('replaced');
    expect(r.content).not.toMatch(/(?<!\r)\n/);
    expect(r.content).toContain('a\r\n# Notes\r\n');
    expect(refreshPointer(r.content, TPL).action).toBe('unchanged');
  });
});
