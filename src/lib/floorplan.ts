// src/lib/floorplan.ts
// Reads the map the Floorplan plugin (https://github.com/haydenschmitty/floorplan)
// writes to <project>/floorplan/. Read-only: sbl never creates or changes that folder.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { runCapture as defaultRunCapture, type RunResult } from './run.js';

export const FLOORPLAN_DIR = 'floorplan';
export const FLOORPLAN_REPO_URL = 'https://github.com/haydenschmitty/floorplan';
export const FLOORPLAN_INSTALL_COMMANDS = [
  'claude plugin marketplace add haydenschmitty/floorplan',
  'claude plugin install floorplan@floorplan',
] as const;
/** The curated file Floorplan replaced; doctor only reports it. */
export const LEGACY_ARCHITECTURE_PATH = 'backlog/docs/architecture.yml';
export const FLOORPLAN_MAX_GRAPH_BYTES = 10 * 1024 * 1024;

export type FloorplanStatus =
  | { state: 'missing' }
  | { state: 'invalid'; reason: string }
  | { state: 'map'; builtAt: string; files: number; nodes: number; commitsSince: number | null };

export interface FloorplanDeps {
  runCapture?: (cmd: string, args: string[], cwd: string) => RunResult;
}

const FULL_SHA = /^[0-9a-f]{40}$/;

function graphPath(cwd: string): string {
  return join(cwd, FLOORPLAN_DIR, 'graph.json');
}

export function floorplanPagePath(cwd: string): string {
  return join(cwd, FLOORPLAN_DIR, 'index.html');
}

/** Change marker for the hub: mtime of graph.json, 0 when there is no map. Never throws. */
export function floorplanStamp(cwd: string): number {
  try {
    return statSync(graphPath(cwd)).mtimeMs;
  } catch {
    return 0;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Commits on HEAD that the map has not seen; null when unknown. The head only reaches git as a full SHA. */
function commitsSince(cwd: string, meta: Record<string, unknown>, run: NonNullable<FloorplanDeps['runCapture']>): number | null {
  if (!Array.isArray(meta.repos)) return null;
  const own = meta.repos.find((r) => isRecord(r) && r.path === '.');
  if (!isRecord(own) || typeof own.head !== 'string' || !FULL_SHA.test(own.head)) return null;
  try {
    const result = run('git', ['rev-list', '--count', `${own.head}..HEAD`], cwd);
    if (result.status !== 0) return null;
    const text = result.stdout.trim();
    return /^\d+$/.test(text) ? Number(text) : null;
  } catch {
    return null;
  }
}

export function readFloorplanStatus(cwd: string, deps: FloorplanDeps = {}): FloorplanStatus {
  try {
    const file = graphPath(cwd);
    if (!existsSync(file) || !existsSync(floorplanPagePath(cwd))) return { state: 'missing' };
    if (statSync(file).size > FLOORPLAN_MAX_GRAPH_BYTES) return { state: 'invalid', reason: 'graph.json is larger than 10 MB' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      if (err instanceof SyntaxError) return { state: 'invalid', reason: 'not valid JSON' };
      throw err;
    }
    const meta = isRecord(parsed) ? parsed.meta : undefined;
    if (!isRecord(meta) || typeof meta.generatedAt !== 'string' || Number.isNaN(Date.parse(meta.generatedAt))) {
      return { state: 'invalid', reason: 'no build date (meta.generatedAt)' };
    }
    const counts = isRecord(meta.counts) ? meta.counts : {};
    const files = typeof counts.files === 'number' && Number.isFinite(counts.files) ? counts.files : 0;
    const nodes = isRecord(parsed) && Array.isArray(parsed.nodes) ? parsed.nodes.length : 0;
    return {
      state: 'map',
      builtAt: meta.generatedAt,
      files,
      nodes,
      commitsSince: commitsSince(cwd, meta, deps.runCapture ?? defaultRunCapture),
    };
  } catch (err) {
    return { state: 'invalid', reason: err instanceof Error ? err.message : String(err) };
  }
}

export function floorplanBuiltDate(builtAt: string): string {
  return new Date(builtAt).toISOString().slice(0, 10);
}

function count(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}

/** The one wording of the map status; doctor prefixes its mark, `sbl summary` prefixes "map status: ". */
export function floorplanStatusLine(status: FloorplanStatus): string {
  if (status.state === 'missing') {
    return 'no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)';
  }
  if (status.state === 'invalid') return `floorplan/graph.json unreadable (${status.reason})`;
  const date = floorplanBuiltDate(status.builtAt);
  const size = `${count(status.files, 'file')}, ${count(status.nodes, 'part')}`;
  if (status.commitsSince === 0) return `floorplan map current (built ${date}, ${size})`;
  if (status.commitsSince === null) return `floorplan map built ${date} (${size})`;
  return `floorplan map built ${date}, ${count(status.commitsSince, 'commit')} behind HEAD (${size})`;
}
