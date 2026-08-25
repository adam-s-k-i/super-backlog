// src/dashboard/render.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/** The nine pipeline phases; must stay consistent with src/templates/workflow-block.md. */
export const PIPELINE_PHASES = [
    { n: 1, name: 'Idea', gate: 'User states a need; capture it before doing anything else' },
    { n: 2, name: 'Brainstorming', gate: 'Explore intent, requirements and design before any creative work' },
    { n: 3, name: 'Design gate', gate: 'Human approves the design document' },
    { n: 4, name: 'Spec-to-backlog', gate: 'Decompose the approved design into reviewed tasks with acceptance criteria' },
    { n: 5, name: 'Review gate', gate: 'Human reviews specs and acceptance criteria before any code exists' },
    { n: 6, name: 'Plan-before-code', gate: 'A written implementation plan is approved by the human' },
    { n: 7, name: 'TDD implementation', gate: 'Failing test first, then code; one task per session/PR' },
    { n: 8, name: 'Verification & final summary', gate: 'Run tests/lint/typecheck; verification evidence before success claims' },
    { n: 9, name: 'Merge & archive', gate: 'Merge the branch, then close/archive the task via the backlog CLI' },
];
function readTemplate() {
    const here = dirname(fileURLToPath(import.meta.url)); // src/dashboard at dev time, dist/dashboard at runtime
    const candidates = [
        join(here, '..', 'templates', 'dashboard.html'),
        join(here, 'templates', 'dashboard.html'),
    ];
    for (const c of candidates)
        if (existsSync(c))
            return readFileSync(c, 'utf8');
    throw new Error('template not found: dashboard.html');
}
function esc(s) {
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
function phasesHtml() {
    return PIPELINE_PHASES.map((p) => `<div class="phase"><span class="phase-n">${p.n}</span>` +
        `<div class="phase-body"><span class="phase-name">${esc(p.name)}</span>` +
        `<span class="phase-gate">${esc(p.gate)}</span></div></div>`).join('\n          ');
}
/** Fill the static template shell with data; all dynamic task/metric content stays in the JSON island. */
export function renderDashboard(data) {
    const islandJson = JSON.stringify(data).replace(/</g, '\\u003c');
    return readTemplate()
        .replaceAll('__PROJECT_NAME__', () => esc(data.project.name))
        .replaceAll('__PROJECT_DESC__', () => esc(data.project.description))
        .replaceAll('__GENERATED_AT__', () => esc(data.generatedAt))
        .replaceAll('__KIT_VERSION__', () => esc(data.kitVersion))
        .replaceAll('__PIPELINE_PHASES__', () => phasesHtml())
        .replaceAll('__SBL_DATA_JSON__', () => islandJson);
}
