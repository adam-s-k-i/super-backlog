// test/unit/planner.test.ts
import { describe, expect, it } from 'vitest';
import { planInit, type InitState } from '../../src/init/planner.js';

const base: InitState = {
  cwd: '/proj', detectedPm: 'npm', hasBacklogConfig: false,
  agentsExists: false, claudeMdExists: false, opencodeConfig: undefined, pkgExists: true,
};

describe('planInit', () => {
  it('plans full flow for defaults', () => {
    const { actions, warnings } = planInit(base, {
      harnesses: ['opencode', 'claude'], pm: 'auto', guard: false, dashboard: true, skipInstall: false,
    }, '1.0.0');
    const kinds = actions.map(a => a.kind);
    expect(kinds).toContain('upstream-install');
    expect(kinds).toContain('merge-json');
    expect(kinds.filter(k => k === 'merge-json')).toHaveLength(2);
    expect(kinds).toContain('inject-agents-block');
    expect(kinds).toContain('write-claude-pointer');
    expect(kinds).toContain('copy-skills');
    expect(kinds).toContain('generate-dashboard');
    expect(warnings).toEqual([]);
  });

  it('skips upstream when skipInstall', () => {
    const { actions } = planInit(base, { harnesses: ['opencode'], pm: 'auto', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(actions.map(a => a.kind)).not.toContain('upstream-install');
  });

  it('warns and skips upstream without detected PM', () => {
    const { actions, warnings } = planInit({ ...base, detectedPm: null, pkgExists: false },
      { harnesses: ['opencode'], pm: 'auto', guard: false, dashboard: false, skipInstall: false }, '1.0.0');
    expect(actions.map(a => a.kind)).not.toContain('upstream-install');
    expect(warnings.join(' ')).toMatch(/no package manager detected/i);
    expect(warnings.join(' ')).not.toMatch(/JSON merges/i); // opencode.json merge is NOT gated on PM
    const jsonOps = actions.filter(a => a.kind === 'merge-json') as Array<{ kind: 'merge-json'; path: string }>;
    expect(jsonOps.map(a => a.path)).toEqual(['opencode.json']);
  });

  it('still warns about near-miss entry without package.json present', () => {
    const { actions, warnings } = planInit(
      { ...base, detectedPm: null, pkgExists: false, opencodeConfig: { plugin: ['superpowers@git+https://example.com/fork.git'] } },
      { harnesses: ['opencode'], pm: 'auto', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(actions.filter(a => a.kind === 'merge-json')).toHaveLength(0);
    expect(warnings.join(' ')).toMatch(/refusing/i);
  });

  it('omits opencode merge on near-miss entry with warning', () => {
    const { actions, warnings } = planInit(
      { ...base, opencodeConfig: { plugin: ['superpowers@git+https://example.com/fork.git'] } },
      { harnesses: ['opencode'], pm: 'skip', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(actions.filter(a => a.kind === 'merge-json' && (a as any).path === 'opencode.json')).toHaveLength(0);
    expect(warnings.join(' ')).toMatch(/refusing/i);
  });

  it('claude-only skips opencode merge but still merges package.json', () => {
    const { actions } = planInit(base, { harnesses: ['claude'], pm: 'skip', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    const jsonOps = actions.filter(a => a.kind === 'merge-json') as Array<{ kind: 'merge-json'; path: string }>;
    expect(jsonOps.map(a => a.path)).toEqual(['package.json']);
    expect(actions.some(a => a.kind === 'write-claude-pointer')).toBe(true);
  });

  it('stays silent about a missing PM when install is skipped anyway', () => {
    const { actions, warnings } = planInit({ ...base, detectedPm: null },
      { harnesses: ['opencode'], pm: 'auto', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(warnings).toEqual([]);
    expect(actions.map(a => a.kind)).not.toContain('upstream-install');
  });

  it('merges only opencode.json when package.json is absent', () => {
    const { actions } = planInit({ ...base, detectedPm: 'npm', pkgExists: false },
      { harnesses: ['opencode', 'claude'], pm: 'skip', guard: false, dashboard: true, skipInstall: true }, '1.0.0');
    const jsonOps = actions.filter(a => a.kind === 'merge-json') as Array<{ kind: 'merge-json'; path: string }>;
    expect(jsonOps.map(a => a.path)).toEqual(['opencode.json']);
  });

  it('omits dashboard generation when dashboard is off', () => {
    const { actions } = planInit(base,
      { harnesses: ['opencode'], pm: 'skip', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(actions.some(a => a.kind === 'generate-dashboard')).toBe(false);
  });

  it('omits the claude pointer for opencode-only runs', () => {
    const { actions } = planInit(base,
      { harnesses: ['opencode'], pm: 'skip', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(actions.some(a => a.kind === 'write-claude-pointer')).toBe(false);
  });

  it('adds guard hook action only when requested', () => {
    const with_ = planInit(base, { harnesses: ['opencode'], pm: 'skip', guard: true, dashboard: false, skipInstall: true }, '1.0.0');
    const without = planInit(base, { harnesses: ['opencode'], pm: 'skip', guard: false, dashboard: false, skipInstall: true }, '1.0.0');
    expect(with_.actions.some(a => a.kind === 'install-guard-hook')).toBe(true);
    expect(without.actions.some(a => a.kind === 'install-guard-hook')).toBe(false);
  });
});
