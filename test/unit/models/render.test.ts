// test/unit/models/render.test.ts
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../../src/models/defaults.js';
import { normalizeConfig } from '../../../src/models/config.js';
import { DEFAULT_MODEL_EXAMPLES, renderModelExamples, wrapListItem } from '../../../src/models/render.js';

const TODAY = [
  'Examples (current as of this super-backlog release):',
  '',
  "- Claude Code: the Agent tool's `model` parameter — light `haiku`, standard",
  '  `sonnet`, strong `opus`, top = the strongest available model (e.g. Fable).',
  "- OpenCode: set the tier's model on the subagent, e.g. the `model` field of",
  '  an agent in `.opencode/agents/`.',
  '- Other harnesses: the equivalent per-subagent model setting.',
].join('\n');

describe('renderModelExamples', () => {
  it('is byte-identical to the static paragraph without a config', () => {
    expect(DEFAULT_MODEL_EXAMPLES).toBe(TODAY);
    expect(renderModelExamples(defaultConfig())).toBe(TODAY);
  });

  it('is byte-identical to the static paragraph when disabled, whatever is configured', () => {
    const cfg = normalizeConfig({ version: 2, enabled: false, tiers: { claude: { top: 'mythos' }, opencode: { light: 'o/l' } } });
    expect(renderModelExamples(cfg)).toBe(TODAY);
  });

  it('renders the spec example for an enabled configuration', () => {
    const cfg = normalizeConfig({
      version: 2,
      enabled: true,
      tiers: {
        claude: { light: 'haiku', standard: 'sonnet', strong: 'opus', top: 'fable' },
        opencode: { light: 'opencode/gemini-3.5-flash-lite', standard: 'opencode/claude-sonnet-4-6' },
      },
    });
    expect(renderModelExamples(cfg)).toBe(
      [
        'Examples (from `.super-backlog/models.json`; change them with',
        '`sbl models set <harness> <tier> <model>`):',
        '',
        "- Claude Code: the Agent tool's `model` parameter — light `haiku`, standard",
        '  `sonnet`, strong `opus`, top `fable`.',
        '- OpenCode: the `sbl-<tier>` agents in `.opencode/agents/` — light',
        '  `opencode/gemini-3.5-flash-lite`, standard `opencode/claude-sonnet-4-6`;',
        '  tiers without a model use the session model.',
        '- Other harnesses: the equivalent per-subagent model setting.',
      ].join('\n'),
    );
  });

  it('omits the session-model clause when all four OpenCode tiers are set', () => {
    const cfg = normalizeConfig({
      version: 2,
      enabled: true,
      tiers: {
        opencode: {
          light: 'opencode/claude-haiku-4-5',
          standard: 'opencode/claude-sonnet-4-6',
          strong: 'opencode/claude-opus-4-7',
          top: 'opencode/fable-1',
        },
      },
    });
    const text = renderModelExamples(cfg);
    expect(text).toContain(
      [
        '- OpenCode: the `sbl-<tier>` agents in `.opencode/agents/` — light',
        '  `opencode/claude-haiku-4-5`, standard `opencode/claude-sonnet-4-6`, strong',
        '  `opencode/claude-opus-4-7`, top `opencode/fable-1`.',
      ].join('\n'),
    );
    expect(text).not.toContain('session model');
  });

  it('uses Claude defaults for unset tiers and the default OpenCode item without OpenCode tiers', () => {
    const text = renderModelExamples(normalizeConfig({ version: 2, enabled: true, tiers: { claude: { top: 'mythos' } } }));
    expect(text).toContain("- Claude Code: the Agent tool's `model` parameter — light `haiku`, standard\n  `sonnet`, strong `opus`, top `mythos`.");
    expect(text).toContain("- OpenCode: set the tier's model on the subagent, e.g. the `model` field of\n  an agent in `.opencode/agents/`.");
  });

  it('keeps every line within 79 characters and never splits a model id', () => {
    const long = `p/${'a'.repeat(98)}`;
    const cfg = normalizeConfig({ version: 2, enabled: true, tiers: { opencode: { light: long, strong: 'opencode/claude-opus-4-7' } } });
    const lines = renderModelExamples(cfg).split('\n');
    // the 103-character word "`p/aaa…`," cannot share a line, so it stands alone on a continuation line
    expect(lines).toContain(`  \`${long}\`,`);
    for (const line of lines) {
      if (!line.includes(long)) expect(line.length, line).toBeLessThanOrEqual(79);
    }
  });
});

describe('wrapListItem', () => {
  it('wraps greedily with a two-space continuation indent', () => {
    expect(wrapListItem(`one ${'x'.repeat(70)} two three`)).toBe(`- one ${'x'.repeat(70)}\n  two three`);
  });
});
