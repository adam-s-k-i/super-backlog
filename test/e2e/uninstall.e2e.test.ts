// test/e2e/uninstall.e2e.test.ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runCli, scaffoldAndInit } from './helpers.js';

const PLUGIN_SPEC = 'superpowers@git+https://github.com/obra/superpowers.git';

describe('sbl uninstall (SBL_SKIP_INSTALL)', () => {
  const dirs: string[] = [];
  function scaffold(): string {
    const dir = scaffoldAndInit();
    dirs.push(dir);
    return dir;
  }
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('removes only owned artifacts and keeps project data by default', () => {
    const dir = scaffold();

    // foreign / modified content that must survive
    const pkgPath = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    pkg.scripts.board = 'my-custom-board'; // differs from kit default
    pkg.devDependencies['backlog.md'] = '^5.0.0'; // pinned, not 'latest'
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    mkdirSync(join(dir, '.claude', 'skills', 'foreign'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'skills', 'foreign', 'SKILL.md'),
      '# Foreign skill\n\nnot ours\n',
    );
    writeFileSync(join(dir, 'dashboard.html'), '<html>demo</html>');

    const out = runCli(dir, ['uninstall']);

    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    expect(agents).not.toMatch(/SUPER-BACKLOG:\d+\.\d+\.\d+ START/);
    expect(agents).not.toContain('SUPER-BACKLOG END');

    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(claude).not.toMatch(/Workflow system \(managed by super-backlog\)/);

    expect(existsSync(join(dir, '.opencode', 'skill', 'spec-to-backlog'))).toBe(false);
    expect(existsSync(join(dir, '.claude', 'skills', 'spec-to-backlog'))).toBe(false);
    expect(existsSync(join(dir, '.claude', 'skills', 'foreign', 'SKILL.md'))).toBe(true);

    const after = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      scripts: Record<string, string | undefined>;
      devDependencies: Record<string, string | undefined>;
    };
    expect(after.scripts.tasks).toBeUndefined();
    expect(after.scripts.browser).toBeUndefined();
    expect(after.scripts.dashboard).toBeUndefined();
    expect(after.scripts.board).toBe('my-custom-board'); // kept
    expect(after.devDependencies['super-backlog']).toBeUndefined(); // was 'latest'
    expect(after.devDependencies['backlog.md']).toBe('^5.0.0'); // kept, pinned

    const oc = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8')) as {
      plugin?: string[];
    };
    expect(oc.plugin).toBeUndefined(); // emptied array -> key deleted

    expect(existsSync(join(dir, '.git', 'hooks', 'pre-commit'))).toBe(false); // hook gone
    expect(existsSync(join(dir, 'dashboard.html'))).toBe(false); // removed

    // default: project data untouched
    expect(existsSync(join(dir, 'backlog', 'config.yml'))).toBe(true);
    expect(out).toContain('removed:');
    expect(out).toContain('kept:');
    expect(out).not.toMatch(/DATA DELETED/i);

    // second run is a clean no-op with exit 0
    const out2 = runCli(dir, ['uninstall']);
    expect(out2).toContain('skipped:');
    expect(out2).not.toContain('removed:');
    expect(existsSync(join(dir, 'backlog', 'config.yml'))).toBe(true);
  });

  it('--with-backlog deletes devDeps regardless of spec and removes backlog/', () => {
    const dir = scaffold();

    const pkgPath = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    pkg.devDependencies['backlog.md'] = '^5.0.0'; // non-'latest' spec
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

    const out = runCli(dir, ['uninstall', '--with-backlog']);

    expect(existsSync(join(dir, 'backlog'))).toBe(false);
    const after = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      devDependencies: Record<string, string | undefined>;
    };
    expect(after.devDependencies['backlog.md']).toBeUndefined();
    expect(after.devDependencies['super-backlog']).toBeUndefined();

    const oc = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect((oc as { plugin?: string[] }).plugin).toBeUndefined();
    expect(out).toMatch(/plugin/);
    expect(JSON.stringify(oc)).not.toContain(PLUGIN_SPEC);
    expect(out).toMatch(/DATA DELETED/i); // prominent data-deleted notice
  });
});
