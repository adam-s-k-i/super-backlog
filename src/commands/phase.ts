// src/commands/phase.ts
import { derivePhase, extractPhaseLabels, isPhaseTarget, planTransition } from '../lib/phase.js';
import { resolveBacklogBin, runCapture, type RunResult } from '../lib/run.js';

export interface PhaseDeps {
  resolveBacklog?: (cwd: string) => string | null;
  run?: (cmd: string, args: string[], cwd: string) => RunResult;
  log?: (line: string) => void;
}

interface TaskViewShape {
  task?: { id?: string; labels?: unknown };
}

function readLabels(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw) as TaskViewShape;
    const labels = parsed?.task?.labels;
    if (!Array.isArray(labels)) return null;
    return labels.filter((l): l is string => typeof l === 'string');
  } catch {
    return null;
  }
}

export function runPhase(
  cwd: string,
  args: { values: Record<string, unknown>; positionals: string[] },
  deps: PhaseDeps = {},
): number {
  const resolveBacklog = deps.resolveBacklog ?? resolveBacklogBin;
  const run = deps.run ?? runCapture;
  const log = deps.log ?? ((line: string) => console.log(line));

  const id = args.positionals[0];
  const target = args.positionals[1];
  const json = args.values['json'] === true;

  if (!id || (target !== undefined && !isPhaseTarget(target))) {
    log(`usage: sbl phase <task-id> [${['spec', 'plan', 'impl', 'verify', 'done'].join('|')}] [--json]`);
    return 1;
  }

  const bin = resolveBacklog(cwd);
  if (!bin) {
    log('error: backlog CLI not found - run sbl init or npm install first');
    return 1;
  }

  const view = run(bin, ['task', 'view', id, '--json'], cwd);
  if (view.status !== 0) {
    log(`error: backlog task view ${id} failed (exit ${view.status})`);
    if (view.stderr.trim()) log(view.stderr.trim());
    return 1;
  }
  const labels = readLabels(view.stdout);
  if (labels === null) {
    log(`error: unreadable task view JSON for ${id}`);
    return 1;
  }

  const phase = derivePhase(labels);

  if (target === undefined) {
    if (json) {
      log(JSON.stringify({ id, phase, labels: extractPhaseLabels(labels) }));
    } else {
      log(phase ? `${id}: phase/${phase}` : `${id}: none`);
    }
    return 0;
  }

  const result = planTransition(labels, target);
  if (!result.ok) {
    if (result.reason === 'multiple-phases') {
      log(`error: ${id} carries multiple phase labels (${extractPhaseLabels(labels).join(', ')}) - run sbl doctor`);
    } else if (result.reason === 'no-phase') {
      log(`error: ${id} has no phase label - start with: sbl phase ${id} spec`);
    } else {
      log(`error: unknown phase "${String(target)}"`);
    }
    return 1;
  }

  const { remove, add } = result.plan;
  if (remove === null && add === null) {
    log(`${id}: no phase label present, nothing to do`);
    return 0;
  }

  const editArgs = ['task', 'edit', id];
  if (remove) editArgs.push('--remove-label', remove);
  if (add) editArgs.push('--add-label', add);
  const edit = run(bin, editArgs, cwd);
  if (edit.status !== 0) {
    log(`error: backlog task edit failed (exit ${edit.status})`);
    if (edit.stderr.trim()) log(edit.stderr.trim());
    return 3;
  }

  log(add ? `${id}: ${add}` : `${id}: phase label removed (done)`);
  return 0;
}
