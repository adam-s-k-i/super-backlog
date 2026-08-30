import { describe, expect, it } from 'vitest';
import {
  PHASES,
  derivePhase,
  extractPhaseLabels,
  isPhaseTarget,
  phaseLabel,
  planTransition,
} from '../../src/lib/phase.js';

describe('phase constants', () => {
  it('defines the four task phases', () => {
    expect(PHASES).toEqual(['spec', 'plan', 'impl', 'verify']);
    expect(phaseLabel('spec')).toBe('phase/spec');
  });
  it('recognizes valid targets including done', () => {
    for (const t of ['spec', 'plan', 'impl', 'verify', 'done']) expect(isPhaseTarget(t)).toBe(true);
    expect(isPhaseTarget('plans')).toBe(false);
    expect(isPhaseTarget('')).toBe(false);
  });
});

describe('extractPhaseLabels / derivePhase', () => {
  it('keeps only phase/* labels, ignoring others', () => {
    expect(extractPhaseLabels(['feature', 'phase/plan', 'ci'])).toEqual(['phase/plan']);
  });
  it('derivePhase returns the first phase or null (lenient display)', () => {
    expect(derivePhase(['feature', 'phase/impl'])).toBe('impl');
    expect(derivePhase(['feature'])).toBeNull();
    expect(derivePhase([])).toBeNull();
  });
});

describe('planTransition', () => {
  it('sets spec on a task without a phase label', () => {
    expect(planTransition(['feature'], 'spec')).toEqual({
      ok: true,
      plan: { remove: null, add: 'phase/spec' },
    });
  });
  it('advances spec -> plan, preserving other labels untouched', () => {
    expect(planTransition(['feature', 'phase/spec'], 'plan')).toEqual({
      ok: true,
      plan: { remove: 'phase/spec', add: 'phase/plan' },
    });
  });
  it('done removes the label only', () => {
    expect(planTransition(['phase/verify'], 'done')).toEqual({
      ok: true,
      plan: { remove: 'phase/verify', add: null },
    });
  });
  it('same-phase transition is a self-replacing no-op plan', () => {
    expect(planTransition(['phase/impl'], 'impl')).toEqual({
      ok: true,
      plan: { remove: 'phase/impl', add: 'phase/impl' },
    });
  });
  it('rejects unknown phase values', () => {
    expect(planTransition(['phase/spec'], 'deploy' as never)).toEqual({
      ok: false,
      reason: 'unknown-phase',
    });
  });
  it('rejects non-spec transitions on a task with no phase label', () => {
    for (const target of ['plan', 'impl', 'verify', 'done'] as const) {
      expect(planTransition(['feature'], target)).toEqual({ ok: false, reason: 'no-phase' });
    }
  });
  it('rejects tasks carrying two phase labels', () => {
    expect(planTransition(['phase/spec', 'phase/impl'], 'plan')).toEqual({
      ok: false,
      reason: 'multiple-phases',
    });
  });
});
