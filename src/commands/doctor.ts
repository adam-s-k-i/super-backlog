// src/commands/doctor.ts
import process from 'node:process';

import { ARCHITECTURE_PATH, loadArchitecture, type ArchitectureLoadResult } from '../dashboard/summary-schema.js';
import { layoutArchitecture } from '../dashboard/summary-layout.js';
import { extractPhaseLabels, PHASES } from '../lib/phase.js';
import {
  getEffectiveExecutionPolicy,
  isBlockingExecutionPolicy,
  type Executor,
} from '../lib/powershell.js';
import { resolveBacklogBin, runCapture } from '../lib/run.js';

export interface TaskLabelRow {
  id: string;
  status: string;
  labels: string[];
}

export interface DoctorDeps {
  platform?: string;
  nodeVersion?: string;
  executor?: Executor;
  resolveBacklog?: (cwd: string) => string | null;
  readTaskLabels?: (cwd: string) => TaskLabelRow[] | null;
  /** Seam for check 5; defaults to reading backlog/docs/architecture.yml. */
  loadArchitecture?: (cwd: string) => ArchitectureLoadResult;
  /** Seam for check 5; defaults to the summary page's layout engine. */
  layoutArchitecture?: typeof layoutArchitecture;
  log?: (line: string) => void;
}

type Status = 'ok' | 'warn' | 'skip' | 'fail';

const MARK: Record<Status, string> = {
  ok: '[ok]  ',
  warn: '[warn]',
  skip: '[skip]',
  fail: '[fail]',
};

function defaultReadTaskLabels(
  cwd: string,
  resolveBacklog: (cwd: string) => string | null,
): TaskLabelRow[] | null {
  const bin = resolveBacklog(cwd);
  if (!bin) return null;
  const res = runCapture(bin, ['task', 'list', '--json'], cwd);
  if (res.status !== 0) return null;
  try {
    const parsed = JSON.parse(res.stdout) as { tasks?: unknown };
    if (!Array.isArray(parsed.tasks)) return null;
    const rows: TaskLabelRow[] = [];
    for (const t of parsed.tasks) {
      if (typeof t !== 'object' || t === null) continue;
      const id = (t as { id?: unknown }).id;
      const status = (t as { status?: unknown }).status;
      const labels = (t as { labels?: unknown }).labels;
      if (typeof id !== 'string' || typeof status !== 'string') continue;
      rows.push({
        id,
        status,
        labels: Array.isArray(labels) ? labels.filter((l): l is string => typeof l === 'string') : [],
      });
    }
    return rows;
  } catch {
    return null;
  }
}

export function runDoctor(cwd: string, deps: DoctorDeps = {}): number {
  const platform = deps.platform ?? process.platform;
  const nodeVersion = deps.nodeVersion ?? process.versions.node;
  const resolveBacklog = deps.resolveBacklog ?? resolveBacklogBin;
  const readTaskLabels = deps.readTaskLabels ?? ((c: string) => defaultReadTaskLabels(c, resolveBacklog));
  const log = deps.log ?? ((line: string) => console.log(line));

  let okCount = 0;
  let warnCount = 0;
  let skipCount = 0;
  let failCount = 0;

  const emit = (status: Status, line: string, extra: string[] = []): void => {
    if (status === 'ok') okCount += 1;
    else if (status === 'warn') warnCount += 1;
    else if (status === 'fail') failCount += 1;
    else skipCount += 1;
    log(`${MARK[status]} ${line}`);
    for (const extraLine of extra) log(`        ${extraLine}`);
  };

  // check 1: node >= 20
  const major = Number(nodeVersion.split('.')[0]);
  if (Number.isNaN(major)) {
    emit('warn', `node version unreadable ("${nodeVersion}") - super-backlog requires Node >= 20`);
  } else if (major >= 20) {
    emit('ok', `node v${nodeVersion} (>= 20)`);
  } else {
    emit('warn', `node v${nodeVersion} is too old - super-backlog requires Node >= 20`, [
      'fix: upgrade Node.js (https://nodejs.org)',
    ]);
  }

  // check 2: PowerShell execution policy (win32 only, fakeable via SBL_FAKE_POLICY)
  const policy = getEffectiveExecutionPolicy({ platform, executor: deps.executor });
  if (policy === null) {
    emit('skip', 'PowerShell execution policy check (not Windows or undetectable)');
  } else if (isBlockingExecutionPolicy(policy)) {
    emit(
      'warn',
      `PowerShell execution policy "${policy}" blocks .ps1 shims - direct npm/npx/sbl calls in PowerShell will fail`,
      [
        'fix: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned',
        'alt: call the .cmd shims explicitly (npx.cmd, sbl.cmd) or run from cmd.exe',
        'note: "npm run ..." scripts are unaffected (they execute via cmd.exe)',
      ],
    );
  } else {
    emit('ok', `PowerShell execution policy: ${policy}`);
  }

  // check 3: backlog binary resolvability
  const backlogBin = resolveBacklog(cwd);
  if (backlogBin !== null) {
    emit('ok', `backlog CLI resolvable at ${backlogBin}`);
  } else {
    emit('warn', 'backlog CLI not found - run sbl init or npm install first', [
      'fix: npx.cmd super-backlog init',
    ]);
  }

  // check 4: phase label hygiene
  const taskRows = readTaskLabels(cwd);
  if (taskRows === null) {
    emit('skip', 'phase label hygiene (task labels unreadable - backlog CLI unavailable)');
  } else {
    const known = new Set(PHASES.map((p) => `phase/${p}`));
    let problems = 0;
    let legacy = 0;
    for (const row of taskRows) {
      const phaseLabels = extractPhaseLabels(row.labels);
      const unknown = phaseLabels.filter((l) => !known.has(l));
      if (phaseLabels.length > 1) {
        problems += 1;
        emit('fail', `${row.id}: multiple phase labels (${phaseLabels.join(', ')})`, [
          `fix: sbl phase ${row.id} <phase> after removing the stale label`,
        ]);
      }
      for (const l of unknown) {
        problems += 1;
        emit('fail', `${row.id}: unknown phase label ${l}`, [
          `fix: backlog task edit ${row.id} --remove-label ${l}`,
        ]);
      }
      if (unknown.length === 0 && phaseLabels.length === 0 && row.status === 'In Progress') {
        legacy += 1;
        emit('warn', `${row.id}: In Progress without phase label (legacy inventory)`, [
          `fix: sbl phase ${row.id} spec`,
        ]);
      }
    }
    if (problems === 0 && legacy === 0) {
      emit('ok', `phase label hygiene clean (${taskRows.length} tasks)`);
    }
  }

  // check 5: curated architecture file of the summary page. Task ids are not
  // passed: mappings to archived tasks are expected drift, not a doctor warning.
  const arch = (deps.loadArchitecture ?? ((c: string) => loadArchitecture(c)))(cwd);
  if (arch.status === 'missing') {
    emit('skip', `${ARCHITECTURE_PATH} not present (summary page shows the reduced view)`);
  } else if (arch.status === 'invalid') {
    const errors = arch.problems.filter((p) => p.level === 'error').length;
    emit('fail', `${ARCHITECTURE_PATH}: ${errors} error(s)`, [
      ...arch.problems.map((p) => `${p.level}: ${p.path}: ${p.message}`),
      'fix: edit the file or run the architecture-summary skill, then sbl doctor again',
    ]);
  } else {
    const layout = (deps.layoutArchitecture ?? layoutArchitecture)(arch.architecture);
    const warnings = [
      ...arch.problems.map((p) => `warning: ${p.path}: ${p.message}`),
      ...layout.warnings.map((w) => `layout ${w.code} ${w.edge}: ${w.message}`),
    ];
    const size = `${arch.architecture.nodes.length} nodes, ${arch.architecture.edges.length} edges`;
    if (warnings.length === 0) emit('ok', `${ARCHITECTURE_PATH} valid (${size}, layout clean)`);
    else emit('warn', `${ARCHITECTURE_PATH} valid with ${warnings.length} warning(s) (${size})`, warnings);
  }

  log(`doctor summary: ${okCount} ok, ${warnCount} warn, ${skipCount} skip, ${failCount} fail`);
  if (failCount > 0) return 1;
  return warnCount > 0 ? 4 : 0;
}
