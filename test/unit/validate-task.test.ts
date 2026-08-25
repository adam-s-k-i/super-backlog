import { describe, expect, it } from 'vitest';
import { validateTaskMarkdown } from '../../src/lib/validate-task.js';

const ok = (id: string) =>
  `---\nid: ${id}\ntitle: Something\nstatus: To Do\ncreated: 2026-08-25T00:00:00Z\n---\n\nbody\n`;

describe('validateTaskMarkdown', () => {
  it('accepts a well-formed task', () => {
    expect(validateTaskMarkdown('TASK-1.md', ok('TASK-1'))).toEqual([]);
  });
  it('rejects missing frontmatter', () => {
    const errs = validateTaskMarkdown('TASK-1.md', '# just markdown');
    expect(errs.join(' ')).toMatch(/frontmatter/i);
  });
  it('rejects id/filename mismatch', () => {
    const errs = validateTaskMarkdown('TASK-2.md', ok('TASK-1'));
    expect(errs.join(' ')).toMatch(/id.*TASK-1.*does not match.*TASK-2/i);
  });
  it('accepts backlog.md style filename stem with title suffix, case-insensitively', () => {
    expect(validateTaskMarkdown('task-1 - some-title-slug.md', ok('TASK-1'))).toEqual([]);
    expect(validateTaskMarkdown('TASK-1 - Some Title.md', ok('TASK-1'))).toEqual([]);
  });
  it('rejects wrong id even with title suffix', () => {
    const errs = validateTaskMarkdown('task-2 - other.md', ok('TASK-1'));
    expect(errs.join(' ')).toMatch(/does not match filename stem 'task-2'/i);
  });
  it('rejects empty title', () => {
    const errs = validateTaskMarkdown('TASK-1.md', ok('TASK-1').replace('title: Something', 'title: ""'));
    expect(errs.join(' ')).toMatch(/title/i);
  });
});
