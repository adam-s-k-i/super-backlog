import { describe, expect, it } from 'vitest';
import { FINGERPRINT_RE, isOwnedSkillFile, renderSkill } from '../../src/lib/ownership.js';

const FRONT = `---\nname: spec-to-backlog\ndescription: bridge skill\n---\n\n# Spec to Backlog\n`;

describe('skill ownership', () => {
  it('renders fingerprint after frontmatter', () => {
    const out = renderSkill(FRONT, '1.0.0');
    expect(out).toMatch(FINGERPRINT_RE);
    const fmEnd = out.indexOf('---', 3);
    expect(out.indexOf('managed-by')).toBeGreaterThan(fmEnd);
  });
  it('recognizes rendered files as owned regardless of version', () => {
    expect(isOwnedSkillFile(renderSkill(FRONT, '9.9.9'))).toBe(true);
  });
  it('does not claim foreign skills', () => {
    expect(isOwnedSkillFile(FRONT)).toBe(false);
  });
});
