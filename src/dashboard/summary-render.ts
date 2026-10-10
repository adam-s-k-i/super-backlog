// src/dashboard/summary-render.ts
// Project summary page (spec 2026-10-09, R2, D5-D6, E1-E4, V1-V4): facts + curated
// architecture + layout -> one static HTML file next to the dashboard file.
import { atomicWrite } from '../lib/atomic.js';
import type { Phase } from '../lib/phase.js';
import type { DashboardData } from './data.js';
import { isDone } from './metrics.js';
import { esc, jsonIsland, readTemplate } from './render.js';
import { collectSummaryFacts, type FactsDeps, type SummaryFacts } from './summary-facts.js';
import {
  detectDrift,
  driftCount,
  DRIFT_CODES,
  summaryAgentPrompt,
  type DriftCode,
  type DriftDeps,
} from './summary-drift.js';
import { layoutArchitecture, type LayoutResult } from './summary-layout.js';
import {
  ARCHITECTURE_PATH,
  loadArchitecture,
  type Architecture,
  type ArchitectureLoadResult,
  type ArchStackEntry,
} from './summary-schema.js';

export const SUMMARY_DOCS_URL = 'https://adam-s-k-i.github.io/super-backlog/guide/project-summary';
/** E2: the notice lists at most this many problems. */
export const MAX_NOTICE_PROBLEMS = 20;

export interface SummaryModel {
  facts: SummaryFacts;
  load: ArchitectureLoadResult;
  /** null unless the architecture file is valid (or when rendering fell back, E3) */
  layout: LayoutResult | null;
  /** E3: message of the error that stopped the full render */
  renderError: string | null;
  /** spec 2026-10-10: drift of a valid file for the banner; null when clean, not valid or not checkable */
  drift: SummaryDrift | null;
}

export interface SummaryDrift {
  count: number;
  /** distinct finding codes in signal order */
  codes: DriftCode[];
  prompt: string;
}

export interface SummaryDeps extends FactsDeps {
  loadArchitecture?: typeof loadArchitecture;
  layoutArchitecture?: typeof layoutArchitecture;
  detectDrift?: typeof detectDrift;
}

export interface SummaryFact {
  value: string;
  label: string;
}

export interface SummaryTask {
  id: string;
  title: string;
  status: string;
  phase: Phase | null;
  /** node id from `tasks:` in architecture.yml, or null when unmapped */
  node: string | null;
}

export interface SummaryStackItem {
  name: string;
  group: string;
  version: string;
  role: string;
  nodes: string[];
}

/** The JSON island the client renders from (`#sbl-summary`). */
export interface SummaryView {
  project: string;
  /** escaped pitch; `**bold**` already turned into <b> (the only markup allowed) */
  pitchHtml: string;
  /** package name from the manifest, shown as the pill next to the title */
  packageName: string | null;
  manifest: string | null;
  facts: SummaryFact[];
  architecture: Pick<Architecture, 'kinds' | 'nodes' | 'edges' | 'flows' | 'highlights'> | null;
  layout: LayoutResult | null;
  tasks: SummaryTask[];
  commands: { group: string; entries: { run: string; note?: string }[] }[];
  stack: SummaryStackItem[];
  source: { auto: string[]; curated: string[]; warnings: string[]; file: string };
}

/** `<dashboard file without .html>.summary.html` (R2). */
export function summaryFileFor(dashboardFile: string): string {
  return `${dashboardFile.replace(/\.html$/i, '')}.summary.html`;
}

/** Escapes the pitch, then turns `**text**` into <b>text</b>. Nothing else becomes markup. */
export function formatPitch(pitch: string): string {
  return esc(pitch).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

/** 980 -> "980", 5234 -> "5.2k", 5000 -> "5k", 48213 -> "48k" */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(n / 1000)}k`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function emptyFacts(): SummaryFacts {
  return {
    name: null,
    version: null,
    license: null,
    manifest: null,
    manifests: [],
    dependencies: 0,
    devDependencies: 0,
    packages: [],
    versions: {},
    extensions: [],
    fileSource: 'walk',
    sourceFiles: 0,
    loc: 0,
    locApprox: false,
    testFiles: 0,
    releases: 0,
    releasesNote: null,
    workflows: 0,
    commands: [],
    warnings: [],
  };
}

/** Collects facts, loads and lays out the architecture file. Throws only on unexpected errors. */
export function buildSummaryModel(cwd: string, data: DashboardData, deps: SummaryDeps = {}): SummaryModel {
  const facts = collectSummaryFacts(cwd, deps);
  const load = (deps.loadArchitecture ?? loadArchitecture)(cwd, { taskIds: data.tasks.map((t) => t.id) });
  const layout = load.status === 'valid' ? (deps.layoutArchitecture ?? layoutArchitecture)(load.architecture) : null;
  const drift = load.status === 'valid' ? summaryDrift(cwd, data, deps) : null;
  return { facts, load, layout, renderError: null, drift };
}

/**
 * Drift for the banner (spec 2026-10-10). Loads the file a second time without
 * task ids, because the page load drops unknown ids and would hide unknown-task
 * findings. Never throws: the banner is optional.
 */
function summaryDrift(cwd: string, data: DashboardData, deps: SummaryDeps): SummaryDrift | null {
  try {
    const raw = (deps.loadArchitecture ?? loadArchitecture)(cwd);
    if (raw.status !== 'valid') return null;
    const tasks = data.source === 'backlog-json' ? data.tasks.map((t) => ({ id: t.id, status: t.status })) : null;
    const driftDeps: DriftDeps = deps.runCapture ? { runCapture: deps.runCapture } : {};
    const { findings } = (deps.detectDrift ?? detectDrift)(cwd, raw.architecture, { tasks, deps: driftDeps });
    if (findings.length === 0) return null;
    const codes = DRIFT_CODES.filter((code) => findings.some((f) => f.code === code));
    return { count: findings.length, codes, prompt: summaryAgentPrompt('drift') };
  } catch {
    return null;
  }
}

function headerFacts(facts: SummaryFacts, openTasks: number): SummaryFact[] {
  const releasesLabel = facts.releasesNote ? `Releases (${facts.releasesNote})` : 'Releases';
  return [
    { value: facts.version ?? '–', label: facts.license ? `Version · ${facts.license}` : 'Version' },
    { value: `${facts.locApprox ? '≈' : ''}${formatCount(facts.loc)}`, label: 'Lines of code' },
    { value: String(facts.testFiles), label: plural(facts.testFiles, 'Test file', 'Test files') },
    { value: String(facts.dependencies), label: plural(facts.dependencies, 'Runtime dependency', 'Runtime dependencies') },
    { value: String(facts.releases), label: releasesLabel },
    { value: String(openTasks), label: plural(openTasks, 'Open task', 'Open tasks') },
  ];
}

/** Own-property lookup, so a package named `constructor` or `toString` never hits Object.prototype. */
function ownVersion(versions: Record<string, string>, name: string): string {
  return Object.hasOwn(versions, name) ? versions[name] : '';
}

function stackItems(arch: Architecture | null, facts: SummaryFacts): SummaryStackItem[] {
  if (arch && arch.stack.length > 0) {
    return arch.stack.map((s: ArchStackEntry) => ({
      name: s.name,
      group: s.group,
      version: s.version ?? ownVersion(facts.versions, s.package ?? s.name),
      role: s.role ?? '',
      nodes: s.nodes,
    }));
  }
  return facts.packages.map((p) => ({ name: p.name, group: p.group, version: p.version, role: '', nodes: [] }));
}

function autoSource(data: DashboardData, facts: SummaryFacts): string[] {
  const out: string[] = [];
  out.push(
    facts.manifest
      ? `Name, version and license from ${facts.manifest}${facts.manifests.length > 1 ? ` (also read: ${facts.manifests.filter((m) => m !== facts.manifest).join(', ')})` : ''}`
      : 'No manifest found (package.json, composer.json or a WordPress header)',
  );
  const exts = facts.extensions.length > 0 ? ` (${facts.extensions.join(' ')})` : '';
  out.push(
    `${facts.sourceFiles} source files${exts} from ${facts.fileSource === 'git' ? 'git ls-files' : 'a directory walk'}` +
      (facts.locApprox ? '; line count stopped at the 10 MB read budget' : ''),
  );
  out.push(`${facts.dependencies} runtime and ${facts.devDependencies} development dependencies; versions from lockfiles where present`);
  out.push(facts.releasesNote ? `Releases: ${facts.releasesNote}` : `${facts.releases} releases from git version tags`);
  out.push(`${facts.workflows} GitHub Actions ${plural(facts.workflows, 'workflow', 'workflows')}`);
  out.push(data.source === 'backlog-json' ? 'Open work from backlog task list' : 'Open work: no backlog data');
  return out;
}

function curatedSource(load: ArchitectureLoadResult): string[] {
  if (load.status === 'missing') return ['No curated file yet; this page shows the automatic facts only.'];
  if (load.status === 'invalid') {
    const n = load.problems.filter((p) => p.level === 'error').length;
    return [`${ARCHITECTURE_PATH} has ${n} ${plural(n, 'problem', 'problems')}; see the notice above.`];
  }
  const a = load.architecture;
  return [
    `Pitch, ${a.nodes.length} components, ${a.edges.length} connections, ${a.flows.length} flows`,
    `${a.highlights.length} highlights, ${a.stack.length} stack entries, ${Object.keys(a.commands).length} command groups`,
    `${Object.keys(a.tasks).length} task-to-component mappings (status comes from the backlog CLI)`,
  ];
}

/** Builds the client view model; every string stays raw here and is escaped by the client (or jsonIsland). */
export function buildSummaryView(data: DashboardData, model: SummaryModel): SummaryView {
  const { facts, load, layout } = model;
  const arch = load.status === 'valid' && layout ? load.architecture : null;
  const open = data.tasks.filter((t) => !isDone(t.status));
  const tasks: SummaryTask[] = open.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    phase: t.phase,
    node: arch?.tasks[t.id.toUpperCase()] ?? null,
  }));
  const commands =
    arch && Object.keys(arch.commands).length > 0
      ? Object.entries(arch.commands).map(([group, entries]) => ({ group, entries }))
      : facts.commands;
  const warnings = [
    ...(load.status === 'valid' ? load.problems.filter((p) => p.level === 'warning').map((p) => `${p.path}: ${p.message}`) : []),
    ...(layout ? layout.warnings.map((w) => `layout ${w.code} ${w.edge}: ${w.message}`) : []),
    ...facts.warnings,
  ];
  return {
    project: data.project.name,
    pitchHtml: arch ? formatPitch(arch.pitch) : esc(data.project.description),
    packageName: facts.name,
    manifest: facts.manifest,
    facts: headerFacts(facts, open.length),
    architecture: arch
      ? { kinds: arch.kinds, nodes: arch.nodes, edges: arch.edges, flows: arch.flows, highlights: arch.highlights }
      : null,
    layout: arch ? layout : null,
    tasks,
    commands,
    stack: stackItems(arch, facts),
    source: { auto: autoSource(data, facts), curated: curatedSource(load), warnings, file: ARCHITECTURE_PATH },
  };
}

const DRIFT_LABELS: Record<DriftCode, string> = {
  'missing-path': 'missing paths',
  'done-task': 'Done tasks',
  'unknown-task': 'unknown tasks',
  'stale-file': 'stale file',
};

/** Same icon as the client-side COPY_ICON in summary.html; the delegated click handler copies data-copy. */
const COPY_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
  '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>' +
  '<path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>';

function copyPromptButton(prompt: string): string {
  return (
    `<button class="copy" type="button" data-copy="${esc(prompt)}" ` +
    `aria-label="Copy the prompt for your agent" title="Copy the prompt for your agent">${COPY_ICON}</button>`
  );
}

/** Server-rendered notice between header and canvas (D6, E2, E3, drift banner); empty for a clean valid file. */
export function noticeHtml(model: SummaryModel): string {
  if (model.renderError !== null) {
    return (
      '<div class="notice notice-error" role="alert"><p>Summary could not be rendered ' +
      `(<code>${esc(model.renderError)}</code>). Showing the automatic facts only.</p></div>`
    );
  }
  const { load } = model;
  if (load.status === 'missing') {
    return (
      '<div class="notice"><p>No architecture file yet. Run the <code>architecture-summary</code> skill in your agent ' +
      `or create <code>${ARCHITECTURE_PATH}</code> (schema: <a href="${SUMMARY_DOCS_URL}">docs</a>).` +
      `${copyPromptButton(summaryAgentPrompt('missing'))}</p></div>`
    );
  }
  if (load.status === 'invalid') {
    const errors = load.problems.filter((p) => p.level === 'error');
    const shown = errors.slice(0, MAX_NOTICE_PROBLEMS);
    const more = errors.length - shown.length;
    return (
      '<div class="notice notice-error" role="alert">' +
      `<p><code>${ARCHITECTURE_PATH}</code> has ${errors.length} ${plural(errors.length, 'problem', 'problems')}; ` +
      `showing the automatic facts only (schema: <a href="${SUMMARY_DOCS_URL}">docs</a>).</p>` +
      `<ul>${shown.map((p) => `<li><code>${esc(p.path)}</code>: ${esc(p.message)}</li>`).join('')}</ul>` +
      (more > 0 ? `<p>… and ${more} more</p>` : '') +
      '</div>'
    );
  }
  if (model.drift !== null) {
    const { count, codes, prompt } = model.drift;
    const text = `${driftCount(count)} (${codes.map((c) => DRIFT_LABELS[c]).join(', ')}) – the diagram may be out of date`;
    return `<div class="notice notice-drift" role="status"><p>${esc(text)}${copyPromptButton(prompt)}</p></div>`;
  }
  return '';
}

/** Fills the summary template (V1). Pure apart from reading the two template files. */
export function renderSummary(data: DashboardData, model: SummaryModel): string {
  const view = buildSummaryView(data, model);
  return readTemplate('summary.html')
    .replaceAll('__SBL_TOKENS_CSS__', () => readTemplate('sbl-tokens.css').replace(/\r\n/g, '\n').trimEnd())
    .replaceAll('__PROJECT_NAME__', () => esc(data.project.name))
    .replaceAll('__SUMMARY_NOTICE__', () => noticeHtml(model))
    .replaceAll('__SBL_SUMMARY_JSON__', () => jsonIsland(view));
}

function minimalPage(data: DashboardData, message: string): string {
  return (
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    `<title>${esc(data.project.name)} &middot; Project Summary</title></head>` +
    `<body><p>Summary could not be rendered (<code>${esc(message)}</code>).</p><p><a href="../">Dashboard</a></p></body></html>\n`
  );
}

/**
 * Writes the summary page next to `dashboardFile` (R2). Never throws: a broken
 * architecture file or a render error degrades to the reduced view (E3), and a
 * failed write leaves the dashboard untouched.
 */
export function writeSummaryPage(cwd: string, data: DashboardData, dashboardFile: string, deps: SummaryDeps = {}): string {
  const file = summaryFileFor(dashboardFile);
  let html: string;
  try {
    html = renderSummary(data, buildSummaryModel(cwd, data, deps));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      let facts: SummaryFacts;
      try {
        facts = collectSummaryFacts(cwd, deps);
      } catch {
        facts = emptyFacts();
      }
      html = renderSummary(data, {
        facts,
        load: { status: 'missing', path: ARCHITECTURE_PATH },
        layout: null,
        renderError: message,
        drift: null,
      });
    } catch {
      html = minimalPage(data, message);
    }
  }
  try {
    atomicWrite(file, html);
  } catch {
    /* the dashboard never depends on the summary page */
  }
  return file;
}
