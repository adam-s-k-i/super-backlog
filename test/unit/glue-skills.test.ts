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
    expect(t).toContain('sbl dashboard');
    expect(t).not.toContain('--serve');
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
  it('is the session entry with per-phase resume behavior', () => {
    expect(t).toContain('sbl phase');
    expect(t).toMatch(/resume/i);
    expect(t).toMatch(/phase\/(spec|plan|impl|verify)/);
  });
});

describe('installed backlog-status-report skills', () => {
  it('do not advertise sbl dashboard --serve', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    for (const rel of [
      join('.opencode', 'skill', 'backlog-status-report', 'SKILL.md'),
      join('.claude', 'skills', 'backlog-status-report', 'SKILL.md'),
    ]) {
      const t = readFileSync(join(root, rel), 'utf8');
      expect(t).toContain('sbl dashboard');
      expect(t).not.toContain('--serve');
    }
  });
});

describe('all glue skills exist', () => {
  it('all four glue skill templates are present', () => {
    for (const f of [
      'skill-spec-to-backlog.md',
      'skill-backlog-status-report.md',
      'skill-task-review-gate.md',
      'skill-architecture-summary.md',
    ]) {
      expect(existsSync(join(tplDir, f))).toBe(true);
    }
  });
});

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
  it('runs on drift and fixes the sbl summary findings', () => {
    expect(t).toMatch(/^- `sbl summary` reports drift\.$/m);
    expect(t).toContain('run `sbl summary` first');
    // the template wraps at about 80 columns, so match across line breaks
    expect(t).toMatch(/prune `tasks` entries for Done or unknown\s+tasks/i);
    expect(t).toMatch(/finish when it exits 0, or 4 only for warnings the user\s+accepts/i);
  });
  it('explains that stale-file drift clears once the file is committed', () => {
    expect(t).toMatch(/until check 5 reports\s+`\[ok\]`, or only its drift line remains/i);
    expect(t).toMatch(/`stale-file` finding clears only once the refreshed file is\s+committed/i);
  });
  it('links the schema reference', () => {
    expect(t).toContain('https://adam-s-k-i.github.io/super-backlog/guide/project-summary');
  });
});
