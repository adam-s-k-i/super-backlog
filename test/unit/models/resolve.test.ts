import { describe, it, expect } from 'vitest';
import { resolveTier, detectFamily } from '../../../src/models/resolve.js';
import { DEFAULT_CONFIG, type RouterConfig } from '../../../src/models/types.js';

describe('resolveTier', () => {
  it('returns null when disabled', () => {
    expect(resolveTier('kimi-for-coding/k3', 'budget', DEFAULT_CONFIG)).toBeNull();
  });

  it('picks budget tier from same family in family mode', () => {
    const cfg: RouterConfig = { ...DEFAULT_CONFIG, enabled: true, mode: 'family' };
    expect(resolveTier('kimi-for-coding/k3', 'budget', cfg)).toBe('opencode/kimi-k2.5');
    expect(resolveTier('kimi-for-coding/k3', 'workhorse', cfg)).toBe('opencode/kimi-k2.7-code');
  });

  it('uses individual overrides', () => {
    const cfg: RouterConfig = {
      ...DEFAULT_CONFIG,
      enabled: true,
      mode: 'individual',
      individual: { workhorse: 'xai/grok-4.5', budget: 'xai/grok-4.3' },
    };
    expect(resolveTier('kimi-for-coding/k3', 'budget', cfg)).toBe('xai/grok-4.3');
  });
});

describe('detectFamily', () => {
  it('detects known families case-insensitively', () => {
    expect(detectFamily('opencode/kimi-k2.5')).toBe('kimi');
    expect(detectFamily('xai/grok-4.5')).toBe('grok');
    expect(detectFamily('Claude-Sonnet-4-6')).toBe('claude');
    expect(detectFamily('GOOGLE/gemini-3.5')).toBe('gemini');
    expect(detectFamily('OpenAI/gpt-5')).toBe('gpt');
  });

  it('returns null for unknown families', () => {
    expect(detectFamily('foo/bar')).toBeNull();
  });
});
