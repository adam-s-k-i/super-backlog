import { describe, expect, it } from 'vitest';
import { findUnpinnedActions } from '../../scripts/check-action-pinning.mjs';

describe('findUnpinnedActions', () => {
  it('accepts SHA-pinned and local actions', () => {
    const y = [
      '- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2',
      '- uses: ./scripts/local'
    ].join('\n');
    expect(findUnpinnedActions(y)).toEqual([]);
  });

  it('flags tags and branch refs', () => {
    const y = ['- uses: actions/checkout@v4', '      - uses: actions/setup-node@main'].join('\n');
    const bad = findUnpinnedActions(y);
    expect(bad.map((b) => b.action)).toEqual(['actions/checkout', 'actions/setup-node']);
    expect(bad.map((b) => b.ref)).toEqual(['v4', 'main']);
  });

  it('ignores non-uses lines', () => {
    expect(findUnpinnedActions('run: echo "uses: nothing@v1"')).toEqual([]);
  });
});
