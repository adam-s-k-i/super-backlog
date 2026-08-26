// test/unit/repository-field.test.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  repository?: { type?: string; url?: string };
};

// npm trusted publishing validates repository.url against the GitHub repo;
// a missing or mismatched field makes OIDC publishes fail with 404/ENEEDAUTH.
describe('package.json repository field', () => {
  it('has repository.url exactly matching the GitHub repo', () => {
    expect(pkg.repository?.url).toBe('https://github.com/adam-s-k-i/super-backlog');
  });
  it('declares repository type git', () => {
    expect(pkg.repository?.type).toBe('git');
  });
});
