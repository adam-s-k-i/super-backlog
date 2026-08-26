// test/unit/layering.test.ts
import { describe, expect, it } from 'vitest';

import { assignLayers } from '../../src/dashboard/layering.js';

describe('assignLayers', () => {
  it('assigns depth 1+max(prereqs) along a linear chain', () => {
    const layers = assignLayers(
      ['A', 'B', 'C'],
      [
        { from: 'B', to: 'A' },
        { from: 'C', to: 'B' },
      ],
    );
    expect([...layers.entries()]).toEqual([
      ['A', 1],
      ['B', 2],
      ['C', 3],
    ]);
  });

  it('converges a diamond on the deepest prerequisite path', () => {
    const layers = assignLayers(
      ['A', 'B', 'C', 'D'],
      [
        { from: 'D', to: 'B' },
        { from: 'D', to: 'C' },
        { from: 'B', to: 'A' },
        { from: 'C', to: 'A' },
      ],
    );
    expect(layers.get('A')).toBe(1);
    expect(layers.get('B')).toBe(2);
    expect(layers.get('C')).toBe(2);
    expect(layers.get('D')).toBe(3);
  });

  it('gives a pure cycle finite layers without crashing', () => {
    const layers = assignLayers(
      ['A', 'B', 'C'],
      [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ],
    );
    expect(layers.size).toBe(3);
    for (const depth of layers.values()) {
      expect(Number.isInteger(depth)).toBe(true);
      expect(depth).toBeGreaterThanOrEqual(1);
      expect(depth).toBeLessThanOrEqual(3);
    }
  });

  it('appends cycle members to the deepest safe layer and keeps downstream nodes after them', () => {
    const layers = assignLayers(
      ['A', 'B', 'C', 'X'],
      [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
        { from: 'X', to: 'A' },
      ],
    );
    expect(layers.get('A')).toBe(1);
    expect(layers.get('B')).toBe(1);
    expect(layers.get('C')).toBe(1);
    expect(layers.get('X')).toBe(2);
  });

  it('tolerates a self-dependency as a one-node cycle', () => {
    const layers = assignLayers(['A'], [{ from: 'A', to: 'A' }]);
    expect(layers.get('A')).toBe(1);
  });

  it('ignores dangling references in either direction', () => {
    const layers = assignLayers(
      ['A', 'B'],
      [
        { from: 'B', to: 'Ghost' },
        { from: 'Ghost', to: 'A' },
      ],
    );
    expect(layers.size).toBe(2);
    expect(layers.get('A')).toBe(1);
    expect(layers.get('B')).toBe(1);
  });

  it('returns keys in input node order so renderers can tie-break deterministically', () => {
    const layers = assignLayers(['Z', 'M', 'A'], []);
    expect([...layers.keys()]).toEqual(['Z', 'M', 'A']);
    for (const key of layers.keys()) expect(layers.get(key)).toBe(1);
  });
});
