// src/dashboard/summary-layout.ts
// Pure, synchronous layout engine for the summary canvas (spec 2026-10-09, L1-L7):
// grid cells -> pixels -> ports -> orthogonal routes -> label slots -> diagnostics.

export const LAYOUT = { w: 156, h: 56, gx: 104, gy: 48, mx: 18, mt: 36, mb: 20, port: 18, bend: 7 } as const;

export type Side = 'T' | 'B' | 'L' | 'R';
export type RouteKind = 'H' | 'V' | 'VH' | 'HV';
export type Point = [number, number];

export interface LayoutInput {
  grid: { cols: number; rows: number };
  zones: readonly { label: string; cols: readonly [number, number]; rows: readonly [number, number] }[];
  nodes: readonly { id: string; cell: readonly [number, number] }[];
  edges: readonly { id: string; from: string; to: string; label: string }[];
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LabelSlot {
  /** position along the segment (0..1) */
  t: number;
  /** 'above' | 'below' for horizontal segments, 'right' | 'left' for vertical ones */
  side: 'above' | 'below' | 'right' | 'left';
  /** anchor point on the line */
  px: number;
  py: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  horizontal: boolean;
  length: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  kind: RouteKind;
  fallback: boolean;
  points: Point[];
  d: string;
  /** longest segment, the one that carries label and step badge */
  segment: Segment;
  labelWidth: number;
  candidates: LabelSlot[];
  slot: number;
  score: number;
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
  /** step badge centre: off every placed label box (see `badgeFor`) */
  badge: { x: number; y: number };
}

export interface LayoutNode {
  id: string;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutZone {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutWarning {
  code: 'route-fallback' | 'label-collision' | 'crossing';
  edge: string;
  message: string;
}

export interface LayoutResult {
  width: number;
  height: number;
  zones: LayoutZone[];
  /** reading order: row, then column (= tab order) */
  nodes: LayoutNode[];
  /** input order */
  edges: LayoutEdge[];
  warnings: LayoutWarning[];
  crossings: number;
  collisions: number;
}

/* ---------- label width estimate: Plus Jakarta Sans 12.5px / 500 ---------- */

const NARROW = { chars: " .,:;'!|iIlj", width: 3.4 };
const SEMI = { chars: 'frt()[]{}/\\-*"', width: 4.6 };
const WIDE = { chars: 'mwMW@', width: 10.6 };
const DIGIT_WIDTH = 7.4;
const UPPER_WIDTH = 8.4;
const LOWER_WIDTH = 6.9;
/** fallback for every character the table does not know (spec L1) */
const FALLBACK_WIDTH = 7;

function charWidth(ch: string): number {
  if (NARROW.chars.includes(ch)) return NARROW.width;
  if (SEMI.chars.includes(ch)) return SEMI.width;
  if (WIDE.chars.includes(ch)) return WIDE.width;
  if (ch >= '0' && ch <= '9') return DIGIT_WIDTH;
  if (ch >= 'A' && ch <= 'Z') return UPPER_WIDTH;
  if (ch >= 'a' && ch <= 'z') return LOWER_WIDTH;
  return FALLBACK_WIDTH;
}

/** Estimated rendered width of an edge label plus 2px breathing room. */
export function estimateLabelWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return round(w + 2);
}

/* ---------- geometry helpers ---------- */

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export const colX = (c: number): number => LAYOUT.mx + c * (LAYOUT.w + LAYOUT.gx);
export const rowY = (r: number): number => LAYOUT.mt + r * (LAYOUT.h + LAYOUT.gy);

/** Box occupied by a label at `slot` with text width `tw` (shared with the client re-scorer). */
export function slotBox(slot: LabelSlot, tw: number): { box: Box; x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const { px, py } = slot;
  switch (slot.side) {
    case 'above':
      return { x: px, y: py - 7, anchor: 'middle', box: { x0: px - tw / 2, y0: py - 20, x1: px + tw / 2, y1: py - 3 } };
    case 'below':
      return { x: px, y: py + 17, anchor: 'middle', box: { x0: px - tw / 2, y0: py + 4, x1: px + tw / 2, y1: py + 21 } };
    case 'right':
      return { x: px + 8, y: py + 4.5, anchor: 'start', box: { x0: px + 4, y0: py - 10.5, x1: px + 8 + tw, y1: py + 10.5 } };
    default:
      return { x: px - 8, y: py + 4.5, anchor: 'end', box: { x0: px - 8 - tw, y0: py - 10.5, x1: px - 4, y1: py + 10.5 } };
  }
}

/** Radius of the step badge circle drawn on an edge. */
export const BADGE_R = 9.5;
/** closest distance of the badge centre to either end of its segment */
const BADGE_END = 12;
/** clearance between the badge circle and its own label */
const BADGE_GAP = 4;
/** scan step along the segment when both spots next to the label are taken */
const BADGE_STEP = 6;

/**
 * Step badge position. Mirrored verbatim by the client in summary.html (drift-guarded by a test).
 * Candidates in order, each tested against every placed label box (`labels`) and the edge's own:
 * on the line just before the label (seen from the segment start), just after it, then every
 * BADGE_STEP px from start to end; if all of those touch a label, the same positions shifted
 * sideways away from the own label so the circle still touches the line. Deterministic.
 */
export function badgeFor(seg: Segment, slot: LabelSlot, tw: number, labels: readonly Box[] = []): { x: number; y: number } {
  const own = slotBox(slot, tw).box;
  const ux = Math.sign(seg.x2 - seg.x1);
  const uy = Math.sign(seg.y2 - seg.y1);
  const a0 = seg.horizontal ? (own.x0 - seg.x1) * ux : (own.y0 - seg.y1) * uy;
  const a1 = seg.horizontal ? (own.x1 - seg.x1) * ux : (own.y1 - seg.y1) * uy;
  const near = Math.min(a0, a1);
  const far = Math.max(a0, a1);
  let lo = BADGE_END;
  let hi = seg.length - BADGE_END;
  if (lo > hi) lo = hi = seg.length / 2;
  const clamp = (d: number): number => Math.min(hi, Math.max(lo, d));
  const along: number[] = [];
  const add = (d: number): void => {
    const c = clamp(d);
    if (!along.includes(c)) along.push(c);
  };
  add(near - BADGE_R - BADGE_GAP);
  add(far + BADGE_R + BADGE_GAP);
  for (let d = lo; d <= hi; d += BADGE_STEP) add(d);
  let ox = 0;
  let oy = 0;
  if (slot.side === 'above') oy = own.y1 + BADGE_R + 1 - slot.py;
  else if (slot.side === 'below') oy = own.y0 - BADGE_R - 1 - slot.py;
  else if (slot.side === 'right') ox = own.x0 - BADGE_R - 1 - slot.px;
  else ox = own.x1 + BADGE_R + 1 - slot.px;
  const at = (d: number, off: boolean): { x: number; y: number } => ({
    x: round(seg.x1 + ux * d + (off ? ox : 0)),
    y: round(seg.y1 + uy * d + (off ? oy : 0)),
  });
  const free = (p: { x: number; y: number }): boolean => {
    const c: Box = { x0: p.x - BADGE_R, y0: p.y - BADGE_R, x1: p.x + BADGE_R, y1: p.y + BADGE_R };
    if (hit(c, own)) return false;
    for (const b of labels) if (hit(c, b)) return false;
    return true;
  };
  for (const off of [false, true]) {
    for (const d of along) {
      const p = at(d, off);
      if (free(p)) return p;
    }
  }
  return at(along[0], true);
}

const SLOT_POSITIONS = [0.5, 0.38, 0.62, 0.26, 0.74] as const;

export function slotsFor(seg: Segment): LabelSlot[] {
  const out: LabelSlot[] = [];
  for (const t of SLOT_POSITIONS) {
    const px = round(seg.x1 + (seg.x2 - seg.x1) * t);
    const py = round(seg.y1 + (seg.y2 - seg.y1) * t);
    if (seg.horizontal) {
      out.push({ t, side: 'above', px, py }, { t, side: 'below', px, py });
    } else {
      out.push({ t, side: 'right', px, py }, { t, side: 'left', px, py });
    }
  }
  return out;
}

const hit = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function segHitsBox(sg: Segment, b: Box): boolean {
  if (sg.horizontal) {
    return sg.y1 >= b.y0 && sg.y1 <= b.y1 && Math.min(sg.x1, sg.x2) < b.x1 && Math.max(sg.x1, sg.x2) > b.x0;
  }
  return sg.x1 >= b.x0 && sg.x1 <= b.x1 && Math.min(sg.y1, sg.y2) < b.y1 && Math.max(sg.y1, sg.y2) > b.y0;
}

/** Score of a label box (spec L5): +5 outside, +3 per node, +2 per placed label, +1 per foreign segment. */
export function scoreBox(
  box: Box,
  ctx: { width: number; height: number; nodeBoxes: readonly Box[]; placed: readonly Box[]; foreignSegments: readonly Segment[] },
): number {
  let s = 0;
  if (box.x0 < 4 || box.x1 > ctx.width - 4 || box.y0 < 2 || box.y1 > ctx.height - 2) s += 5;
  for (const r of ctx.nodeBoxes) if (hit(box, r)) s += 3;
  for (const r of ctx.placed) if (hit(box, r)) s += 2;
  for (const sg of ctx.foreignSegments) if (segHitsBox(sg, box)) s += 1;
  return s;
}

/** Corner bend of `LAYOUT.bend` px as a quadratic curve; straight edges are one line. */
export function pathD(pts: readonly Point[]): string {
  const f = (n: number): string => String(round(n));
  if (pts.length === 2) return `M${f(pts[0][0])},${f(pts[0][1])} L${f(pts[1][0])},${f(pts[1][1])}`;
  const [a, c, b] = pts;
  const r = LAYOUT.bend;
  const d1 = Math.sign(c[0] - a[0]);
  const e1 = Math.sign(c[1] - a[1]);
  const d2 = Math.sign(b[0] - c[0]);
  const e2 = Math.sign(b[1] - c[1]);
  const p1: Point = [c[0] - d1 * r, c[1] - e1 * r];
  const p2: Point = [c[0] + d2 * r, c[1] + e2 * r];
  return `M${f(a[0])},${f(a[1])} L${f(p1[0])},${f(p1[1])} Q${f(c[0])},${f(c[1])} ${f(p2[0])},${f(p2[1])} L${f(b[0])},${f(b[1])}`;
}

/** Two segments of different edges meet at a point that is interior to at least one of them. */
function segmentsCross(a: Segment, b: Segment): boolean {
  if (a.horizontal === b.horizontal) {
    // collinear overlap of positive length
    if (a.horizontal) {
      if (a.y1 !== b.y1) return false;
      const lo = Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2));
      const hi = Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2));
      return hi - lo > 0;
    }
    if (a.x1 !== b.x1) return false;
    const lo = Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2));
    const hi = Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2));
    return hi - lo > 0;
  }
  const h = a.horizontal ? a : b;
  const v = a.horizontal ? b : a;
  const x = v.x1;
  const y = h.y1;
  const inH = x > Math.min(h.x1, h.x2) && x < Math.max(h.x1, h.x2);
  const inV = y > Math.min(v.y1, v.y2) && y < Math.max(v.y1, v.y2);
  const onH = x >= Math.min(h.x1, h.x2) && x <= Math.max(h.x1, h.x2);
  const onV = y >= Math.min(v.y1, v.y2) && y <= Math.max(v.y1, v.y2);
  return onH && onV && (inH || inV);
}

function segmentsOf(points: readonly Point[]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    out.push({ x1, y1, x2, y2, horizontal: y1 === y2, length: Math.abs(x2 - x1) + Math.abs(y2 - y1) });
  }
  return out;
}

function longest(segs: readonly Segment[]): Segment {
  return segs.reduce((m, s) => (s.length > m.length ? s : m), segs[0]);
}

const SIDES: Record<RouteKind, (dx: number, dy: number) => [Side, Side]> = {
  H: (dx) => (dx > 0 ? ['R', 'L'] : ['L', 'R']),
  V: (_dx, dy) => (dy > 0 ? ['B', 'T'] : ['T', 'B']),
  VH: (dx, dy) => [dy > 0 ? 'B' : 'T', dx > 0 ? 'L' : 'R'],
  HV: (dx, dy) => [dx > 0 ? 'R' : 'L', dy > 0 ? 'T' : 'B'],
};

interface WorkNode extends LayoutNode {
  cx: number;
  cy: number;
}

interface WorkEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  index: number;
  s: WorkNode;
  t: WorkNode;
  kind: RouteKind;
  fallback: boolean;
  sSide: Side;
  tSide: Side;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const straight = (ed: WorkEdge): boolean => ed.kind === 'H' || ed.kind === 'V';
const sideKey = (node: WorkNode, side: Side): string => `${node.id}:${side}`;

/** L2: grid cells to pixel boxes. */
function placeNodes(input: LayoutInput): WorkNode[] {
  return input.nodes.map((n) => {
    const x = colX(n.cell[0]);
    const y = rowY(n.cell[1]);
    return { id: n.id, col: n.cell[0], row: n.cell[1], x, y, w: LAYOUT.w, h: LAYOUT.h, cx: x + LAYOUT.w / 2, cy: y + LAYOUT.h / 2 };
  });
}

/** L3: route kind and port sides per edge. */
function chooseRoutes(input: LayoutInput, nodes: readonly WorkNode[]): WorkEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const occupied = new Set(nodes.map((n) => `${n.col},${n.row}`));
  const free = (c: number, r: number): boolean => !occupied.has(`${c},${r}`);
  const clearH = (r: number, c0: number, c1: number): boolean => {
    for (let c = Math.min(c0, c1) + 1; c < Math.max(c0, c1); c++) if (!free(c, r)) return false;
    return true;
  };
  const clearV = (c: number, r0: number, r1: number): boolean => {
    for (let r = Math.min(r0, r1) + 1; r < Math.max(r0, r1); r++) if (!free(c, r)) return false;
    return true;
  };

  return input.edges.map((e, index) => {
    const s = byId.get(e.from);
    const t = byId.get(e.to);
    if (!s || !t) throw new Error(`layout: edge ${e.id} references an unknown node`);
    const dx = t.col > s.col ? 1 : -1;
    const dy = t.row > s.row ? 1 : -1;
    let kind: RouteKind;
    let fallback = false;
    if (s.row === t.row && clearH(s.row, s.col, t.col)) kind = 'H';
    else if (s.col === t.col && clearV(s.col, s.row, t.row)) kind = 'V';
    else if (s.row !== t.row && s.col !== t.col && free(s.col, t.row) && clearV(s.col, s.row, t.row) && clearH(t.row, s.col, t.col)) kind = 'VH';
    else if (s.row !== t.row && s.col !== t.col && free(t.col, s.row) && clearH(s.row, s.col, t.col) && clearV(t.col, s.row, t.row)) kind = 'HV';
    else {
      fallback = true;
      kind = s.col === t.col ? 'V' : s.row === t.row ? 'H' : 'VH';
    }
    const [sSide, tSide] = SIDES[kind](dx, dy);
    return { id: e.id, from: e.from, to: e.to, label: e.label, index, s, t, kind, fallback, sSide, tSide, sx: 0, sy: 0, tx: 0, ty: 0 };
  });
}

interface Port {
  ed: WorkEdge;
  end: 's' | 't';
  key: number;
  tie: string;
}

interface SidePorts {
  node: WorkNode;
  side: Side;
  list: Port[];
  offsets: number[];
}

type StraightGroups = Map<string, { keys: string[]; edges: WorkEdge[] }>;

/** L4 sort key: keeps siblings on one side from crossing each other. */
function sortKey(side: Side, node: WorkNode, other: WorkNode, isStraight: boolean): number {
  if (isStraight) return 0;
  const ox = other.cx;
  const oy = other.cy;
  if (side === 'T') return ox < node.cx ? -1e6 - oy : 1e6 + oy;
  if (side === 'B') return ox < node.cx ? -1e6 + oy : 1e6 - oy;
  if (side === 'L') return oy < node.cy ? -1e6 - ox : 1e6 + ox;
  return oy < node.cy ? -1e6 + ox : 1e6 - ox;
}

/** Ports per node side (`<node>:<side>`), in edge order. */
function collectSides(work: readonly WorkEdge[]): Map<string, Port[]> {
  const sides = new Map<string, Port[]>();
  const addPort = (node: WorkNode, side: Side, ed: WorkEdge, end: 's' | 't', other: WorkNode): void => {
    const k = sideKey(node, side);
    const list = sides.get(k) ?? [];
    list.push({ ed, end, key: sortKey(side, node, other, straight(ed)), tie: `${ed.id}:${end}` });
    sides.set(k, list);
  };
  for (const ed of work) {
    addPort(ed.s, ed.sSide, ed, 's', ed.t);
    addPort(ed.t, ed.tSide, ed, 't', ed.s);
  }
  return sides;
}

// Straight edges must sit at the same offset on both of their sides, so they are placed first.
// Sides joined by straight edges form a group; the group's straight edges share one block of
// port-spaced offsets centred on the mean of the centres each side would choose on its own
// (snapped to half a port step), and every side stacks its bending ports around that block.

/** Union-find over the side keys: sides joined by straight edges form one group. */
function groupStraightSides(work: readonly WorkEdge[], sides: Map<string, Port[]>): StraightGroups {
  const parent = new Map<string, string>([...sides.keys()].map((k) => [k, k]));
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    return r;
  };
  for (const ed of work) {
    if (!straight(ed)) continue;
    const a = find(sideKey(ed.s, ed.sSide));
    const b = find(sideKey(ed.t, ed.tSide));
    if (a !== b) parent.set(cmp(a, b) < 0 ? b : a, cmp(a, b) < 0 ? a : b);
  }
  const groups: StraightGroups = new Map();
  for (const k of sides.keys()) {
    const r = find(k);
    const g = groups.get(r) ?? { keys: [], edges: [] };
    g.keys.push(k);
    groups.set(r, g);
  }
  for (const ed of work) if (straight(ed)) groups.get(find(sideKey(ed.s, ed.sSide)))?.edges.push(ed);
  return groups;
}

/** Offset of every straight edge, shared by both of its ends. */
function straightOffsets(groups: StraightGroups, sides: Map<string, Port[]>): Map<WorkEdge, number> {
  const half = LAYOUT.port / 2;
  const straightOff = new Map<WorkEdge, number>();
  for (const g of groups.values()) {
    if (g.edges.length === 0) continue;
    // a side spread symmetrically puts the centre of its straight block at (bending before - bending after) * half
    const wants = g.keys.map((k) => {
      const l = sides.get(k) as Port[];
      return (l.filter((p) => p.key < 0).length - l.filter((p) => p.key > 0).length) * half;
    });
    // "+ 0" turns -0 into 0, so toEqual and the JSON output stay stable.
    const centre = Math.round(wants.reduce((s, w) => s + w, 0) / wants.length / half) * half + 0;
    // Trade-off: a straight block centred on the snapped mean can sit -9/+9 px off the box
    // centre, even for a lone straight edge. We accept the asymmetry, because the edge must
    // meet the opposite side at the same height to stay straight.
    const block = g.edges.slice().sort((a, b) => cmp(a.id, b.id) || a.index - b.index);
    block.forEach((ed, i) => straightOff.set(ed, centre + (i - (block.length - 1) / 2) * LAYOUT.port));
  }
  return straightOff;
}

/** Sorts `list` in place and returns the offset of each port from the side centre, in list order. */
function sideOffsets(list: Port[], straightOff: Map<WorkEdge, number>): number[] {
  list.sort((a, b) => a.key - b.key || cmp(a.tie, b.tie));
  const fixed = list.flatMap((p) => straightOff.get(p.ed) ?? []);
  const before = list.filter((p) => p.key < 0);
  const after = list.filter((p) => p.key > 0);
  const offset = (pt: Port, i: number): number => {
    if (fixed.length === 0) return (i - (list.length - 1) / 2) * LAYOUT.port;
    const own = straightOff.get(pt.ed);
    if (own !== undefined) return own;
    if (pt.key < 0) return Math.min(...fixed) - (before.length - before.indexOf(pt)) * LAYOUT.port;
    return Math.max(...fixed) + (after.indexOf(pt) + 1) * LAYOUT.port;
  };
  return list.map((pt, i) => offset(pt, i));
}

/** Writes the port coordinates of one side into its edges. */
function placeSidePorts(sp: SidePorts): void {
  const { node, side } = sp;
  sp.list.forEach((pt, i) => {
    const off = sp.offsets[i];
    let x: number;
    let y: number;
    if (side === 'T') [x, y] = [node.cx + off, node.y];
    else if (side === 'B') [x, y] = [node.cx + off, node.y + node.h];
    else if (side === 'L') [x, y] = [node.x, node.cy + off];
    else [x, y] = [node.x + node.w, node.cy + off];
    if (pt.end === 's') [pt.ed.sx, pt.ed.sy] = [x, y];
    else [pt.ed.tx, pt.ed.ty] = [x, y];
  });
}

/** L4: port coordinates of every edge end. */
function assignPorts(work: readonly WorkEdge[], nodes: readonly WorkNode[]): LayoutWarning[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sides = collectSides(work);
  const groups = groupStraightSides(work, sides);
  const straightOff = straightOffsets(groups, sides);
  const perSide = new Map<string, SidePorts>();
  for (const [k, list] of sides) {
    const sep = k.lastIndexOf(':');
    const node = byId.get(k.slice(0, sep)) as WorkNode;
    const side = k.slice(sep + 1) as Side;
    perSide.set(k, { node, side, list, offsets: sideOffsets(list, straightOff) });
  }
  for (const sp of perSide.values()) placeSidePorts(sp);
  // both ends of a straight edge got the same offset and their nodes share a row (H) or column (V)
  return [];
}

interface Routed {
  ed: WorkEdge;
  points: Point[];
  segs: Segment[];
  /** longest segment */
  seg: Segment;
}

/** Orthogonal polylines between the assigned ports. */
function routePolylines(work: readonly WorkEdge[]): Routed[] {
  return work.map((ed) => {
    const { sx, sy, tx, ty } = ed;
    const points: Point[] =
      ed.kind === 'VH' ? [[sx, sy], [sx, ty], [tx, ty]] : ed.kind === 'HV' ? [[sx, sy], [tx, sy], [tx, ty]] : [[sx, sy], [tx, ty]];
    const segs = segmentsOf(points);
    return { ed, points, segs, seg: longest(segs) };
  });
}

interface LabelChoice {
  candidates: LabelSlot[];
  slot: number;
  score: number;
  tw: number;
}

/** L5: labels, longest segment first (stable, id tie-break). */
function placeLabels(
  routed: readonly Routed[],
  nodes: readonly WorkNode[],
  width: number,
  height: number,
): { labels: Map<string, LabelChoice>; placed: Box[] } {
  const nodeBoxes: Box[] = nodes.map((n) => ({ x0: n.x - 1, y0: n.y - 1, x1: n.x + n.w + 1, y1: n.y + n.h + 1 }));
  const placed: Box[] = [];
  const order = routed.slice().sort((a, b) => b.seg.length - a.seg.length || cmp(a.ed.id, b.ed.id));
  const labels = new Map<string, LabelChoice>();
  for (const r of order) {
    const tw = estimateLabelWidth(r.ed.label);
    const candidates = slotsFor(r.seg);
    const foreignSegments = routed.filter((o) => o !== r).flatMap((o) => o.segs);
    let best = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < candidates.length; i++) {
      const s = scoreBox(slotBox(candidates[i], tw).box, { width, height, nodeBoxes, placed, foreignSegments });
      if (s < bestScore) {
        bestScore = s;
        best = i;
        if (s === 0) break;
      }
    }
    placed.push(slotBox(candidates[best], tw).box);
    labels.set(r.ed.id, { candidates, slot: best, score: bestScore, tw });
  }
  return { labels, placed };
}

/** L6: fallback routes, label collisions and crossings. */
function diagnose(
  routed: readonly Routed[],
  labels: Map<string, LabelChoice>,
): { warnings: LayoutWarning[]; crossings: number; collisions: number } {
  const warnings: LayoutWarning[] = [];
  let crossings = 0;
  let collisions = 0;
  for (const r of routed) {
    if (r.ed.fallback) {
      warnings.push({
        code: 'route-fallback',
        edge: r.ed.id,
        message: `no straight or single-corner route from ${r.ed.from} to ${r.ed.to}; move one of the cells`,
      });
    }
  }
  for (const r of routed) {
    const l = labels.get(r.ed.id) as LabelChoice;
    if (l.score > 0) {
      collisions++;
      warnings.push({ code: 'label-collision', edge: r.ed.id, message: `label "${r.ed.label}" overlaps (score ${l.score})` });
    }
  }
  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const a = routed[i];
      const b = routed[j];
      if (a.segs.some((sa) => b.segs.some((sb) => segmentsCross(sa, sb)))) {
        crossings++;
        warnings.push({ code: 'crossing', edge: a.ed.id, message: `${a.ed.id} crosses ${b.ed.id}` });
      }
    }
  }
  return { warnings, crossings, collisions };
}

/** Public edges in input order, with the chosen label slot and step badge. */
function buildEdges(routed: readonly Routed[], labels: Map<string, LabelChoice>, placed: readonly Box[]): LayoutEdge[] {
  return routed.map((r) => {
    const l = labels.get(r.ed.id) as LabelChoice;
    const chosen = slotBox(l.candidates[l.slot], l.tw);
    return {
      id: r.ed.id,
      from: r.ed.from,
      to: r.ed.to,
      kind: r.ed.kind,
      fallback: r.ed.fallback,
      points: r.points.map(([x, y]) => [round(x), round(y)] as Point),
      d: pathD(r.points),
      segment: r.seg,
      labelWidth: l.tw,
      candidates: l.candidates,
      slot: l.slot,
      score: l.score,
      label: { x: round(chosen.x), y: round(chosen.y), anchor: chosen.anchor },
      badge: badgeFor(r.seg, l.candidates[l.slot], l.tw, placed),
    };
  });
}

/** Zone frames around their cell ranges. */
function layoutZones(input: LayoutInput): LayoutZone[] {
  return input.zones.map((z) => {
    const x = colX(z.cols[0]) - 12;
    const y = rowY(z.rows[0]) - 26;
    return { label: z.label, x, y, w: colX(z.cols[1]) + LAYOUT.w + 12 - x, h: rowY(z.rows[1]) + LAYOUT.h + 12 - y };
  });
}

/** Nodes in reading order: row, then column (= tab order). */
function readingOrder(nodes: readonly WorkNode[]): LayoutNode[] {
  return nodes
    .slice()
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map(({ id, col, row, x, y, w, h }) => ({ id, col, row, x, y, w, h }));
}

/** Deterministic layout of a validated architecture (spec L1-L7). */
export function layoutArchitecture(input: LayoutInput): LayoutResult {
  const { cols, rows } = input.grid;
  const width = 2 * LAYOUT.mx + cols * LAYOUT.w + (cols - 1) * LAYOUT.gx;
  const height = LAYOUT.mt + rows * LAYOUT.h + (rows - 1) * LAYOUT.gy + LAYOUT.mb;
  const nodes = placeNodes(input);
  const work = chooseRoutes(input, nodes);
  const portWarnings = assignPorts(work, nodes);
  const routed = routePolylines(work);
  const { labels, placed } = placeLabels(routed, nodes, width, height);
  const diag = diagnose(routed, labels);
  return {
    width,
    height,
    zones: layoutZones(input),
    nodes: readingOrder(nodes),
    edges: buildEdges(routed, labels, placed),
    warnings: [...portWarnings, ...diag.warnings],
    crossings: diag.crossings,
    collisions: diag.collisions,
  };
}
