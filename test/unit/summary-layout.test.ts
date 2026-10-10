// test/unit/summary-layout.test.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkArchitectureText, type Architecture } from '../../src/dashboard/summary-schema.js';
import {
  estimateLabelWidth,
  layoutArchitecture,
  pathD,
  scoreBox,
  slotBox,
  slotsFor,
  type LayoutInput,
} from '../../src/dashboard/summary-layout.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'summary');

function fixture(name: string): Architecture {
  const r = checkArchitectureText(readFileSync(join(FIXTURES, `architecture.${name}.yml`), 'utf8'), name);
  if (r.status !== 'valid') throw new Error(`fixture ${name} is ${r.status}`);
  return r.architecture;
}

function graph(cols: number, rows: number, nodes: [string, number, number][], edges: [string, string][]): LayoutInput {
  return {
    grid: { cols, rows },
    zones: [],
    nodes: nodes.map(([id, c, r]) => ({ id, cell: [c, r] as [number, number] })),
    edges: edges.map(([from, to]) => ({ id: `${from}>${to}`, from, to, label: `${from}-${to}` })),
  };
}

describe('layoutArchitecture: fixtures', () => {
  it.each(['super-backlog', 'kursbuchung'])('%s lays out without crossings, collisions or warnings', (name) => {
    const g = layoutArchitecture(fixture(name));
    expect(g.crossings).toBe(0);
    expect(g.collisions).toBe(0);
    expect(g.warnings).toEqual([]);
    expect(g.width).toBe(2 * 18 + 5 * 156 + 4 * 104);
    expect(g.height).toBe(36 + 5 * 56 + 4 * 48 + 20);
  });

  it('is deterministic across runs and survives a JSON round-trip', () => {
    const a = layoutArchitecture(fixture('super-backlog'));
    const b = layoutArchitecture(fixture('super-backlog'));
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('emits nodes in reading order and edges in input order', () => {
    const arch = fixture('super-backlog');
    const g = layoutArchitecture(arch);
    const order = g.nodes.map((n) => [n.row, n.col]);
    const sorted = [...order].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    expect(order).toEqual(sorted);
    expect(g.edges.map((e) => e.id)).toEqual(arch.edges.map((e) => e.id));
  });

  it('draws zones 12px around their cell range with room for the label', () => {
    const g = layoutArchitecture(fixture('super-backlog'));
    // Kit (sbl): cols [1,3], rows [1,4]
    expect(g.zones[1]).toEqual({ label: 'Kit (sbl)', x: 18 + 260 - 12, y: 36 + 104 - 26, w: 3 * 260 - 104 + 24, h: 3 * 104 + 56 + 26 + 10 });
  });
});

describe('layoutArchitecture: routes', () => {
  it('routes a horizontal neighbour as H, straight', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 0]], [['a', 'b']]));
    const e = g.edges[0];
    expect(e.kind).toBe('H');
    expect(e.points).toEqual([[174, 64], [278, 64]]);
    expect(e.d).toBe('M174,64 L278,64');
  });

  it('routes a vertical neighbour as V', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 0, 1]], [['a', 'b']]));
    expect(g.edges[0].kind).toBe('V');
    expect(g.edges[0].points).toEqual([[96, 92], [96, 140]]);
  });

  it('prefers VH (vertical first) when the corner [from.col, to.row] is free', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 1]], [['a', 'b']]));
    const e = g.edges[0];
    expect(e.kind).toBe('VH');
    expect(e.points).toEqual([[96, 92], [96, 168], [278, 168]]);
    expect(e.d).toBe('M96,92 L96,161 Q96,168 103,168 L278,168');
  });

  it('falls back to HV when only the corner [to.col, from.row] is free', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 1], ['x', 0, 1]], [['a', 'b']]));
    expect(g.edges[0].kind).toBe('HV');
    expect(g.edges[0].fallback).toBe(false);
  });

  it('reports route-fallback for an impossible route and still returns a polyline', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 1], ['x', 0, 1], ['y', 1, 0]], [['a', 'b']]));
    const e = g.edges[0];
    expect(e.fallback).toBe(true);
    expect(e.points.length).toBeGreaterThanOrEqual(2);
    expect(g.warnings).toContainEqual({ code: 'route-fallback', edge: 'a>b', message: expect.stringMatching(/move one of the cells/) });
  });

  it('treats a blocked straight line as impossible when no L route exists', () => {
    const g = layoutArchitecture(graph(3, 2, [['a', 0, 0], ['m', 1, 0], ['b', 2, 0]], [['a', 'b']]));
    expect(g.edges[0].fallback).toBe(true);
  });
});

describe('layoutArchitecture: ports', () => {
  it('spreads ports on one side symmetrically at 18px and never crosses siblings', () => {
    // hub at the top centre fans out to three targets below it; all three leave through the bottom side
    const g = layoutArchitecture(
      graph(3, 3, [['hub', 1, 0], ['l', 0, 1], ['r', 2, 1], ['m', 1, 2]], [['hub', 'r'], ['hub', 'l'], ['hub', 'm']]),
    );
    const start = (id: string): number => (g.edges.find((e) => e.id === id) as { points: number[][] }).points[0][0];
    const cx = 18 + 260 + 78;
    expect([start('hub>l'), start('hub>m'), start('hub>r')]).toEqual([cx - 18, cx, cx + 18]);
    expect(g.crossings).toBe(0);
  });

  it('keeps straight edges straight when the target side has several ports', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 0], ['c', 0, 1]], [['a', 'b'], ['c', 'b']]));
    const ab = g.edges[0];
    expect(ab.kind).toBe('H');
    expect(ab.points[0][1]).toBe(ab.points[1][1]);
  });
});

describe('labels', () => {
  it('estimates widths from the character table, 7px per unknown character, plus 2px', () => {
    expect(estimateLabelWidth('')).toBe(2);
    expect(estimateLabelWidth('…')).toBe(9);
    expect(estimateLabelWidth('ab')).toBeCloseTo(2 * 6.9 + 2);
  });

  it('emits ten candidate slots (five positions x two sides) and the chosen index', () => {
    const g = layoutArchitecture(graph(2, 2, [['a', 0, 0], ['b', 1, 0]], [['a', 'b']]));
    const e = g.edges[0];
    expect(e.candidates).toHaveLength(10);
    expect(e.candidates.slice(0, 2).map((c) => [c.t, c.side])).toEqual([[0.5, 'above'], [0.5, 'below']]);
    expect(e.slot).toBe(0);
    expect(e.score).toBe(0);
  });

  it('scoring prefers the collision-free candidate', () => {
    const seg = { x1: 0, y1: 100, x2: 200, y2: 100, horizontal: true, length: 200 };
    const [above, below] = slotsFor(seg);
    const tw = 40;
    // a node sits right above the middle of the segment
    const ctx = { width: 400, height: 300, nodeBoxes: [{ x0: 80, y0: 60, x1: 120, y1: 98 }], placed: [], foreignSegments: [] };
    expect(scoreBox(slotBox(above, tw).box, ctx)).toBe(3);
    expect(scoreBox(slotBox(below, tw).box, ctx)).toBe(0);
  });

  it('moves a label off a node in a real layout', () => {
    // edge a>b runs left to right two cells long, node c sits directly above the middle of the line
    const g = layoutArchitecture(graph(3, 2, [['a', 0, 1], ['b', 2, 1], ['c', 1, 0]], [['a', 'b']]));
    expect(g.edges[0].kind).toBe('H'); // the straight line passes the free cell [1,1]
    expect(g.collisions).toBe(0);
  });

  it('draws a 7px quadratic bend at the corner', () => {
    expect(pathD([[0, 0], [0, 50], [80, 50]])).toBe('M0,0 L0,43 Q0,50 7,50 L80,50');
  });
});
