import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectSlug } from '../../src/lib/slug.js';

const dirs: string[] = [];
function fresh(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), name));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe('projectSlug', () => {
  it('uses project_name from backlog/config.yml', () => {
    const cwd = fresh('sbl-slug-');
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), 'project_name: Acme Webshop\n');
    expect(projectSlug(cwd)).toEqual({ ok: true, slug: 'acme-webshop' });
  });

  it('does not use package.json name when project_name is absent', () => {
    const cwd = fresh('sbl-slug-pkg-');
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'not-the-slug' }));
    const slug = projectSlug(cwd);
    expect(slug.ok).toBe(true);
    if (slug.ok) expect(slug.slug).not.toBe('not-the-slug');
  });

  it('returns empty when sanitize strips everything', () => {
    const cwd = fresh('sbl-slug-empty-');
    mkdirSync(join(cwd, 'backlog'));
    writeFileSync(join(cwd, 'backlog', 'config.yml'), 'project_name: ---\n');
    expect(projectSlug(cwd)).toEqual({ ok: false, reason: 'empty' });
  });
});
