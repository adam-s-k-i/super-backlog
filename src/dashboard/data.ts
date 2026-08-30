// src/dashboard/data.ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

import { resolveBacklogBin, runCapture } from '../lib/run.js';
import { isNewerVersion } from '../lib/version-check.js';
import { readSimpleKeys } from '../lib/yamlmini.js';

export interface DashboardAC {
  text: string;
  checked: boolean;
}

export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignee?: string;
  created?: string;
  updated?: string;
  milestone?: string;
  description?: string;
  acs: DashboardAC[];
}

export interface DashboardStatusCount {
  status: string;
  count: number;
}

export interface DashboardMilestone {
  name: string;
  done: number;
  total: number;
}

export interface DashboardDep {
  from: string;
  to: string;
}

export interface DashboardDraft {
  id: string;
  title: string;
  status: string;
  description?: string;
  priority?: string;
  assignee?: string;
  created?: string;
  updated?: string;
  acs: DashboardAC[];
}

export interface DashboardActivityBucket {
  date: string;
  count: number;
}

export interface DashboardGlossaryEntry {
  term: string;
  definition: string;
}

export interface DashboardData {
  project: { name: string; description: string };
  generatedAt: string;
  kitVersion: string;
  /** Newer released version from the version-check cache, or null when up to date/unknown. */
  latestVersion: string | null;
  statuses: DashboardStatusCount[];
  milestones: DashboardMilestone[];
  tasks: DashboardTask[];
  deps: DashboardDep[];
  drafts: DashboardDraft[];
  activity: DashboardActivityBucket[];
  glossary: DashboardGlossaryEntry[];
  source: 'backlog-json' | 'fallback-empty';
}

export type RawTask = Record<string, unknown>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

/**
 * Parse the stdout of `backlog task list --json` defensively.
 * Accepts `{tasks:[...]}` and bare-array shapes; anything else throws
 * so the caller can degrade to fallback-empty.
 */
export function parseTasksJson(raw: string): RawTask[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new Error('empty task list output');
  const parsed: unknown = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return parsed.filter(isRecord);
  if (isRecord(parsed) && Array.isArray(parsed['tasks'])) {
    return parsed['tasks'].filter(isRecord);
  }
  throw new Error('unrecognized task list shape');
}

function normalizeAcs(value: unknown): DashboardAC[] {
  if (!Array.isArray(value)) return [];
  const out: DashboardAC[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      if (item.trim().length > 0) out.push({ text: item.trim(), checked: false });
      continue;
    }
    if (isRecord(item)) {
      const text = asString(item['text']) ?? asString(item['title']) ?? asString(item['description']);
      if (text === undefined) continue;
      const checked = item['checked'] === true || item['done'] === true;
      out.push({ text, checked });
    }
  }
  return out;
}

function firstAssignee(t: RawTask): string | undefined {
  const list = t['assignees'];
  if (Array.isArray(list)) {
    for (const entry of list) {
      const name = asString(entry);
      if (name !== undefined) return name;
    }
  }
  return asString(t['assignee']);
}

export function normalizeTasks(rawTasks: RawTask[]): DashboardTask[] {
  return rawTasks.map((t) => ({
    id: asString(t['id']) ?? '',
    title: asString(t['title']) ?? '(untitled)',
    status: asString(t['status']) ?? 'Unknown',
    priority: asString(t['priority']),
    assignee: firstAssignee(t),
    created: asString(t['createdAt']) ?? asString(t['created_at']) ?? asString(t['created']),
    updated: asString(t['updatedAt']) ?? asString(t['updated_at']) ?? asString(t['updated']),
    milestone: asString(t['milestone']),
    description: asString(t['description']),
    acs: normalizeAcs(t['acceptanceCriteria'] ?? t['acceptance_criteria']),
  }));
}

export function computeStatuses(tasks: DashboardTask[]): DashboardStatusCount[] {
  const counts = new Map<string, number>();
  for (const t of tasks) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status));
}

export function computeMilestones(tasks: DashboardTask[]): DashboardMilestone[] {
  const acc = new Map<string, { done: number; total: number }>();
  for (const t of tasks) {
    if (!t.milestone) continue;
    const m = acc.get(t.milestone) ?? { done: 0, total: 0 };
    m.total++;
    if (t.status.toLowerCase() === 'done') m.done++;
    acc.set(t.milestone, m);
  }
  return [...acc.entries()]
    .map(([name, m]) => ({ name, done: m.done, total: m.total }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extract dependency edges from raw task JSON. Accepts `dependsOn` or `deps`
 * as an array of string ids; anything else contributes nothing. Dangling `to`
 * ids are kept (the graph filters later), malformed entries are dropped.
 */
export function computeDeps(rawTasks: RawTask[]): DashboardDep[] {
  const out: DashboardDep[] = [];
  for (const t of rawTasks) {
    const from = asString(t['id']);
    if (!from) continue;
    for (const field of ['dependsOn', 'deps'] as const) {
      const value = t[field];
      if (!Array.isArray(value)) continue;
      for (const entry of value) {
        if (typeof entry !== 'string') continue;
        const to = entry.trim();
        if (to.length === 0) continue;
        out.push({ from, to });
      }
      break;
    }
  }
  return out;
}

function isoDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (m) return m[1];
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function shiftDay(day: string, deltaDays: number): string {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d) + deltaDays * 86400000).toISOString().slice(0, 10);
}

/** Bucket tasks into exactly 30 UTC daily buckets ending at `today`, oldest first. */
export function computeActivity(rawTasks: RawTask[], today: string): DashboardActivityBucket[] {
  const counts = new Map<string, number>();
  for (const t of rawTasks) {
    const day =
      isoDay(asString(t['updated_at']) ?? asString(t['updated'])) ??
      isoDay(asString(t['created_at'])) ??
      today;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const start = shiftDay(today, -29);
  const out: DashboardActivityBucket[] = [];
  for (let i = 0; i < 30; i++) {
    const date = shiftDay(start, i);
    out.push({ date, count: counts.get(date) ?? 0 });
  }
  return out;
}

export const BUILT_IN_GLOSSARY: readonly DashboardGlossaryEntry[] = [
  { term: 'AC', definition: 'Acceptance criterion — one checkable condition a task must satisfy before it can be done.' },
  { term: 'DoD', definition: 'Definition of Done — the shared bar every task must clear before moving to Done.' },
  { term: 'Milestone', definition: 'A named delivery waypoint that groups tasks and tracks done/total progress.' },
  { term: 'Review Gate', definition: 'A human checkpoint where specs, plans or code are reviewed before work proceeds.' },
  { term: 'TDD', definition: 'Test-Driven Development — write the failing test first (RED), then minimal code to pass (GREEN).' },
  { term: 'Brainstorming', definition: 'Structured exploration of intent, requirements and design before any creative work.' },
  { term: 'Design Gate', definition: 'The point where a human approves the design document before decomposition.' },
  { term: 'Spec-to-Backlog', definition: 'Decomposing an approved design into reviewed backlog tasks with acceptance criteria.' },
  { term: 'Plan-before-Code', definition: 'Implementation starts only after a written implementation plan is approved.' },
  { term: 'Draft', definition: 'An unapproved Backlog.md task proposal awaiting promotion to the board.' },
  { term: 'Worktree', definition: 'An isolated git checkout (e.g. .worktrees/<branch>) used for feature work.' },
  { term: 'Backlog.md', definition: 'File-based task management CLI owning specs, statuses and history under backlog/.' },
  { term: 'Superpowers', definition: 'The methodology skill set that decides HOW the work is done.' },
  { term: 'Pipeline', definition: 'The nine workflow phases from Idea to Merge & archive.' },
  { term: 'Freshness Hook', definition: 'Run `sbl dashboard` to serve a live dashboard that reloads automatically while the server is running.' },
];

/** Split `## Term` headings plus their following non-heading block into entries; empty sections are skipped. */
export function parseGlossaryMarkdown(content: string): DashboardGlossaryEntry[] {
  const out: DashboardGlossaryEntry[] = [];
  let term: string | undefined;
  let buffer: string[] = [];
  const flush = (): void => {
    if (term !== undefined) {
      const definition = buffer.join('\n').trim();
      if (definition.length > 0) out.push({ term, definition });
    }
    term = undefined;
    buffer = [];
  };
  for (const line of content.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      term = heading[1].trim();
      continue;
    }
    if (term !== undefined) buffer.push(line);
  }
  flush();
  return out;
}

/** Built-in terms first; project terms override case-insensitively in place, new terms append. */
export function mergeGlossary(projectEntries: readonly DashboardGlossaryEntry[]): DashboardGlossaryEntry[] {
  const out = BUILT_IN_GLOSSARY.map((e) => ({ ...e }));
  const indexByTerm = new Map<string, number>(out.map((e, i) => [e.term.toLowerCase(), i]));
  for (const entry of projectEntries) {
    const key = entry.term.toLowerCase();
    const existing = indexByTerm.get(key);
    if (existing !== undefined) {
      out[existing] = { term: out[existing].term, definition: entry.definition };
    } else {
      indexByTerm.set(key, out.length);
      out.push({ term: entry.term, definition: entry.definition });
    }
  }
  return out;
}

function readProjectGlossary(cwd: string): DashboardGlossaryEntry[] {
  try {
    const path = join(cwd, 'backlog', 'docs', 'glossary.md');
    if (!existsSync(path)) return [];
    return parseGlossaryMarkdown(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
}

function readDraftFile(path: string): DashboardDraft | null {
  const keys = readSimpleKeys(path, [
    'id', 'title', 'status', 'priority', 'assignee',
    'created_date', 'updated_date', 'created', 'updated',
  ]);
  const id = asString(keys.id);
  const title = asString(keys.title);
  const status = asString(keys.status);
  if (!id || !title || !status) return null;
  let detail: { description?: string; acs: DashboardAC[] } = { acs: [] };
  try {
    detail = parseTaskFile(readFileSync(path, 'utf8'));
  } catch {
    // keys-only draft when the file cannot be re-read
  }
  return {
    id,
    title,
    status,
    description: detail.description,
    priority: asString(keys.priority),
    assignee: asString(keys.assignee),
    created: asString(keys['created_date']) ?? asString(keys['created']),
    updated: asString(keys['updated_date']) ?? asString(keys['updated']),
    acs: detail.acs,
  };
}

export function readDrafts(cwd: string): DashboardDraft[] {
  const draftsDir = join(cwd, 'backlog', 'drafts');
  if (!existsSync(draftsDir)) return [];
  const out: DashboardDraft[] = [];
  for (const entry of readdirSync(draftsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const draft = readDraftFile(join(draftsDir, entry.name));
    if (draft) out.push(draft);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function readProjectIdentity(cwd: string): { name: string; description: string } {
  const cfg = readSimpleKeys(join(cwd, 'backlog', 'config.yml'), [
    'project_name',
    'name',
    'description',
  ]);
  let pkg: Record<string, unknown> | undefined;
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
    } catch {
      pkg = undefined;
    }
  }
  const name =
    asString(cfg['project_name']) ??
    asString(cfg['name']) ??
    asString(pkg?.['name']) ??
    asString(basename(cwd)) ??
    'Untitled project';
  const description = asString(cfg['description']) ?? asString(pkg?.['description']) ?? '';
  return { name, description };
}

interface TaskFileDetail {
  id?: string;
  description?: string;
  acs: DashboardAC[];
}

function sectionBetween(content: string, begin: string, end: string): string | undefined {
  const from = content.indexOf(begin);
  if (from === -1) return undefined;
  const to = content.indexOf(end, from + begin.length);
  if (to === -1) return undefined;
  const text = content.slice(from + begin.length, to).trim();
  return text === '' ? undefined : text;
}

/** Parse one backlog task markdown file via its explicit section markers. */
export function parseTaskFile(content: string): TaskFileDetail {
  const idMatch = /^id:\s*['"]?([^'"\r\n]+)['"]?\s*$/m.exec(content);
  const description = sectionBetween(
    content,
    '<!-- SECTION:DESCRIPTION:BEGIN -->',
    '<!-- SECTION:DESCRIPTION:END -->',
  );
  const acs: DashboardAC[] = [];
  const acBlock = sectionBetween(content, '<!-- AC:BEGIN -->', '<!-- AC:END -->');
  if (acBlock !== undefined) {
    for (const line of acBlock.split(/\r?\n/)) {
      const m = /^-\s*\[( |x|X)\]\s*(?:#\d+\s*)?(.+)$/.exec(line.trim());
      if (m) acs.push({ text: m[2]!.trim(), checked: m[1]!.toLowerCase() === 'x' });
    }
  }
  return { id: idMatch?.[1]?.trim(), description, acs };
}

/**
 * Fill description/ACs from backlog/tasks/*.md where `task list --json`
 * (schemaVersion 1) does not carry them. The CLI stays the source of truth
 * for the list and statuses; files only supply missing detail fields.
 */
export function enrichTasksFromFiles(cwd: string, tasks: DashboardTask[]): DashboardTask[] {
  const dir = join(cwd, 'backlog', 'tasks');
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return tasks;
  }
  const byId = new Map<string, TaskFileDetail>();
  for (const file of files) {
    try {
      const detail = parseTaskFile(readFileSync(join(dir, file), 'utf8'));
      if (detail.id !== undefined) byId.set(detail.id.toUpperCase(), detail);
    } catch {
      // unreadable file -> no enrichment for that task
    }
  }
  return tasks.map((t) => {
    const detail = byId.get(t.id.toUpperCase());
    if (!detail) return t;
    return {
      ...t,
      description: t.description ?? detail.description,
      acs: t.acs.length > 0 ? t.acs : detail.acs,
    };
  });
}

function readLatestVersion(home: string, kitVersion: string): string | null {
  try {
    const raw = readFileSync(join(home, '.super-backlog', 'version-check.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.latest !== 'string') return null;
    return isNewerVersion(parsed.latest, kitVersion) ? parsed.latest : null;
  } catch {
    return null;
  }
}

export function collectDashboardData(
  cwd: string,
  opts: { kitVersion: string; today?: string; home?: string },
): DashboardData {
  const today =
    opts.today && /^\d{4}-\d{2}-\d{2}$/.test(opts.today.trim())
      ? opts.today.trim()
      : new Date().toISOString().slice(0, 10);
  const base: DashboardData = {
    project: readProjectIdentity(cwd),
    generatedAt: new Date().toISOString(),
    kitVersion: opts.kitVersion,
    latestVersion: readLatestVersion(opts.home ?? homedir(), opts.kitVersion),
    statuses: [],
    milestones: [],
    tasks: [],
    deps: [],
    drafts: readDrafts(cwd),
    activity: computeActivity([], today),
    glossary: mergeGlossary(readProjectGlossary(cwd)),
    source: 'fallback-empty',
  };
  try {
    const bin = resolveBacklogBin(cwd);
    if (!bin) return base;
    const res = runCapture(bin, ['task', 'list', '--json'], cwd);
    if (res.status !== 0) return base;
    const rawTasks = parseTasksJson(res.stdout);
    const tasks = enrichTasksFromFiles(cwd, normalizeTasks(rawTasks));
    return {
      ...base,
      tasks,
      statuses: computeStatuses(tasks),
      milestones: computeMilestones(tasks),
      deps: computeDeps(rawTasks),
      activity: computeActivity(rawTasks, today),
      source: 'backlog-json',
    };
  } catch {
    // Any parse/exec failure degrades to an empty dashboard; never crash.
    return base;
  }
}
