// src/dashboard/render.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DashboardData, DashboardStatusCount } from './data.js';

export interface PipelinePhase {
  n: number;
  name: string;
  gate: string;
  /** Copyable command that drives this phase; human-only gates have none. */
  command?: string;
}

/** The nine pipeline phases; must stay consistent with src/templates/workflow-block.md. */
export const PIPELINE_PHASES: readonly PipelinePhase[] = [
  { n: 1, name: 'Idea', gate: 'User states a need; capture it before doing anything else' },
  { n: 2, name: 'Brainstorming', gate: 'Explore intent, requirements and design before any creative work', command: '/superpowers:brainstorming' },
  { n: 3, name: 'Design gate', gate: 'Human approves the design document' },
  { n: 4, name: 'Spec-to-backlog', gate: 'Decompose the approved design into reviewed tasks with acceptance criteria', command: '/spec-to-backlog' },
  { n: 5, name: 'Review gate', gate: 'Human reviews specs and acceptance criteria before any code exists', command: '/task-review-gate' },
  { n: 6, name: 'Plan-before-code', gate: 'A written implementation plan is approved by the human', command: '/superpowers:writing-plans' },
  { n: 7, name: 'TDD implementation', gate: 'Failing test first, then code; one task per session/PR', command: '/superpowers:subagent-driven-development' },
  { n: 8, name: 'Verification & final summary', gate: 'Run tests/lint/typecheck; verification evidence before success claims', command: '/superpowers:verification-before-completion' },
  { n: 9, name: 'Merge & archive', gate: 'Merge the branch, then close/archive the task via the backlog CLI', command: 'backlog task archive <id>' },
];

function readTemplate(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // src/dashboard at dev time, dist/dashboard at runtime
  const candidates = [
    join(here, '..', 'templates', 'dashboard.html'),
    join(here, 'templates', 'dashboard.html'),
  ];
  for (const c of candidates) if (existsSync(c)) return readFileSync(c, 'utf8');
  throw new Error('template not found: dashboard.html');
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function toneFor(status: string): 'ok' | 'accent' | 'warn' | 'danger' | 'dim' {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'complete' || s === 'completed') return 'ok';
  if (s.includes('progress') || s === 'review') return 'accent';
  if (s.includes('block') || s === 'rejected') return 'danger';
  if (s.includes('hold') || s.includes('wait') || s === 'draft') return 'warn';
  return 'dim';
}

/** Sidebar pills with live counts; click-to-filter wiring lands in a later task. */
function statusPillsHtml(statuses: readonly DashboardStatusCount[]): string {
  if (statuses.length === 0) return '<span class="pill-empty">no data</span>';
  return statuses
    .map(
      (s) =>
        `<button type="button" class="pill" data-status="${esc(s.status)}"` +
        ` data-count="${s.count}" data-tone="${toneFor(s.status)}">` +
        `<span class="n">${s.count}</span> ${esc(s.status)}</button>`,
    )
    .join('\n      ');
}

function jsonIsland(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Fill the static template shell with data; all dynamic task/metric content stays in the JSON islands. */
export function renderDashboard(data: DashboardData): string {
  return readTemplate()
    .replaceAll('__PROJECT_NAME__', () => esc(data.project.name))
    .replaceAll('__PROJECT_DESC__', () => esc(data.project.description))
    .replaceAll('__GENERATED_AT__', () => esc(data.generatedAt))
    .replaceAll('__KIT_VERSION__', () => esc(data.kitVersion))
    .replaceAll('__STATUS_PILLS__', () => statusPillsHtml(data.statuses))
    .replaceAll('__SBL_DATA_JSON__', () => jsonIsland(data))
    .replaceAll('__SBL_GLOSSARY_JSON__', () => jsonIsland(data.glossary))
    .replaceAll('__SBL_PHASES_JSON__', () => jsonIsland(PIPELINE_PHASES));
}
