// test/unit/glue-skills.test.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tplDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'templates');
const read = (f: string) => readFileSync(join(tplDir, f), 'utf8');

describe('skill-backlog-status-report.md', () => {
  const t = read('skill-backlog-status-report.md');
  it('has frontmatter with name and description', () => {
    expect(t.startsWith('---')).toBe(true);
    expect(t).toMatch(/^name: backlog-status-report$/m);
    expect(t).toMatch(/^description: .+/m);
  });
  it('is read-only and CLI-driven', () => {
    expect(t).toContain('task list --json');
    expect(t).toMatch(/read-only/i);
    expect(t).toMatch(/never change task status/i);
  });
  it('points to the visual surfaces', () => {
    expect(t).toContain('sbl dashboard --serve');
    expect(t).toContain('backlog browser');
  });
});

describe('skill-task-review-gate.md', () => {
  const t = read('skill-task-review-gate.md');
  it('has frontmatter with name and description', () => {
    expect(t.startsWith('---')).toBe(true);
    expect(t).toMatch(/^name: task-review-gate$/m);
    expect(t).toMatch(/^description: .+/m);
  });
  it('presents the task and stops for explicit approval', () => {
    expect(t).toContain('backlog task view');
    expect(t).toMatch(/STOP and wait/i);
    expect(t).toMatch(/explicit approval/i);
  });
  it('never self-approves', () => {
    expect(t).toMatch(/never approve the gate yourself/i);
  });
});

describe('all glue skills exist', () => {
  it('spec-to-backlog plus the two new skills are present', () => {
    for (const f of [
      'skill-spec-to-backlog.md',
      'skill-backlog-status-report.md',
      'skill-task-review-gate.md',
    ]) {
      expect(existsSync(join(tplDir, f))).toBe(true);
    }
  });
});
