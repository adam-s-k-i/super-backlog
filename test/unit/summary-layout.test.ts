// test/unit/summary-layout.test.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkArchitectureText, type Architecture } from '../../src/dashboard/summary-schema.js';
import {
  badgeFor,
  BADGE_R,
  colX,
  estimateLabelWidth,
  layoutArchitecture,
  pathD,
  scoreBox,
  slotBox,
  slotsFor,
  type Box,
  type LayoutEdge,
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
    expect(g.zones[1]).toEqual({ label: 'Kit (sbl)', x: 18 + 260 - 12, y: 36 + 104 - 26, w: 3 * 260 - 104 + 24, h: 3 * 104 + 56 + 26 + 12 });
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

  const edge = (g: ReturnType<typeof layoutArchitecture>, id: string): LayoutEdge => {
    const e = g.edges.find((x) => x.id === id);
    if (!e) throw new Error(`no edge ${id}`);
    return e;
  };
  const orthogonal = (pts: readonly (readonly number[])[]): boolean =>
    pts.every((p, i) => i === 0 || p[0] === pts[i - 1][0] || p[1] === pts[i - 1][1]);

  it('keeps straight edges straight when the target side has several ports', () => {
    // b's left side receives the straight a>b and the VH c>b (corner [1,0] is free); a's right side has one port
    const g = layoutArchitecture(graph(3, 2, [['a', 0, 0], ['b', 2, 0], ['c', 1, 1]], [['a', 'b'], ['c', 'b']]));
    const ab = edge(g, 'a>b');
    const cb = edge(g, 'c>b');
    expect([ab.kind, cb.kind]).toEqual(['H', 'VH']);
    const bLeft = colX(2);
    expect(ab.points.at(-1)?.[0]).toBe(bLeft);
    expect(cb.points.at(-1)?.[0]).toBe(bLeft);
    expect(ab.points[0][1]).toBe(ab.points[1][1]);
    // c>b comes from below, so it sits below a>b, one full port step away
    expect((cb.points.at(-1)?.[1] ?? 0) - (ab.points.at(-1)?.[1] ?? 0)).toBeGreaterThanOrEqual(18);
    expect(g.crossings).toBe(0);
  });

  it('never puts a straight edge onto a sibling port when both of its sides are busy', () => {
    // regression: a's right side holds a>b and a>e, b's left side holds a>b and d>b
    const g = layoutArchitecture(
      graph(3, 3, [['a', 0, 1], ['b', 2, 1], ['d', 1, 0], ['e', 1, 2], ['x', 0, 2]], [['a', 'b'], ['a', 'e'], ['d', 'b']]),
    );
    const ab = edge(g, 'a>b');
    const db = edge(g, 'd>b');
    expect([ab.kind, edge(g, 'a>e').kind, db.kind]).toEqual(['H', 'HV', 'VH']);
    for (const e of g.edges) expect(orthogonal(e.points)).toBe(true);
    expect(ab.points[0][1]).toBe(ab.points[1][1]);
    const bLeft = colX(2);
    expect(ab.points.at(-1)?.[0]).toBe(bLeft);
    expect(db.points.at(-1)?.[0]).toBe(bLeft);
    expect(Math.abs((ab.points.at(-1)?.[1] ?? 0) - (db.points.at(-1)?.[1] ?? 0))).toBeGreaterThanOrEqual(18);
    // every port stays on its node's side
    const b = g.nodes.find((n) => n.id === 'b') as { y: number; h: number };
    for (const e of [ab, db]) {
      const y = e.points.at(-1)?.[1] ?? 0;
      expect(y).toBeGreaterThan(b.y);
      expect(y).toBeLessThan(b.y + b.h);
    }
    expect(g.crossings).toBe(0);
    expect(g.warnings).toEqual([]);
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
    // a>b runs down column 1 through the free cell [1,1]; node n sits right of the line's middle,
    // and the label is long enough that the first candidate (middle, right) reaches into n
    const input = graph(3, 3, [['a', 1, 0], ['b', 1, 2], ['n', 2, 1]], [['a', 'b']]);
    const label = 'publishes the release notes to the changelog';
    const g = layoutArchitecture({ ...input, edges: [{ ...input.edges[0], label }] });
    const e = g.edges[0];
    expect(e.kind).toBe('V');
    const n = g.nodes.find((x) => x.id === 'n') as { x: number; y: number; w: number; h: number };
    const first = slotBox(e.candidates[0], estimateLabelWidth(label)).box;
    expect([e.candidates[0].t, e.candidates[0].side]).toEqual([0.5, 'right']);
    expect(first.x1 > n.x && first.x0 < n.x + n.w && first.y1 > n.y && first.y0 < n.y + n.h).toBe(true);
    expect(e.slot).not.toBe(0);
    expect(e.score).toBe(0);
    expect(g.collisions).toBe(0);
  });

  it('draws a 7px quadratic bend at the corner', () => {
    expect(pathD([[0, 0], [0, 50], [80, 50]])).toBe('M0,0 L0,43 Q0,50 7,50 L80,50');
  });
});

/* ---------- step badges (F5): never on an edge label, direction-aware, mirrored on the client ---------- */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function fromFile(path: string): Architecture {
  const r = checkArchitectureText(readFileSync(path, 'utf8'), path);
  if (r.status !== 'valid') throw new Error(`${path} is ${r.status}`);
  return r.architecture;
}

const SOURCES: [string, () => Architecture][] = [
  ['backlog/docs/architecture.yml', () => fromFile(join(ROOT, 'backlog', 'docs', 'architecture.yml'))],
  ['fixture super-backlog', () => fixture('super-backlog')],
  ['fixture kursbuchung', () => fixture('kursbuchung')],
];

function labelBoxes(edges: readonly LayoutEdge[]): Box[] {
  return edges.map((e) => slotBox(e.candidates[e.slot], e.labelWidth).box);
}

/** Exact circle/rectangle intersection (touching does not count). */
function circleHitsBox(cx: number, cy: number, r: number, b: Box): boolean {
  const nx = Math.max(b.x0, Math.min(cx, b.x1));
  const ny = Math.max(b.y0, Math.min(cy, b.y1));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

function badgeOverlaps(edges: readonly LayoutEdge[], ids: readonly string[]): string[] {
  const boxes = labelBoxes(edges);
  const byId = new Map(edges.map((e) => [e.id, e]));
  const out: string[] = [];
  for (const id of ids) {
    const e = byId.get(id);
    if (!e) throw new Error(`unknown edge ${id}`);
    boxes.forEach((b, i) => {
      if (circleHitsBox(e.badge.x, e.badge.y, BADGE_R, b)) out.push(`badge of ${id} covers the label of ${edges[i].id}`);
    });
  }
  return out;
}

const WIDE_LABEL = 'publishes the release notes';

const SYNTHETIC: [string, LayoutInput][] = [
  ['vertical neighbours', graph(1, 2, [['a', 0, 0], ['b', 0, 1]], [['a', 'b']])],
  ['vertical neighbours, upwards', graph(1, 2, [['a', 0, 0], ['b', 0, 1]], [['b', 'a']])],
  ['horizontal neighbours', graph(2, 1, [['a', 0, 0], ['b', 1, 0]], [['a', 'b']])],
  ['horizontal neighbours, leftwards', graph(2, 1, [['a', 0, 0], ['b', 1, 0]], [['b', 'a']])],
  [
    'horizontal neighbours, wide label',
    { ...graph(2, 1, [['a', 0, 0], ['b', 1, 0]], [['a', 'b']]), edges: [{ id: 'a>b', from: 'a', to: 'b', label: WIDE_LABEL }] },
  ],
  ['L route', graph(3, 3, [['a', 0, 0], ['b', 2, 2]], [['a', 'b']])],
];

describe('step badges', () => {
  it.each(SOURCES)('%s: no flow-step badge circle (r 9.5) intersects any edge label box', (_name, load) => {
    const arch = load();
    const g = layoutArchitecture(arch);
    const steps = [...new Set(arch.flows.flatMap((f) => f.steps))];
    expect(steps.length).toBeGreaterThan(0);
    expect(badgeOverlaps(g.edges, steps)).toEqual([]);
  });

  it.each(SYNTHETIC)('%s: the badge stays off every label', (_name, input) => {
    const g = layoutArchitecture(input);
    expect(badgeOverlaps(g.edges, g.edges.map((e) => e.id))).toEqual([]);
  });

  it('vertical neighbours (48 px gap): the badge leaves the line sideways, away from the label, but still touches it', () => {
    const e = layoutArchitecture(SYNTHETIC[0][1]).edges[0];
    expect(e.segment.horizontal).toBe(false);
    const slot = e.candidates[e.slot];
    expect(slot.side).toBe('right');
    expect(e.badge.x).toBeLessThan(slot.px);
    expect(slot.px - e.badge.x).toBeLessThan(BADGE_R);
    expect(e.badge.y).toBeGreaterThanOrEqual(Math.min(e.segment.y1, e.segment.y2));
    expect(e.badge.y).toBeLessThanOrEqual(Math.max(e.segment.y1, e.segment.y2));
  });

  it('respects the edge direction: the badge sits between the segment start and the label', () => {
    const right = layoutArchitecture(SYNTHETIC[2][1]).edges[0];
    const left = layoutArchitecture(SYNTHETIC[3][1]).edges[0];
    expect(right.segment.x1).toBeLessThan(right.segment.x2);
    expect(right.badge.x).toBeLessThan(right.label.x);
    expect(right.badge.y).toBe(right.segment.y1);
    expect(left.segment.x1).toBeGreaterThan(left.segment.x2);
    expect(left.badge.x).toBeGreaterThan(left.label.x);
    expect(left.badge.y).toBe(left.segment.y1);
    const down = layoutArchitecture(SYNTHETIC[0][1]).edges[0];
    const up = layoutArchitecture(SYNTHETIC[1][1]).edges[0];
    expect(down.badge.y).toBeLessThan(down.candidates[down.slot].py);
    expect(up.badge.y).toBeGreaterThan(up.candidates[up.slot].py);
  });

  it('keeps the badge on the line when a free spot exists, and avoids labels of other edges', () => {
    const seg = { x1: 0, y1: 100, x2: 400, y2: 100, horizontal: true, length: 400 };
    const slot = slotsFor(seg)[0];
    const own = slotBox(slot, 40).box;
    expect(badgeFor(seg, slot, 40, [own])).toEqual({ x: 166.5, y: 100 });
    // a foreign label right where the badge would go pushes it past its own label
    const foreign: Box = { x0: 150, y0: 90, x1: 175, y1: 110 };
    const b = badgeFor(seg, slot, 40, [own, foreign]);
    expect(b.y).toBe(100);
    expect(circleHitsBox(b.x, b.y, BADGE_R, own) || circleHitsBox(b.x, b.y, BADGE_R, foreign)).toBe(false);
    expect(b.x).toBeGreaterThan(own.x1);
  });
});

/** The client mirror in summary.html, extracted between its markers and evaluated in isolation. */
function clientMirror(): { slotBox: typeof slotBox; badgeFor: typeof badgeFor } {
  const html = readFileSync(join(ROOT, 'src', 'templates', 'summary.html'), 'utf8');
  const m = /\/\* sbl:badge-mirror:start \*\/([\s\S]*?)\/\* sbl:badge-mirror:end \*\//.exec(html);
  if (!m) throw new Error('badge mirror markers not found in summary.html');
  return new Function(`${m[1]}\nreturn { slotBox: slotBox, badgeFor: badgeFor };`)() as { slotBox: typeof slotBox; badgeFor: typeof badgeFor };
}

describe('client mirror of slotBox/badgeFor (summary.html)', () => {
  const inputs: [string, () => LayoutInput][] = [...SOURCES, ...SYNTHETIC.map(([n, i]) => [n, () => i] as [string, () => LayoutInput])];

  it.each(inputs)('%s: client and server compute identical label boxes and badge positions', (_name, load) => {
    const client = clientMirror();
    const g = layoutArchitecture(load());
    const boxes = labelBoxes(g.edges);
    for (const e of g.edges) {
      for (const c of e.candidates) expect(client.slotBox(c, e.labelWidth)).toEqual(slotBox(c, e.labelWidth));
      const server = badgeFor(e.segment, e.candidates[e.slot], e.labelWidth, boxes);
      expect(server).toEqual(e.badge);
      expect(client.badgeFor(e.segment, e.candidates[e.slot], e.labelWidth, boxes)).toEqual(server);
      // measured widths differ from the estimate; the mirror must agree for those too
      const tw = e.labelWidth * 1.13;
      expect(client.badgeFor(e.segment, e.candidates[e.slot], tw, boxes)).toEqual(badgeFor(e.segment, e.candidates[e.slot], tw, boxes));
    }
  });
});
