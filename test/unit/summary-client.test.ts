// @vitest-environment happy-dom
// test/unit/summary-client.test.ts — runs the summary page script against a real DOM (happy-dom).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import type { DashboardData } from '../../src/dashboard/data.js';
import { layoutArchitecture } from '../../src/dashboard/summary-layout.js';
import { emptyFacts, renderSummary, type SummaryModel } from '../../src/dashboard/summary-render.js';
import { ARCHITECTURE_PATH, checkArchitectureText } from '../../src/dashboard/summary-schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(here, '..', 'fixtures', 'summary', 'architecture.super-backlog.yml'), 'utf8');

const DATA = {
  project: { name: 'Demo', description: 'Demo project' },
  tasks: [],
  source: 'backlog-json',
} as unknown as DashboardData;

function model(): SummaryModel {
  const load = checkArchitectureText(FIXTURE, ARCHITECTURE_PATH);
  if (load.status !== 'valid') throw new Error('fixture invalid');
  return { facts: emptyFacts(), load, layout: layoutArchitecture(load.architecture), renderError: null, drift: null };
}

const $ = <T extends Element = Element>(s: string): T => {
  const el = document.querySelector<T>(s);
  if (!el) throw new Error(`no element ${s}`);
  return el;
};
const key = (target: EventTarget, k: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
};

let flowId = '';
let firstStep = '';

beforeAll(() => {
  const m = model();
  if (m.load.status !== 'valid') throw new Error('unreachable');
  flowId = m.load.architecture.flows[0].id;
  firstStep = m.load.architecture.flows[0].steps[0];
  const html = renderSummary(DATA, m);
  // body only, cut out as text: parsing the head (even via DOMParser) makes happy-dom
  // fetch the remote fonts, and its theme script is not under test
  const body = /<body>([\s\S]*)<\/body>/.exec(html);
  if (!body) throw new Error('no <body> in the rendered page');
  document.body.innerHTML = body[1];
  const main = [...document.body.querySelectorAll('script')].find((s) => !s.type && s.textContent?.includes("getElementById('sbl-summary')"));
  if (!main) throw new Error('page script not found');
  if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') {
    (globalThis as { CSS?: unknown }).CSS = { escape: (s: string) => s.replace(/[^\w-]/g, (c) => `\\${c}`) };
  }
  new Function(main.textContent ?? '')();
});

describe('summary page client (happy-dom)', () => {
  it('marks Summary as the current tab and links the sibling pages', () => {
    const tabs = [...document.querySelectorAll<HTMLAnchorElement>('nav.tabs a')];
    expect(tabs.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')])).toEqual([
      ['Dashboard', '../', null],
      ['Summary', './', 'page'],
      ['Backlog', '../bb/', null],
    ]);
  });

  it('selecting a flow presses its chip, animates the canvas, numbers the steps and fills the panel', () => {
    const chip = $<HTMLButtonElement>(`#flows .chip[data-flow="${flowId}"]`);
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect($('#stage svg').classList.contains('flowing')).toBe(true);
    const hot = $(`.edge[data-id="${firstStep}"]`);
    expect(hot.classList.contains('hot')).toBe(true);
    expect(hot.querySelector('.step text')?.textContent).toBe('1');
    expect($('#panel').textContent?.trim().length).toBeGreaterThan(0);
  });

  it('a second click on the chip clears the flow', () => {
    const chip = $<HTMLButtonElement>(`#flows .chip[data-flow="${flowId}"]`);
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect($('#stage svg').classList.contains('flowing')).toBe(false);
  });

  it('Escape clears an active flow', () => {
    const chip = $<HTMLButtonElement>(`#flows .chip[data-flow="${flowId}"]`);
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    key(document.body, 'Escape');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect($('#stage svg').classList.contains('flowing')).toBe(false);
  });

  it('Enter on a focused node selects it', () => {
    const node = $('#stage svg .node');
    key(node, 'Enter');
    expect(node.classList.contains('sel')).toBe(true);
    key(document.body, 'Escape');
    expect(node.classList.contains('sel')).toBe(false);
  });
});
