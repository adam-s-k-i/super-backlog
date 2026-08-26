import { describe, expect, it } from 'vitest';
import { extractChangelogSection, verifyRelease } from '../../scripts/verify-release.mjs';

const CL = [
  '# Changelog',
  '',
  '## [0.2.0] - 2026-09-01',
  '',
  '### Added',
  '',
  '- x',
  '',
  '## [0.1.0] - 2026-08-26',
  '',
  '### Added',
  '',
  '- y',
  ''
].join('\n');

describe('verifyRelease', () => {
  it('passes when version matches changelog entry and remote tag exists', () => {
    expect(verifyRelease({ version: '0.2.0', changelogText: CL, remoteTagExists: true })).toEqual([]);
  });

  it('fails on missing changelog entry', () => {
    const problems = verifyRelease({ version: '0.3.0', changelogText: CL, remoteTagExists: true });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('0.3.0');
  });

  it('fails on missing remote tag', () => {
    expect(verifyRelease({ version: '0.2.0', changelogText: CL, remoteTagExists: false })).toHaveLength(1);
  });
});

describe('extractChangelogSection', () => {
  it('returns the section body for the requested version', () => {
    const section = extractChangelogSection(CL, '0.1.0');
    expect(section).toContain('- y');
    expect(section).not.toContain('- x');
  });

  it('returns null when absent', () => {
    expect(extractChangelogSection(CL, '9.9.9')).toBeNull();
  });
});
