import { describe, it, expect } from 'vitest';
import { parseOpenCodeModels, rankTiers } from '../../../src/models/discovery.js';

describe('parseOpenCodeModels', () => {
  it('extracts model ids from opencode models output', () => {
    const output = 'opencode/kimi-k3\nopencode/kimi-k2.7-code\nopencode/gpt-5-nano\n';
    expect(parseOpenCodeModels(output)).toEqual([
      'opencode/kimi-k3',
      'opencode/kimi-k2.7-code',
      'opencode/gpt-5-nano',
    ]);
  });
});

describe('rankTiers', () => {
  it('picks the strongest available workhorse and cheapest available budget', () => {
    const result = rankTiers(['opencode/kimi-k3', 'opencode/kimi-k2.7-code', 'opencode/kimi-k2.5']);
    expect(result.workhorse).toBe('opencode/kimi-k2.7-code');
    expect(result.budget).toBe('opencode/kimi-k2.5');
  });
});
