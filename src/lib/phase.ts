// src/lib/phase.ts
export const PHASES = ['spec', 'plan', 'impl', 'verify'] as const;

export type Phase = (typeof PHASES)[number];
export type PhaseTarget = Phase | 'done';

export const PHASE_LABEL_PREFIX = 'phase/';

const PHASE_LABELS: readonly string[] = PHASES.map((p) => PHASE_LABEL_PREFIX + p);

export function phaseLabel(p: Phase): string {
  return PHASE_LABEL_PREFIX + p;
}

export function isPhaseTarget(v: string): v is PhaseTarget {
  return v === 'done' || (PHASES as readonly string[]).includes(v);
}

export function extractPhaseLabels(labels: readonly string[]): string[] {
  return labels.filter((l) => l.startsWith(PHASE_LABEL_PREFIX));
}

export function derivePhase(labels: readonly string[]): Phase | null {
  const found = labels.find((l) => (PHASE_LABELS as readonly string[]).includes(l));
  return found ? (found.slice(PHASE_LABEL_PREFIX.length) as Phase) : null;
}

export interface TransitionPlan {
  remove: string | null;
  add: string | null;
}

export type TransitionResult =
  | { ok: true; plan: TransitionPlan }
  | { ok: false; reason: 'unknown-phase' | 'no-phase' | 'multiple-phases' };

export function planTransition(labels: readonly string[], target: PhaseTarget): TransitionResult {
  if (!isPhaseTarget(target)) return { ok: false, reason: 'unknown-phase' };
  const phaseLabels = extractPhaseLabels(labels);
  if (phaseLabels.length > 1) return { ok: false, reason: 'multiple-phases' };
  const current = phaseLabels[0] ?? null;
  if (current === null && target !== 'spec') return { ok: false, reason: 'no-phase' };
  const remove = current;
  const add = target === 'done' ? null : phaseLabel(target);
  return { ok: true, plan: { remove, add } };
}
