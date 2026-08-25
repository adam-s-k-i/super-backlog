import { describe, expect, it } from 'vitest';
import { PLUGIN_SPEC, applyPluginEntry } from '../../src/lib/opencode.js';

describe('applyPluginEntry', () => {
  it('creates config with plugin array when file was empty object', () => {
    const r = applyPluginEntry({});
    expect(r.changed).toBe(true);
    expect(r.config.plugin).toEqual([PLUGIN_SPEC]);
  });
  it('appends once, preserves other plugins and keys', () => {
    const input = { theme: 'dark', plugin: ['other@x'] };
    const r = applyPluginEntry(input);
    expect(r.config.theme).toBe('dark');
    expect(r.config.plugin).toEqual(['other@x', PLUGIN_SPEC]);
    const again = applyPluginEntry(r.config);
    expect(again.changed).toBe(false);
    expect(again.config.plugin).toHaveLength(2);
  });
  it('refuses near-miss entries that look like ours', () => {
    const input = { plugin: ['superpowers@git+https://example.com/fork.git'] };
    expect(() => applyPluginEntry(input)).toThrow(/refusing/i);
  });
});
