// src/dashboard/summary-render.ts
// Project summary page: automatic facts plus the Code map card, which points to the
// project's Floorplan map (spec 2026-11-28-floorplan-integration-design.md, decision 2).
// One static HTML file next to the dashboard file.
import { atomicWrite } from '../lib/atomic.js';
import {
  FLOORPLAN_INSTALL_COMMANDS,
  FLOORPLAN_REPO_URL,
  floorplanBuiltDate,
  readFloorplanStatus,
  type FloorplanStatus,
} from '../lib/floorplan.js';
import type { Phase } from '../lib/phase.js';
import type { DashboardData } from './data.js';
import { isDone } from './metrics.js';
import { esc, fillTemplate, jsonIsland, readTemplate, tokensCss } from './render.js';
import { collectSummaryFacts, type FactsDeps, type SummaryFacts } from './summary-facts.js';

export interface SummaryModel {
  facts: SummaryFacts;
  /** null when the map status could not be read; the page then shows no Code map card. */
  map: FloorplanStatus | null;
  renderError: string | null;
}

/** Filled step by step by buildSummaryModel, so the error path can reuse what already succeeded. */
export interface SummaryProgress {
  facts?: SummaryFacts;
  map?: FloorplanStatus;
}

export interface SummaryDeps extends FactsDeps {
  /** Seam for tests; defaults to reading floorplan/graph.json. */
  readFloorplanStatus?: (cwd: string) => FloorplanStatus;
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
}

export interface SummaryStackItem {
  name: string;
  group: string;
  version: string;
}

/** The JSON island the client renders from (`#sbl-summary`). */
export interface SummaryView {
  project: string;
  /** escaped project description */
  pitchHtml: string;
  /** package name from the manifest, shown as the pill next to the title */
  packageName: string | null;
  manifest: string | null;
  facts: SummaryFact[];
  tasks: SummaryTask[];
  commands: { group: string; entries: { run: string; note?: string }[] }[];
  stack: SummaryStackItem[];
  source: { auto: string[]; warnings: string[] };
}

/** `<dashboard file without .html>.summary.html` (R2). */
export function summaryFileFor(dashboardFile: string): string {
  return `${dashboardFile.replace(/\.html$/i, '')}.summary.html`;
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

/** "1 file", "165 files" */
function counted(n: number, one: string, many: string): string {
  return `${n} ${plural(n, one, many)}`;
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

/** Collects the facts, then the map status. Throws only what its seams throw. */
export function buildSummaryModel(cwd: string, deps: SummaryDeps = {}, progress: SummaryProgress = {}): SummaryModel {
  const facts = collectSummaryFacts(cwd, deps);
  progress.facts = facts;
  const map = deps.readFloorplanStatus
    ? deps.readFloorplanStatus(cwd)
    : readFloorplanStatus(cwd, deps.runCapture ? { runCapture: deps.runCapture } : {});
  progress.map = map;
  return { facts, map, renderError: null };
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

function autoSource(data: DashboardData, facts: SummaryFacts, map: FloorplanStatus | null): string[] {
  const out: string[] = [];
  out.push(
    facts.manifest
      ? `Name, version and license from ${facts.manifest}${facts.manifests.length > 1 ? ` (also read: ${facts.manifests.filter((m) => m !== facts.manifest).join(', ')})` : ''}`
      : 'No manifest found (package.json, composer.json or a WordPress header)',
  );
  const exts = facts.extensions.length > 0 ? ` (${facts.extensions.join(' ')})` : '';
  out.push(
    `${counted(facts.sourceFiles, 'source file', 'source files')}${exts} from ${facts.fileSource === 'git' ? 'git ls-files' : 'a directory walk'}` +
      (facts.locApprox ? '; line count stopped at the 10 MB read budget' : ''),
  );
  const depNoun = plural(facts.dependencies + facts.devDependencies, 'dependency', 'dependencies');
  out.push(`${facts.dependencies} runtime and ${facts.devDependencies} development ${depNoun}; versions from lockfiles where present`);
  out.push(
    facts.releasesNote
      ? `Releases: ${facts.releasesNote}`
      : `${counted(facts.releases, 'release', 'releases')} from git version tags`,
  );
  out.push(`${facts.workflows} GitHub Actions ${plural(facts.workflows, 'workflow', 'workflows')}`);
  out.push(data.source === 'backlog-json' ? 'Open work from backlog task list' : 'Open work: no backlog data');
  if (map?.state === 'map') out.push('Code map from floorplan/graph.json (Floorplan)');
  return out;
}

/** Pure: dashboard data + model -> the view the client renders. */
export function buildSummaryView(data: DashboardData, model: SummaryModel): SummaryView {
  const { facts } = model;
  const open = data.tasks.filter((t) => !isDone(t.status));
  return {
    project: data.project.name,
    pitchHtml: esc(data.project.description),
    packageName: facts.name,
    manifest: facts.manifest,
    facts: headerFacts(facts, open.length),
    tasks: open.map((t) => ({ id: t.id, title: t.title, status: t.status, phase: t.phase })),
    commands: facts.commands,
    stack: facts.packages.map((p) => ({ name: p.name, group: p.group, version: p.version })),
    source: { auto: autoSource(data, facts, model.map), warnings: facts.warnings },
  };
}

/** Same icon as the client-side COPY_ICON in summary.html; the delegated click handler copies data-copy. */
const COPY_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
  '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>' +
  '<path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>';

/** Same markup as the client-side cmdHTML, so the card's commands look and copy like every other command. */
function installCommandHtml(run: string): string {
  return (
    `<div class="cmd"><code>${esc(run)}</code>` +
    `<button class="copy" type="button" data-copy="${esc(run)}" aria-label="Copy command: ${esc(run)}">${COPY_ICON}</button></div>`
  );
}

/**
 * The Code map card (decision 2). Server-rendered, so it needs no client code. `null` means the
 * status could not be read: no card, because neither "no map" nor "map" would be a true statement.
 */
export function codeMapHtml(status: FloorplanStatus | null): string {
  if (!status) return '';
  let body: string;
  if (status.state === 'map') {
    const since =
      status.commitsSince !== null && status.commitsSince > 0
        ? `, ${counted(status.commitsSince, 'commit', 'commits')} since`
        : '';
    body =
      `<p>Floorplan map, built ${esc(floorplanBuiltDate(status.builtAt))}, ${counted(status.files, 'file', 'files')}, ` +
      `${counted(status.nodes, 'part', 'parts')}${since}. <a class="maplink" href="../map/">Open map</a></p>`;
  } else if (status.state === 'invalid') {
    body = `<p>Floorplan map unreadable (${esc(status.reason)}). Ask your agent to update the floorplan.</p>`;
  } else {
    body =
      `<p>No code map yet. <a href="${esc(FLOORPLAN_REPO_URL)}">Floorplan</a> draws an interactive map of the codebase. ` +
      'Install the plugin in Claude Code, then ask your agent to "make a floorplan".</p>' +
      `<div class="cmds">${FLOORPLAN_INSTALL_COMMANDS.map(installCommandHtml).join('')}</div>`;
  }
  return `<section class="codemap" aria-label="Code map"><h2>Code map</h2>${body}</section>`;
}

/** The only notice left: the page itself could not be rendered. */
export function noticeHtml(model: SummaryModel): string {
  if (!model.renderError) return '';
  return (
    '<div class="notice notice-error" role="alert"><p>Summary could not be rendered ' +
    `(<code>${esc(model.renderError)}</code>). Showing the automatic facts only.</p></div>`
  );
}

/** Fills the summary template (V1). Pure apart from reading the two template files. */
export function renderSummary(data: DashboardData, model: SummaryModel): string {
  const view = buildSummaryView(data, model);
  return fillTemplate(readTemplate('summary.html'), {
    __SBL_TOKENS_CSS__: tokensCss,
    __PROJECT_NAME__: () => esc(data.project.name),
    __SUMMARY_NOTICE__: () => noticeHtml(model),
    __SUMMARY_CODE_MAP__: () => codeMapHtml(model.map),
    __SBL_SUMMARY_JSON__: () => jsonIsland(view),
  });
}

function minimalPage(data: DashboardData, message: string): string {
  return (
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    `<title>${esc(data.project.name)} &middot; Project Summary</title></head>` +
    `<body><p>Summary could not be rendered (<code>${esc(message)}</code>).</p><p><a href="../">Dashboard</a></p></body></html>\n`
  );
}

/**
 * Writes the summary page next to the dashboard file and returns its path. Never throws:
 * a failing step degrades to the facts with an error notice, then to a minimal page.
 */
export function writeSummaryPage(cwd: string, data: DashboardData, dashboardFile: string, deps: SummaryDeps = {}): string {
  const file = summaryFileFor(dashboardFile);
  const progress: SummaryProgress = {};
  let html: string;
  try {
    html = renderSummary(data, buildSummaryModel(cwd, deps, progress));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      html = renderSummary(data, { facts: progress.facts ?? emptyFacts(), map: progress.map ?? null, renderError: message });
    } catch {
      html = minimalPage(data, message);
    }
  }
  try {
    atomicWrite(file, html);
  } catch (err) {
    // the dashboard never depends on the summary page, but the user should know why it is stale
    process.stderr.write(`sbl: could not write the summary page ${file}: ${err instanceof Error ? err.message : String(err)}\n`);
  }
  return file;
}
