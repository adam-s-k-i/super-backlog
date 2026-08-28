// test/unit/update.test.ts
import { describe, expect, it } from 'vitest';

import { refreshActions } from '../../src/commands/update.js';
import type { Action } from '../../src/init/planner.js';

const FULL_PLAN: Action[] = [
  { kind: 'upstream-install', pm: 'npm' },
  { kind: 'merge-json', path: 'opencode.json', transform: 'plugin-entry' },
  { kind: 'merge-json', path: 'package.json', transform: 'scripts-and-devdeps' },
  { kind: 'inject-agents-block' },
  { kind: 'write-claude-pointer' },
  { kind: 'copy-skills' },
  { kind: 'install-guard-hook' },
  { kind: 'write', path: 'backlog/config.yml', contents: 'project_name: demo\n' },
];

describe('refreshActions', () => {
  it('keeps exactly the four refresh kinds in plan order', () => {
    expect(refreshActions(FULL_PLAN).map((a) => a.kind)).toEqual([
      'inject-agents-block',
      'write-claude-pointer',
      'copy-skills',
      'install-guard-hook',
    ]);
  });

  it('drops upstream installs, json merges and raw writes', () => {
    const kinds = new Set(refreshActions(FULL_PLAN).map((a) => a.kind));
    expect(kinds.has('upstream-install')).toBe(false);
    expect(kinds.has('merge-json')).toBe(false);
    expect(kinds.has('write')).toBe(false);
  });

  it('returns an empty plan for merge-only input', () => {
    expect(
      refreshActions([{ kind: 'merge-json', path: 'package.json', transform: 'scripts-and-devdeps' }]),
    ).toEqual([]);
  });

  it('handles an empty plan', () => {
    expect(refreshActions([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const snapshot = [...FULL_PLAN];
    refreshActions(FULL_PLAN);
    expect(FULL_PLAN).toEqual(snapshot);
  });
});
