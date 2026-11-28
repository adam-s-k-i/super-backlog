// test/unit/summary-command.test.ts
import { describe, expect, it } from 'vitest';

import { runSummary, SUMMARY_DEPRECATION } from '../../src/commands/summary.js';

function run(overrides: Parameters<typeof runSummary>[1] = {}): { code: number; lines: string[] } {
  const lines: string[] = [];
  const code = runSummary('/proj', { isProject: () => true, log: (l) => lines.push(l), ...overrides });
  return { code, lines };
}

describe('sbl summary (deprecation stub)', () => {
  it('names the replacement', () => {
    expect(SUMMARY_DEPRECATION).toBe(
      'sbl summary no longer checks backlog/docs/architecture.yml: the curated architecture file was replaced by Floorplan (https://github.com/haydenschmitty/floorplan).',
    );
  });

  it('prints the deprecation line and the map status inside a project, exit 0', () => {
    const { code, lines } = run({
      readFloorplanStatus: () => ({ state: 'map', builtAt: '2026-11-28T13:46:30.507Z', files: 165, nodes: 11, commitsSince: 2 }),
    });
    expect(code).toBe(0);
    expect(lines).toEqual([
      SUMMARY_DEPRECATION,
      'map status: floorplan map built 2026-11-28, 2 commits behind HEAD (165 files, 11 parts)',
    ]);
  });

  it('stays at exit 0 for a missing or unreadable map', () => {
    expect(run({ readFloorplanStatus: () => ({ state: 'missing' }) })).toEqual({
      code: 0,
      lines: [
        SUMMARY_DEPRECATION,
        'map status: no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)',
      ],
    });
    expect(run({ readFloorplanStatus: () => ({ state: 'invalid', reason: 'not valid JSON' }) }).code).toBe(0);
  });

  it('prints only the deprecation line outside a project and does not read the map', () => {
    let read = 0;
    const { code, lines } = run({
      isProject: () => false,
      readFloorplanStatus: () => {
        read += 1;
        return { state: 'missing' };
      },
    });
    expect(code).toBe(0);
    expect(lines).toEqual([SUMMARY_DEPRECATION]);
    expect(read).toBe(0);
  });
});
