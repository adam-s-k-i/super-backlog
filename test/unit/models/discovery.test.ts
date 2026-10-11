// test/unit/models/discovery.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as runModule from '../../../src/lib/run.js';
import { discoverModels, parseOpenCodeModels, rankFourTiers } from '../../../src/models/discovery.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseOpenCodeModels', () => {
  it('extracts provider/model ids and ignores other lines', () => {
    expect(parseOpenCodeModels('opencode/kimi-k3\r\n  opencode/gpt-5-nano  \nnot-a-model\n\n')).toEqual([
      'opencode/kimi-k3',
      'opencode/gpt-5-nano',
    ]);
  });
});

describe('rankFourTiers', () => {
  it('ranks Claude ids into all four tiers, top falling back to strong', () => {
    expect(rankFourTiers(['opencode/claude-haiku-4-5', 'opencode/claude-sonnet-4-6', 'opencode/claude-opus-4-7'])).toEqual({
      light: 'opencode/claude-haiku-4-5',
      standard: 'opencode/claude-sonnet-4-6',
      strong: 'opencode/claude-opus-4-7',
      top: 'opencode/claude-opus-4-7',
    });
  });

  it('excludes light matches from the other tiers', () => {
    expect(
      rankFourTiers([
        'opencode/gpt-5.1-codex',
        'opencode/gpt-5-nano',
        'opencode/gemini-3.5-flash-lite',
        'opencode/gemini-3.5-flash',
        'opencode/kimi-k2.5',
      ]),
    ).toEqual({
      light: 'opencode/gemini-3.5-flash-lite',
      standard: 'opencode/gemini-3.5-flash',
      strong: 'opencode/gpt-5.1-codex',
      top: 'opencode/gpt-5.1-codex',
    });
  });

  it('matches case-insensitively', () => {
    expect(rankFourTiers(['X/FABLE-1', 'x/opus-4']).top).toBe('X/FABLE-1');
  });

  it('lets earlier patterns win over list order', () => {
    expect(rankFourTiers(['p/claude-opus-4', 'p/fable-2']).top).toBe('p/fable-2');
  });

  it('leaves tiers without a match unset', () => {
    expect(rankFourTiers(['x/opus-mini'])).toEqual({ light: 'x/opus-mini' });
    expect(rankFourTiers([])).toEqual({});
  });

  it('returns keys in tier order', () => {
    const ranked = rankFourTiers(['p/fable-2', 'p/claude-sonnet-4-6', 'p/claude-haiku-4-5', 'p/claude-opus-4']);
    expect(Object.keys(ranked)).toEqual(['light', 'standard', 'strong', 'top']);
  });
});

describe('discoverModels', () => {
  it('returns null when opencode models exits non-zero', async () => {
    vi.spyOn(runModule, 'runCapture').mockReturnValue({ status: 1, stdout: '', stderr: 'not found' });
    expect(await discoverModels('/tmp')).toBeNull();
  });

  it('ranks valid ids and timestamps the result', async () => {
    vi.spyOn(runModule, 'runCapture').mockReturnValue({
      status: 0,
      stdout: 'opencode/claude-haiku-4-5\nbad`id/sonnet\nopencode/claude-sonnet-4-6\n',
      stderr: '',
    });
    const result = await discoverModels('/tmp');
    expect(result?.tiers).toEqual({ light: 'opencode/claude-haiku-4-5', standard: 'opencode/claude-sonnet-4-6' });
    expect(result?.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns null when nothing ranks', async () => {
    vi.spyOn(runModule, 'runCapture').mockReturnValue({ status: 0, stdout: 'foo/bar\n', stderr: '' });
    expect(await discoverModels('/tmp')).toBeNull();
  });

  it('returns null when the command throws', async () => {
    vi.spyOn(runModule, 'runCapture').mockImplementation(() => {
      throw new Error('spawn failed');
    });
    expect(await discoverModels('/tmp')).toBeNull();
  });
});
