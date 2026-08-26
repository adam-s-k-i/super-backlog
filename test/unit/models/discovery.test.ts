import { describe, it, expect, vi } from 'vitest';
import {
  parseOpenCodeModels,
  rankTiers,
  discoverModels,
  type ResolvedTiers,
} from '../../../src/models/discovery.js';
import * as runModule from '../../../src/lib/run.js';

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

describe('discoverModels', () => {
  it('returns null when opencode models exits non-zero', async () => {
    const spy = vi.spyOn(runModule, 'runCapture').mockReturnValue({ status: 1, stdout: '', stderr: 'not found' });
    const result = await discoverModels('/tmp');
    expect(result).toBeNull();
    spy.mockRestore();
  });

  it('resolves workhorse and budget from opencode output', async () => {
    const spy = vi.spyOn(runModule, 'runCapture').mockReturnValue({
      status: 0,
      stdout: 'opencode/kimi-k3\nopencode/kimi-k2.7-code\nopencode/kimi-k2.5\n',
      stderr: '',
    });
    const result = (await discoverModels('/tmp')) as ResolvedTiers;
    expect(result).not.toBeNull();
    expect(result.workhorse).toBe('opencode/kimi-k2.7-code');
    expect(result.budget).toBe('opencode/kimi-k2.5');
    expect(result.discoveredAt).toMatch(/^\d{4}-/);
    spy.mockRestore();
  });
});
