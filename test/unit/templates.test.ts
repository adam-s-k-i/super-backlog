import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tplDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'templates');
const read = (f: string) => readFileSync(join(tplDir, f), 'utf8');

describe('workflow-block.md', () => {
  const t = read('workflow-block.md');
  it('exists with version token', () => {
    expect(t).toContain('{{VERSION}}');
  });
  it('defines roles, nine phases, four rules', () => {
    expect(t).toMatch(/Backlog\.md = WHAT/);
    expect(t).toMatch(/Superpowers = HOW/);
    for (const phase of ['brainstorming', 'design gate', 'spec-to-backlog', 'review gate', 'plan-before-code', 'TDD implementation', 'verification & final summary', 'merge & archive']) {
      expect(t.toLowerCase()).toContain(phase.toLowerCase());
    }
    expect(t).toMatch(/[Nn]o task, no code/);
    expect(t).toMatch(/[Pp]lan before code/);
    expect(t).toMatch(/verification evidence/);
    expect(t).toMatch(/[Ss]kills take precedence/);
  });
  it('points project-specific gates below the block', () => {
    expect(t).toMatch(/below the block/i);
  });
  it('maps phases to labels and mandates sbl phase', () => {
    for (const label of ['phase/spec', 'phase/plan', 'phase/impl', 'phase/verify']) {
      expect(t).toContain(label);
    }
    expect(t).toContain('sbl phase');
    expect(t).toMatch(/only via `sbl phase <id> <phase>`/);
  });
});

describe('skill-spec-to-backlog.md', () => {
  const t = read('skill-spec-to-backlog.md');
  it('has frontmatter with name and description', () => {
    expect(t.startsWith('---')).toBe(true);
    expect(t).toMatch(/^name: spec-to-backlog$/m);
    expect(t).toMatch(/^description: .+/m);
  });
  it('covers triggers, prerequisites, flags, boundaries', () => {
    expect(t).toContain('writing-plans');
    expect(t).toContain('backlog instructions overview');
    expect(t).toContain('--ac');
    expect(t).toContain('--dep');
    expect(t).toMatch(/review gate/i);
    expect(t).toMatch(/never hand-edit/i);
  });
  it('creates tasks with the spec phase label', () => {
    expect(t).toContain('phase/spec');
    expect(t).toContain('sbl phase');
    expect(t).toMatch(/--labels feature/);
  });
});

describe('claude-pointer.md', () => {
  it('points at the AGENTS.md block', () => {
    expect(read('claude-pointer.md')).toMatch(/AGENTS\.md/);
  });
});

describe('all templates exist', () => {
  it('no stray placeholders other than {{VERSION}}', () => {
    for (const f of ['workflow-block.md', 'skill-spec-to-backlog.md', 'claude-pointer.md']) {
      expect(existsSync(join(tplDir, f))).toBe(true);
      expect(read(f)).not.toMatch(/TBD|TODO/);
    }
  });
});
