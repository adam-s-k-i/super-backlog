// src/dashboard/summary-schema.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseYamlSubset, YamlSubsetError, type YamlValue } from '../lib/yamlmini.js';

/** Curated architecture file, relative to the project root (spec 2026-10-09, "architecture.yml schema"). */
export const ARCHITECTURE_PATH = 'backlog/docs/architecture.yml';

export const COLOR_TOKENS = ['accent', 'ok', 'warn', 'violet', 'rose', 'muted', 'dim'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export const ID_RE = /^[a-z][a-z0-9-]{0,31}$/;
const STEP_RE = /^([a-z][a-z0-9-]{0,31})>([a-z][a-z0-9-]{0,31})$/;
const FLOW_COLORS: readonly ColorToken[] = ['accent', 'ok', 'warn', 'violet', 'rose'];

export const LIMITS = {
  pitch: 400,
  gridMin: 2,
  gridMax: 8,
  kinds: 6,
  kindLabel: 28,
  zones: 16,
  zoneLabel: 40,
  nodesMin: 2,
  nodes: 40,
  nodeLabel: 28,
  nodeSub: 32,
  prose: 600,
  files: 12,
  file: 200,
  nodeCommands: 6,
  run: 200,
  note: 80,
  edges: 120,
  edgeLabel: 24,
  edgeText: 300,
  flows: 12,
  flowLabel: 28,
  flowText: 300,
  steps: 12,
  highlights: 12,
  highlightTitle: 60,
  highlightText: 300,
  stack: 40,
  stackName: 40,
  stackGroup: 24,
  stackRole: 120,
  stackVersion: 40,
  commandGroups: 6,
  commandsPerGroup: 8,
  commandGroup: 40,
} as const;

export interface ArchKind {
  label: string;
  color: ColorToken;
  dashed: boolean;
}

export interface ArchZone {
  label: string;
  cols: [number, number];
  rows: [number, number];
}

export interface ArchCommand {
  run: string;
  note?: string;
}

export interface ArchNode {
  id: string;
  label: string;
  sub?: string;
  kind: string;
  cell: [number, number];
  purpose?: string;
  why?: string;
  files: string[];
  commands: ArchCommand[];
}

export interface ArchEdge {
  /** `<from>><to>`, unique per file */
  id: string;
  from: string;
  to: string;
  label: string;
  text?: string;
}

export interface ArchFlow {
  id: string;
  label: string;
  color: ColorToken;
  command?: string;
  text?: string;
  /** edge ids `<from>><to>` in order */
  steps: string[];
}

export interface ArchHighlight {
  /** 1-based list position, drawn as the badge number on `node` */
  badge: number;
  node: string;
  title: string;
  text: string;
}

export interface ArchStackEntry {
  name: string;
  group: string;
  package?: string;
  version?: string;
  role?: string;
  nodes: string[];
}

export interface Architecture {
  schema: 1;
  pitch: string;
  grid: { cols: number; rows: number };
  kinds: Record<string, ArchKind>;
  zones: ArchZone[];
  nodes: ArchNode[];
  edges: ArchEdge[];
  flows: ArchFlow[];
  highlights: ArchHighlight[];
  stack: ArchStackEntry[];
  commands: Record<string, ArchCommand[]>;
  /** upper-cased task id -> node id */
  tasks: Record<string, string>;
}

export interface SchemaProblem {
  path: string;
  message: string;
  level: 'error' | 'warning';
}

export type ArchitectureLoadResult =
  | { status: 'missing'; path: string }
  | { status: 'invalid'; path: string; problems: SchemaProblem[] }
  | { status: 'valid'; path: string; architecture: Architecture; problems: SchemaProblem[] };

export const DEFAULT_KINDS: Readonly<Record<string, ArchKind>> = {
  actor: { label: 'Actor', color: 'muted', dashed: false },
  core: { label: 'Core', color: 'accent', dashed: false },
  output: { label: 'Output', color: 'ok', dashed: false },
  optional: { label: 'Optional', color: 'violet', dashed: false },
  external: { label: 'External', color: 'dim', dashed: true },
};

type YamlMap = { [key: string]: YamlValue };

function isMap(v: YamlValue | undefined): v is YamlMap {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class Collector {
  readonly problems: SchemaProblem[] = [];
  error(path: string, message: string): void {
    this.problems.push({ path, message, level: 'error' });
  }
  warn(path: string, message: string): void {
    this.problems.push({ path, message, level: 'warning' });
  }
  get hasErrors(): boolean {
    return this.problems.some((p) => p.level === 'error');
  }

  unknownKeys(map: YamlMap, path: string, allowed: readonly string[]): void {
    for (const key of Object.keys(map)) {
      if (!allowed.includes(key)) this.warn(path === '' ? key : `${path}.${key}`, 'unknown key, ignored');
    }
  }

  str(map: YamlMap, key: string, path: string, max: number, opts: { required?: boolean; singleLine?: boolean } = {}): string | undefined {
    const p = path === '' ? key : `${path}.${key}`;
    const v = map[key];
    if (v === undefined || v === null) {
      if (opts.required) this.error(p, 'required');
      return undefined;
    }
    if (typeof v === 'number') return this.checkLen(String(v), p, max, opts.singleLine);
    if (typeof v !== 'string') {
      this.error(p, 'expected a string');
      return undefined;
    }
    const trimmed = v.replace(/\n+$/, '');
    if (trimmed.trim() === '') {
      if (opts.required) this.error(p, 'must not be empty');
      return undefined;
    }
    return this.checkLen(trimmed, p, max, opts.singleLine);
  }

  private checkLen(v: string, path: string, max: number, singleLine = true): string | undefined {
    if (singleLine && v.includes('\n')) {
      this.error(path, 'must be a single line');
      return undefined;
    }
    if (v.length > max) {
      this.error(path, `at most ${max} characters (found ${v.length})`);
      return undefined;
    }
    return v;
  }

  list(map: YamlMap, key: string, path: string, max: number, required = false, min = 0): YamlValue[] {
    const p = path === '' ? key : `${path}.${key}`;
    const v = map[key];
    if (v === undefined || v === null) {
      if (required) this.error(p, 'required');
      return [];
    }
    if (!Array.isArray(v)) {
      this.error(p, 'expected a list');
      return [];
    }
    if (v.length > max) {
      this.error(p, `at most ${max} entries (found ${v.length})`);
      return [];
    }
    if (v.length < min) {
      this.error(p, `at least ${min} entries (found ${v.length})`);
    }
    return v;
  }

  intPair(v: YamlValue | undefined, path: string, what: string): [number, number] | null {
    if (v === undefined || v === null) {
      this.error(path, 'required');
      return null;
    }
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number' && Number.isInteger(n))) {
      this.error(path, `expected [${what}] with two integers`);
      return null;
    }
    return [v[0] as number, v[1] as number];
  }
}

function readCommand(c: Collector, v: YamlValue, path: string): ArchCommand | null {
  if (!isMap(v)) {
    c.error(path, 'expected { run, note? }');
    return null;
  }
  c.unknownKeys(v, path, ['run', 'note']);
  const run = c.str(v, 'run', path, LIMITS.run, { required: true, singleLine: true });
  const note = c.str(v, 'note', path, LIMITS.note, { singleLine: true });
  if (run === undefined) return null;
  return note === undefined ? { run } : { run, note };
}

function readKinds(c: Collector, root: YamlMap): Record<string, ArchKind> {
  const raw = root.kinds;
  if (raw === undefined || raw === null) return { ...DEFAULT_KINDS };
  if (!isMap(raw)) {
    c.error('kinds', 'expected a mapping of kind id to { label, color, dashed? }');
    return {};
  }
  const keys = Object.keys(raw);
  if (keys.length === 0) {
    c.error('kinds', 'must define at least one kind (omit the key to use the default set)');
    return {};
  }
  if (keys.length > LIMITS.kinds) {
    c.error('kinds', `at most ${LIMITS.kinds} entries (found ${keys.length})`);
    return {};
  }
  const out: Record<string, ArchKind> = {};
  for (const id of keys) {
    const path = `kinds.${id}`;
    if (!ID_RE.test(id)) {
      c.error(path, 'kind id must match ^[a-z][a-z0-9-]{0,31}$');
      continue;
    }
    const v = raw[id];
    if (!isMap(v)) {
      c.error(path, 'expected { label, color, dashed? }');
      continue;
    }
    c.unknownKeys(v, path, ['label', 'color', 'dashed']);
    const label = c.str(v, 'label', path, LIMITS.kindLabel, { required: true, singleLine: true });
    const color = v.color;
    if (typeof color !== 'string' || !(COLOR_TOKENS as readonly string[]).includes(color)) {
      c.error(`${path}.color`, `must be one of ${COLOR_TOKENS.join(', ')}`);
      continue;
    }
    if (v.dashed !== undefined && v.dashed !== null && typeof v.dashed !== 'boolean') {
      c.error(`${path}.dashed`, 'expected true or false');
      continue;
    }
    if (label === undefined) continue;
    out[id] = { label, color: color as ColorToken, dashed: v.dashed === true };
  }
  return out;
}

function inRange(n: number, max: number): boolean {
  return n >= 0 && n < max;
}

/**
 * Validates parsed YAML against the architecture schema. `taskIds` (from the
 * backlog) enables the unknown-task-id warning; pass undefined to skip it.
 */
export function validateArchitecture(
  value: YamlValue,
  taskIds?: readonly string[],
): { architecture: Architecture | null; problems: SchemaProblem[] } {
  const c = new Collector();
  if (!isMap(value)) {
    c.error('(root)', 'expected a mapping with schema, pitch, grid, nodes and edges');
    return { architecture: null, problems: c.problems };
  }
  const root = value;
  c.unknownKeys(root, '', ['schema', 'pitch', 'grid', 'kinds', 'zones', 'nodes', 'edges', 'flows', 'highlights', 'stack', 'commands', 'tasks']);

  if (root.schema === undefined || root.schema === null) c.error('schema', 'required (use schema: 1)');
  else if (root.schema !== 1) c.error('schema', 'unsupported schema version (expected 1)');

  const pitch = c.str(root, 'pitch', '', LIMITS.pitch, { required: true, singleLine: false });

  let grid: { cols: number; rows: number } | null = null;
  if (!isMap(root.grid)) {
    c.error('grid', root.grid === undefined ? 'required' : 'expected { cols, rows }');
  } else {
    c.unknownKeys(root.grid, 'grid', ['cols', 'rows']);
    const { cols, rows } = root.grid;
    const ok = (n: YamlValue | undefined): n is number =>
      typeof n === 'number' && Number.isInteger(n) && n >= LIMITS.gridMin && n <= LIMITS.gridMax;
    if (!ok(cols)) c.error('grid.cols', `expected an integer from ${LIMITS.gridMin} to ${LIMITS.gridMax}`);
    if (!ok(rows)) c.error('grid.rows', `expected an integer from ${LIMITS.gridMin} to ${LIMITS.gridMax}`);
    if (ok(cols) && ok(rows)) grid = { cols, rows };
  }
  const gridText = grid ? `${grid.cols}x${grid.rows}` : '';

  const kinds = readKinds(c, root);

  // zones
  const zones: ArchZone[] = [];
  c.list(root, 'zones', '', LIMITS.zones).forEach((z, i) => {
    const path = `zones[${i}]`;
    if (!isMap(z)) {
      c.error(path, 'expected { label, cols, rows }');
      return;
    }
    c.unknownKeys(z, path, ['label', 'cols', 'rows']);
    const label = c.str(z, 'label', path, LIMITS.zoneLabel, { required: true, singleLine: true });
    const cols = c.intPair(z.cols, `${path}.cols`, 'first, last');
    const rows = c.intPair(z.rows, `${path}.rows`, 'first, last');
    if (label === undefined || cols === null || rows === null || grid === null) return;
    if (cols[0] > cols[1] || rows[0] > rows[1]) {
      c.error(path, 'ranges must be [first, last] with first <= last');
      return;
    }
    if (!inRange(cols[0], grid.cols) || !inRange(cols[1], grid.cols) || !inRange(rows[0], grid.rows) || !inRange(rows[1], grid.rows)) {
      c.error(path, `outside grid ${gridText}`);
      return;
    }
    const clash = zones.findIndex(
      (o) => o.cols[0] <= cols[1] && cols[0] <= o.cols[1] && o.rows[0] <= rows[1] && rows[0] <= o.rows[1],
    );
    if (clash !== -1) {
      c.error(path, `overlaps zones[${clash}] (${zones[clash].label})`);
      return;
    }
    zones.push({ label, cols, rows });
  });

  // nodes
  const nodes: ArchNode[] = [];
  const nodeIds = new Set<string>();
  const cells = new Map<string, string>();
  c.list(root, 'nodes', '', LIMITS.nodes, true, LIMITS.nodesMin).forEach((n, i) => {
    const path = `nodes[${i}]`;
    if (!isMap(n)) {
      c.error(path, 'expected a mapping with id, label, kind and cell');
      return;
    }
    c.unknownKeys(n, path, ['id', 'label', 'sub', 'kind', 'cell', 'purpose', 'why', 'files', 'commands']);
    let ok = true;
    const id = n.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      c.error(`${path}.id`, id === undefined ? 'required' : 'must match ^[a-z][a-z0-9-]{0,31}$');
      ok = false;
    } else if (nodeIds.has(id)) {
      c.error(`${path}.id`, `duplicate id "${id}"`);
      ok = false;
    }
    const label = c.str(n, 'label', path, LIMITS.nodeLabel, { required: true, singleLine: true });
    const sub = c.str(n, 'sub', path, LIMITS.nodeSub, { singleLine: true });
    const kind = n.kind;
    if (typeof kind !== 'string') {
      c.error(`${path}.kind`, 'required');
      ok = false;
    } else if (!Object.prototype.hasOwnProperty.call(kinds, kind)) {
      c.error(`${path}.kind`, `unknown kind "${kind}" (known: ${Object.keys(kinds).join(', ')})`);
      ok = false;
    }
    const cell = c.intPair(n.cell, `${path}.cell`, 'col, row');
    if (cell !== null && grid !== null) {
      if (!inRange(cell[0], grid.cols) || !inRange(cell[1], grid.rows)) {
        c.error(`${path}.cell`, `outside grid ${gridText}`);
        ok = false;
      } else {
        const key = `${cell[0]},${cell[1]}`;
        const other = cells.get(key);
        if (other !== undefined) {
          c.error(`${path}.cell`, `cell [${key}] is already used by "${other}"`);
          ok = false;
        } else if (typeof id === 'string') {
          cells.set(key, id);
        }
      }
    }
    const purpose = c.str(n, 'purpose', path, LIMITS.prose, { singleLine: false });
    const why = c.str(n, 'why', path, LIMITS.prose, { singleLine: false });
    const files: string[] = [];
    c.list(n, 'files', path, LIMITS.files).forEach((f, j) => {
      if (typeof f !== 'string' || f.trim() === '') c.error(`${path}.files[${j}]`, 'expected a non-empty string');
      else if (f.length > LIMITS.file) c.error(`${path}.files[${j}]`, `at most ${LIMITS.file} characters`);
      else files.push(f);
    });
    const commands: ArchCommand[] = [];
    c.list(n, 'commands', path, LIMITS.nodeCommands).forEach((cmd, j) => {
      const parsed = readCommand(c, cmd, `${path}.commands[${j}]`);
      if (parsed) commands.push(parsed);
    });
    if (typeof id === 'string' && ID_RE.test(id)) nodeIds.add(id);
    if (!ok || label === undefined || cell === null || typeof id !== 'string' || typeof kind !== 'string') return;
    const node: ArchNode = { id, label, kind, cell, files, commands };
    if (sub !== undefined) node.sub = sub;
    if (purpose !== undefined) node.purpose = purpose;
    if (why !== undefined) node.why = why;
    nodes.push(node);
  });

  // edges
  const edges: ArchEdge[] = [];
  const edgeIds = new Set<string>();
  c.list(root, 'edges', '', LIMITS.edges, true, 1).forEach((e, i) => {
    const path = `edges[${i}]`;
    if (!isMap(e)) {
      c.error(path, 'expected { from, to, label, text? }');
      return;
    }
    c.unknownKeys(e, path, ['from', 'to', 'label', 'text']);
    const label = c.str(e, 'label', path, LIMITS.edgeLabel, { required: true, singleLine: true });
    const text = c.str(e, 'text', path, LIMITS.edgeText, { singleLine: false });
    let ok = label !== undefined;
    for (const end of ['from', 'to'] as const) {
      const v = e[end];
      if (typeof v !== 'string') {
        c.error(`${path}.${end}`, 'required');
        ok = false;
      } else if (!nodeIds.has(v)) {
        c.error(`${path}.${end}`, `unknown node "${v}"`);
        ok = false;
      }
    }
    if (!ok) return;
    const from = e.from as string;
    const to = e.to as string;
    if (from === to) {
      c.error(path, 'from and to must differ');
      return;
    }
    const id = `${from}>${to}`;
    if (edgeIds.has(id)) {
      c.error(path, `duplicate edge ${from} -> ${to}`);
      return;
    }
    edgeIds.add(id);
    const edge: ArchEdge = { id, from, to, label: label as string };
    if (text !== undefined) edge.text = text;
    edges.push(edge);
  });

  // flows
  const flows: ArchFlow[] = [];
  const flowIds = new Set<string>();
  c.list(root, 'flows', '', LIMITS.flows).forEach((f, i) => {
    const path = `flows[${i}]`;
    if (!isMap(f)) {
      c.error(path, 'expected { id, label, steps, color?, command?, text? }');
      return;
    }
    c.unknownKeys(f, path, ['id', 'label', 'color', 'command', 'text', 'steps']);
    const id = f.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      c.error(`${path}.id`, id === undefined ? 'required' : 'must match ^[a-z][a-z0-9-]{0,31}$');
      return;
    }
    if (flowIds.has(id)) {
      c.error(`${path}.id`, `duplicate id "${id}"`);
      return;
    }
    flowIds.add(id);
    const label = c.str(f, 'label', path, LIMITS.flowLabel, { required: true, singleLine: true });
    const command = c.str(f, 'command', path, LIMITS.run, { singleLine: true });
    const text = c.str(f, 'text', path, LIMITS.flowText, { singleLine: false });
    let color: ColorToken = FLOW_COLORS[i % FLOW_COLORS.length];
    if (f.color !== undefined && f.color !== null) {
      if (typeof f.color !== 'string' || !(COLOR_TOKENS as readonly string[]).includes(f.color)) {
        c.error(`${path}.color`, `must be one of ${COLOR_TOKENS.join(', ')}`);
        return;
      }
      color = f.color as ColorToken;
    }
    const steps: string[] = [];
    let missing: string | null = null;
    const rawSteps = c.list(f, 'steps', path, LIMITS.steps, true, 1);
    let malformed = false;
    rawSteps.forEach((s, j) => {
      if (typeof s !== 'string' || !STEP_RE.test(s)) {
        c.error(`${path}.steps[${j}]`, 'expected "from>to" with two node ids');
        malformed = true;
        return;
      }
      if (!edgeIds.has(s) && missing === null) missing = s;
      steps.push(s);
    });
    if (label === undefined || malformed || rawSteps.length === 0) return;
    if (missing !== null) {
      c.warn(`${path}.steps`, `no edge ${missing}; flow "${id}" dropped`);
      return;
    }
    const flow: ArchFlow = { id, label, color, steps };
    if (command !== undefined) flow.command = command;
    if (text !== undefined) flow.text = text;
    flows.push(flow);
  });

  // highlights
  const highlights: ArchHighlight[] = [];
  const badged = new Map<string, number>();
  c.list(root, 'highlights', '', LIMITS.highlights).forEach((h, i) => {
    const path = `highlights[${i}]`;
    if (!isMap(h)) {
      c.error(path, 'expected { node, title, text }');
      return;
    }
    c.unknownKeys(h, path, ['node', 'title', 'text']);
    const title = c.str(h, 'title', path, LIMITS.highlightTitle, { required: true, singleLine: true });
    const text = c.str(h, 'text', path, LIMITS.highlightText, { required: true, singleLine: false });
    const node = h.node;
    if (typeof node !== 'string') {
      c.error(`${path}.node`, 'required');
      return;
    }
    if (!nodeIds.has(node)) {
      c.error(`${path}.node`, `unknown node "${node}"`);
      return;
    }
    const prev = badged.get(node);
    if (prev !== undefined) {
      c.error(`${path}.node`, `node "${node}" already carries highlight ${prev}`);
      return;
    }
    badged.set(node, i + 1);
    if (title === undefined || text === undefined) return;
    highlights.push({ badge: i + 1, node, title, text });
  });

  // stack
  const stack: ArchStackEntry[] = [];
  c.list(root, 'stack', '', LIMITS.stack).forEach((s, i) => {
    const path = `stack[${i}]`;
    if (!isMap(s)) {
      c.error(path, 'expected { name, group, package?, version?, role?, nodes }');
      return;
    }
    c.unknownKeys(s, path, ['name', 'group', 'package', 'version', 'role', 'nodes']);
    const name = c.str(s, 'name', path, LIMITS.stackName, { required: true, singleLine: true });
    const group = c.str(s, 'group', path, LIMITS.stackGroup, { required: true, singleLine: true });
    const pkg = c.str(s, 'package', path, 214, { singleLine: true });
    const version = c.str(s, 'version', path, LIMITS.stackVersion, { singleLine: true });
    const role = c.str(s, 'role', path, LIMITS.stackRole, { singleLine: true });
    const used: string[] = [];
    c.list(s, 'nodes', path, LIMITS.nodes).forEach((n, j) => {
      if (typeof n !== 'string') c.error(`${path}.nodes[${j}]`, 'expected a node id');
      else if (!nodeIds.has(n)) c.warn(`${path}.nodes[${j}]`, `unknown node "${n}", ignored`);
      else used.push(n);
    });
    if (name === undefined || group === undefined) return;
    const entry: ArchStackEntry = { name, group, nodes: used };
    if (pkg !== undefined) entry.package = pkg;
    if (version !== undefined) entry.version = version;
    if (role !== undefined) entry.role = role;
    stack.push(entry);
  });

  // commands
  const commands: Record<string, ArchCommand[]> = {};
  if (root.commands !== undefined && root.commands !== null) {
    if (!isMap(root.commands)) {
      c.error('commands', 'expected a mapping of group name to a list of { run, note? }');
    } else {
      const groups = Object.keys(root.commands);
      if (groups.length > LIMITS.commandGroups) {
        c.error('commands', `at most ${LIMITS.commandGroups} groups (found ${groups.length})`);
      } else {
        for (const g of groups) {
          if (g.length > LIMITS.commandGroup) {
            c.error(`commands.${g}`, `group name at most ${LIMITS.commandGroup} characters`);
            continue;
          }
          const list: ArchCommand[] = [];
          c.list(root.commands, g, 'commands', LIMITS.commandsPerGroup, true, 1).forEach((cmd, j) => {
            const parsed = readCommand(c, cmd, `commands.${g}[${j}]`);
            if (parsed) list.push(parsed);
          });
          commands[g] = list;
        }
      }
    }
  }

  // tasks
  const tasks: Record<string, string> = {};
  if (root.tasks !== undefined && root.tasks !== null) {
    if (!isMap(root.tasks)) {
      c.error('tasks', 'expected a mapping of task id to node id');
    } else {
      const known = taskIds ? new Set(taskIds.map((t) => t.toUpperCase())) : null;
      for (const [taskId, node] of Object.entries(root.tasks)) {
        const path = `tasks.${taskId}`;
        if (typeof node !== 'string' || !nodeIds.has(node)) {
          c.error(path, `unknown node "${String(node)}"`);
          continue;
        }
        const key = taskId.toUpperCase();
        if (known !== null && !known.has(key)) {
          c.warn(path, `unknown task id "${taskId}", ignored`);
          continue;
        }
        tasks[key] = node;
      }
    }
  }

  if (c.hasErrors || pitch === undefined || grid === null) {
    return { architecture: null, problems: c.problems };
  }
  return {
    architecture: { schema: 1, pitch, grid, kinds, zones, nodes, edges, flows, highlights, stack, commands, tasks },
    problems: c.problems,
  };
}

/** Parses and validates `text`; parse errors become one problem with the line and column as path. */
export function checkArchitectureText(
  text: string,
  path: string,
  taskIds?: readonly string[],
): ArchitectureLoadResult {
  let parsed: YamlValue;
  try {
    parsed = parseYamlSubset(text);
  } catch (err) {
    if (err instanceof YamlSubsetError) {
      return { status: 'invalid', path, problems: [{ path: `line ${err.line}, column ${err.column}`, message: err.reason, level: 'error' }] };
    }
    throw err;
  }
  const { architecture, problems } = validateArchitecture(parsed, taskIds);
  if (architecture === null) return { status: 'invalid', path, problems };
  return { status: 'valid', path, architecture, problems };
}

/** Reads `backlog/docs/architecture.yml` below `cwd`. Never throws for a missing or broken file. */
export function loadArchitecture(cwd: string, opts: { taskIds?: readonly string[] } = {}): ArchitectureLoadResult {
  const path = join(cwd, ...ARCHITECTURE_PATH.split('/'));
  if (!existsSync(path)) return { status: 'missing', path };
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    return { status: 'invalid', path, problems: [{ path: ARCHITECTURE_PATH, message: `cannot read file (${(err as Error).message})`, level: 'error' }] };
  }
  return checkArchitectureText(text, path, opts.taskIds);
}
