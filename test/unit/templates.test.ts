import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { agentsBlockContents } from '../../src/init/planner.js';
import { DEFAULT_MODEL_EXAMPLES } from '../../src/models/render.js';
import { renderAgentFile } from '../../src/models/agents.js';

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
  it('carries the four-tier delegation rule', () => {
    expect(t).toContain('### Model tiers and delegation');
    expect(t).not.toContain('Model routing for subagents');
    expect(t).toMatch(/regardless of the session model/);
    for (const tier of ['**Light**', '**Standard**', '**Strong**', '**Top**']) {
      expect(t).toContain(tier);
    }
    expect(t).toMatch(/When unsure between two tiers, take the higher one\./);
    expect(t).toMatch(/Set the model explicitly on every dispatch/);
    expect(t).toMatch(/Delegate only when it pays off/);
    expect(t).toMatch(/do not retry on the same tier/);
    expect(t).toMatch(/"Independent\s+check"/);
    expect(t).toContain('`backlog/docs/critical-areas.md`');
    expect(t).toContain('6. Delegate by tier — every subtask goes to the cheapest model that solves it reliably (see "Model tiers and delegation" below).');
    expect(t).toContain('{{MODEL_EXAMPLES}}');
    expect(t).not.toContain('Examples (current as of this super-backlog release):');
  });
  it('renders today\'s example paragraph byte-identically without a router config', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'sbl-tpl-'));
    try {
      const rendered = agentsBlockContents('9.9.9', cwd);
      expect(rendered).toContain(
        [
          'Examples (current as of this super-backlog release):',
          '',
          '- Claude Code: the Agent tool\'s `model` parameter — light `haiku`, standard',
          '  `sonnet`, strong `opus`, top = the strongest available model (e.g. Fable).',
          '- OpenCode: set the tier\'s model on the subagent, e.g. the `model` field of',
          '  an agent in `.opencode/agents/`.',
          '- Other harnesses: the equivalent per-subagent model setting.',
        ].join('\n'),
      );
      expect(rendered).not.toContain('{{');
      // nothing else in the block changes: undoing both substitutions gives the template back
      expect(rendered.replace(DEFAULT_MODEL_EXAMPLES, '{{MODEL_EXAMPLES}}').replace(/9\.9\.9/g, '{{VERSION}}')).toBe(
        t.replace(/\r\n/g, '\n'),
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
  it('binds rule 8: respect the project profile, only with consent', () => {
    expect(t).toContain(
      '8. Respect the project profile — read `backlog/docs/critical-areas.md` at session start; its entries override the tier rule. If the file is missing, offer once, before the first non-trivial task, to run the project-profile skill. Never run it without the user\'s consent.',
    );
    expect(t.indexOf('8. Respect the project profile')).toBeGreaterThan(t.indexOf('7. Keep the project summary current'));
    expect(t.indexOf('8. Respect the project profile')).toBeLessThan(t.indexOf('### Model tiers and delegation'));
  });
  it('binds rule 7: keep the project summary current, only with consent', () => {
    expect(t).toContain(
      '7. Keep the project summary current — at session start, if `backlog/docs/architecture.yml` is missing, offer once to run the architecture-summary skill. At the end of the pipeline, after a merge, run `sbl summary --check`; if it reports drift, offer a refresh. Never run the skill without the user\'s consent.',
    );
    expect(t.indexOf('7. Keep the project summary current')).toBeGreaterThan(t.indexOf('6. Delegate by tier'));
    expect(t.indexOf('7. Keep the project summary current')).toBeLessThan(t.indexOf('8. Respect the project profile'));
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
  it('points at the delegation section, the profile and the explicit model parameter', () => {
    expect(p).toContain('"Model tiers and delegation"');
    expect(p).toContain('`backlog/docs/critical-areas.md`');
    expect(p).toContain("Agent tool's `model` explicitly");
  });
  it('is a single section (refresh ends the section at the next heading)', () => {
    expect(p.match(/^#{1,6}\s/gm)).toHaveLength(1);
  });
});

// Claude Code drops the whole frontmatter when it is invalid YAML and falls back to the first
// body line as the skill description. A plain (unquoted) scalar must not contain ': ' or ' #'.
function expectPlainScalars(name: string, text: string): void {
  const block = text.split(/\r?\n---\r?\n/)[0].replace(/^---\r?\n/, '');
  for (const line of block.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):(?: (.*))?$/.exec(line);
    expect(m, `${name}: not a "key: value" line: ${line}`).not.toBeNull();
    const value = (m?.[2] ?? '').trim();
    if (/^(['"]).*\1$/.test(value)) continue;
    expect(value, `${name}: unquoted ': ' in ${m?.[1]}`).not.toMatch(/: |:$/);
    expect(value, `${name}: unquoted ' #' in ${m?.[1]}`).not.toMatch(/ #/);
  }
}

describe('template frontmatter', () => {
  const withFrontmatter = readdirSync(tplDir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => read(f).startsWith('---\n') || read(f).startsWith('---\r\n'));

  it('covers every skill template', () => {
    expect(withFrontmatter.filter((f) => f.startsWith('skill-')).length).toBeGreaterThanOrEqual(3);
  });

  it.each(withFrontmatter)('%s has only valid plain-scalar values', (f) => {
    expectPlainScalars(f, read(f));
  });
});

describe('router agent frontmatter', () => {
  const cases = (['claude', 'opencode'] as const).flatMap((h) =>
    (['light', 'standard', 'strong', 'top'] as const).map((t) => [h, t] as const),
  );

  it.each(cases)('%s sbl-%s has only valid plain-scalar values', (harness, tier) => {
    expectPlainScalars(`${harness}/sbl-${tier}`, renderAgentFile(harness, tier, 'openrouter/meta-llama/llama-4:free'));
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
