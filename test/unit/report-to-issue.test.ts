import { describe, expect, it } from 'vitest';
import { pickIssue } from '../../scripts/report-to-issue.mjs';

describe('pickIssue', () => {
  const issues = [
    { number: 7, title: 'Dependency Health' },
    { number: 9, title: 'Other' }
  ];

  it('matches exact open issue title case-insensitively', () => {
    expect(pickIssue(issues, 'dependency health')).toBe(7);
    expect(pickIssue(issues, 'Dependency Health')).toBe(7);
  });

  it('returns null when no issue matches', () => {
    expect(pickIssue(issues, 'missing')).toBeNull();
    expect(pickIssue([], 'anything')).toBeNull();
  });
});
