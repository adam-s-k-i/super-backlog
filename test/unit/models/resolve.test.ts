// test/unit/models/resolve.test.ts
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../../src/models/defaults.js';
import { resolveTier } from '../../../src/models/resolve.js';

describe('resolveTier compat shim', () => {
  it('always returns null so the v1 OpenCode plugin leaves the model alone', () => {
    const enabled = { ...defaultConfig(), enabled: true, tiers: { opencode: { standard: 'o/s' } } };
    expect(resolveTier('opencode/claude-opus-4-7', 'workhorse', enabled)).toBeNull();
    expect(resolveTier('kimi-for-coding/k3', 'budget', defaultConfig())).toBeNull();
  });
});
