// src/lib/floorplan.ts
// Reads the map the Floorplan plugin (https://github.com/haydenschmitty/floorplan)
// writes to <project>/floorplan/. Read-only: sbl never creates or changes that folder.
import { lstatSync, readFileSync, type Stats } from 'node:fs';
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
/** Floorplan pages are a few MB; anything far above that is not a map. */
export const FLOORPLAN_MAX_PAGE_BYTES = 50 * 1024 * 1024;

export type FloorplanStatus =
  | { state: 'missing' }
  | { state: 'invalid'; reason: string }
  | { state: 'map'; builtAt: string; files: number; nodes: number; commitsSince: number | null };

export interface FloorplanDeps {
  runCapture?: (cmd: string, args: string[], cwd: string) => RunResult;
}

const FULL_SHA = /^[0-9a-f]{40}$/;
/** Date.parse alone also accepts "2026" or "November 28, 2026"; Floorplan writes ISO timestamps. */
const ISO_DATE_TIME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/;

function graphPath(cwd: string): string {
  return join(cwd, FLOORPLAN_DIR, 'graph.json');
}

export function floorplanPagePath(cwd: string): string {
  return join(cwd, FLOORPLAN_DIR, 'index.html');
}

function mtime(file: string): number {
  try {
    return lstatSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Change marker for the hub: the mtimes of graph.json and index.html, '0:0' when there is no map.
 * Both files count because Floorplan writes them one after the other. Never throws.
 */
export function floorplanStamp(cwd: string): string {
  return `${mtime(graphPath(cwd))}:${mtime(floorplanPagePath(cwd))}`;
}

/** lstat, so a link is seen as a link and never followed; null when nothing is there. */
function lstatOrNull(file: string): Stats | null {
  try {
    return lstatSync(file);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw err;
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
    const graphInfo = lstatOrNull(file);
    const pageInfo = lstatOrNull(floorplanPagePath(cwd));
    if (!graphInfo || !pageInfo) return { state: 'missing' };
    if (!graphInfo.isFile()) return { state: 'invalid', reason: 'graph.json is not a regular file' };
    if (!pageInfo.isFile()) return { state: 'invalid', reason: 'index.html is not a regular file' };
    if (graphInfo.size > FLOORPLAN_MAX_GRAPH_BYTES) return { state: 'invalid', reason: 'graph.json is larger than 10 MB' };
    if (pageInfo.size > FLOORPLAN_MAX_PAGE_BYTES) return { state: 'invalid', reason: 'index.html is larger than 50 MB' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      if (err instanceof SyntaxError) return { state: 'invalid', reason: 'not valid JSON' };
      throw err;
    }
    const meta = isRecord(parsed) ? parsed.meta : undefined;
    if (
      !isRecord(meta) ||
      typeof meta.generatedAt !== 'string' ||
      !ISO_DATE_TIME.test(meta.generatedAt) ||
      Number.isNaN(Date.parse(meta.generatedAt))
    ) {
      return { state: 'invalid', reason: 'no build date (meta.generatedAt)' };
    }
    const counts = isRecord(meta.counts) ? meta.counts : {};
    const files = typeof counts.files === 'number' && Number.isInteger(counts.files) && counts.files >= 0 ? counts.files : 0;
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
  if (status.state === 'invalid') return `floorplan map unreadable (${status.reason})`;
  const date = floorplanBuiltDate(status.builtAt);
  const size = `${count(status.files, 'file')}, ${count(status.nodes, 'part')}`;
  if (status.commitsSince === 0) return `floorplan map current (built ${date}, ${size})`;
  if (status.commitsSince === null) return `floorplan map built ${date} (${size})`;
  return `floorplan map built ${date}, ${count(status.commitsSince, 'commit')} behind HEAD (${size})`;
}
