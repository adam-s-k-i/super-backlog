import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
  it('carries the harness-neutral model routing rule', () => {
    expect(t).toContain('### Model routing for subagents');
    expect(t).toMatch(/regardless of which model the current session runs on/);
    for (const tier of ['**Light**', '**Standard**', '**Top**']) {
      expect(t).toContain(tier);
    }
    expect(t).toMatch(/Set the model explicitly on every dispatch/);
    expect(t).toMatch(/^6\. Delegate by tier/m);
    expect(t).toContain('Claude Code:');
    expect(t).toContain('OpenCode:');
    expect(t).toContain('Other harnesses:');
  });
  it('keeps the project-gates note as the closing line', () => {
    expect(t.trimEnd().endsWith('Add project-specific human gates below the block.')).toBe(true);
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
  const p = read('claude-pointer.md');
  it('points at the AGENTS.md block', () => {
    expect(p).toMatch(/AGENTS\.md/);
  });
  it('points at the model routing section and the explicit model parameter', () => {
    expect(p).toContain('"Model routing for subagents"');
    expect(p).toContain("Agent tool's `model` explicitly");
  });
  it('is a single section (refresh ends the section at the next heading)', () => {
    expect(p.match(/^#{1,6}\s/gm)).toHaveLength(1);
  });
});

describe('template frontmatter', () => {
  // Claude Code drops the whole frontmatter when it is invalid YAML and falls back to the first
  // body line as the skill description. A plain (unquoted) scalar must not contain ': ' or ' #'.
  const withFrontmatter = readdirSync(tplDir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => read(f).startsWith('---\n') || read(f).startsWith('---\r\n'));

  it('covers every skill and agent template', () => {
    expect(withFrontmatter.filter((f) => f.startsWith('skill-')).length).toBeGreaterThanOrEqual(3);
    expect(withFrontmatter.some((f) => f.includes('agent-'))).toBe(true);
  });

  it.each(withFrontmatter)('%s has only valid plain-scalar values', (f) => {
    const block = read(f).split(/\r?\n---\r?\n/)[0].replace(/^---\r?\n/, '');
    for (const line of block.split(/\r?\n/)) {
      const m = /^([A-Za-z_][\w-]*):(?: (.*))?$/.exec(line);
      expect(m, `${f}: not a "key: value" line: ${line}`).not.toBeNull();
      const value = (m?.[2] ?? '').trim();
      if (/^(['"]).*\1$/.test(value)) continue;
      expect(value, `${f}: unquoted ': ' in ${m?.[1]}`).not.toMatch(/: |:$/);
      expect(value, `${f}: unquoted ' #' in ${m?.[1]}`).not.toMatch(/ #/);
    }
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
