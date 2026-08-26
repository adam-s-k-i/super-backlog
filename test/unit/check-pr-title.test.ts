import { describe, expect, it } from 'vitest';
import { isValidTitle } from '../../scripts/check-pr-title.mjs';

describe('isValidTitle', () => {
  it('accepts conventional titles', () => {
    expect(isValidTitle('feat: add search')).toBe(true);
    expect(isValidTitle('fix(cli): exit 1 on bad JSON')).toBe(true);
    expect(isValidTitle('chore(deps): bump vite from 5 to 6')).toBe(true);
    expect(isValidTitle('feat!: breaking change')).toBe(true);
    expect(isValidTitle('ci(workflows): pin actions by sha')).toBe(true);
  });

  it('rejects non-conventional titles', () => {
    expect(isValidTitle('Update stuff')).toBe(false);
    expect(isValidTitle('feature: wrong type')).toBe(false);
    expect(isValidTitle('feat:no space')).toBe(false);
    expect(isValidTitle('')).toBe(false);
    expect(isValidTitle('feat: ')).toBe(false);
    expect(isValidTitle('feat')).toBe(false);
  });
});
