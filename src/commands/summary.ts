// src/commands/summary.ts
// `sbl summary [--check]` (spec 2026-10-10): validates backlog/docs/architecture.yml,
// lists schema/layout warnings and drift findings, and names the agent prompt.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  detectDrift,
  driftCount,
  summaryAgentPrompt,
  type DriftFinding,
  type DriftResult,
  type SummaryPromptState,
} from '../dashboard/summary-drift.js';
import { layoutArchitecture } from '../dashboard/summary-layout.js';
import { MAX_NOTICE_PROBLEMS } from '../dashboard/summary-render.js';
import { loadArchitecture, type ArchitectureLoadResult } from '../dashboard/summary-schema.js';
import { readTaskList } from '../lib/task-list.js';

export interface SummaryArgs {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
}

export interface SummaryCommandDeps {
  isProject?: (cwd: string) => boolean;
  loadArchitecture?: (cwd: string) => ArchitectureLoadResult;
  layoutArchitecture?: typeof layoutArchitecture;
  readTasks?: (cwd: string) => readonly { id: string; status: string }[] | null;
  detectDrift?: typeof detectDrift;
  log?: (line: string) => void;
  error?: (line: string) => void;
}

const FILE = 'architecture.yml';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `  <code padded to 14><path, at least two spaces><message>`, as in the spec sample. */
export function formatFinding(f: DriftFinding): string {
  return `  ${f.code.padEnd(14)}${f.path}${' '.repeat(Math.max(2, 17 - f.path.length))}${f.message}`;
}

export function runSummary(cwd: string, args: SummaryArgs, deps: SummaryCommandDeps = {}): number {
  const log = deps.log ?? ((line: string) => console.log(line));
  const error = deps.error ?? ((line: string) => console.error(line));
  if (args.positionals.length > 0) {
    error('usage: sbl summary [--check]');
    return 1;
  }
  const check = args.values.check === true;
  const isProject = deps.isProject ?? ((c: string) => existsSync(join(c, 'backlog', 'config.yml')));
  if (!isProject(cwd)) {
    error('error: not inside a super-backlog project (backlog/config.yml not found) - run sbl init first');
    return 1;
  }
  const nextStep = (state: SummaryPromptState): void => {
    if (!check) log(`next step: ask your agent: "${summaryAgentPrompt(state)}"`);
  };

  // Loaded without task ids: with them the schema drops unknown ids before drift sees them.
  const load = (deps.loadArchitecture ?? ((c: string) => loadArchitecture(c)))(cwd);
  if (load.status === 'missing') {
    log(`[warn] ${FILE} not present`);
    nextStep('missing');
    return 4;
  }
  if (load.status === 'invalid') {
    const errors = load.problems.filter((p) => p.level === 'error');
    const shown = errors.slice(0, MAX_NOTICE_PROBLEMS);
    log(`[fail] ${FILE} invalid`);
    for (const p of shown) log(`  ${p.path}  ${p.message}`);
    if (errors.length > shown.length) log(`  … and ${errors.length - shown.length} more`);
    nextStep('invalid');
    return 1;
  }

  let layoutWarnings: string[];
  try {
    const layout = (deps.layoutArchitecture ?? layoutArchitecture)(load.architecture);
    layoutWarnings = layout.warnings.map((w) => `  layout ${w.code} ${w.edge}: ${w.message}`);
  } catch (err) {
    log(`[fail] ${FILE} layout failed (${errorMessage(err)})`);
    return 1;
  }
  const warnings = [...load.problems.map((p) => `  warning: ${p.path}: ${p.message}`), ...layoutWarnings];

  let drift: DriftResult;
  try {
    const tasks = (deps.readTasks ?? ((c: string) => readTaskList(c)))(cwd);
    drift = (deps.detectDrift ?? detectDrift)(cwd, load.architecture, { tasks });
  } catch (err) {
    log(`[warn] ${FILE} drift check failed (${errorMessage(err)})`);
    for (const line of warnings) log(line);
    return 4;
  }

  const findings = drift.findings.length;
  const driftText = findings === 0 ? 'no drift' : driftCount(findings);
  if (warnings.length === 0 && findings === 0) log(`[ok]   ${FILE} valid, no drift`);
  else if (warnings.length === 0) log(`[warn] ${FILE} valid, ${driftText}`);
  else log(`[warn] ${FILE} valid with ${warnings.length} warning(s), ${driftText}`);
  for (const line of warnings) log(line);
  for (const f of drift.findings) log(formatFinding(f));
  for (const note of drift.notes) log(`  note: ${note}`);
  if (findings > 0) nextStep('drift');
  return warnings.length === 0 && findings === 0 ? 0 : 4;
}
