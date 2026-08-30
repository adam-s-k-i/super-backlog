import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const troubleshooting = readFileSync(join(root, 'docs', 'guide', 'troubleshooting.md'), 'utf8');

describe('README doc-rot guard', () => {
  it('contains the quickstart command', () => {
    expect(readme).toContain('irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.ps1 | iex');
  });

  it('never references the stale /main/ branch in raw installer URLs', () => {
    const docsQuickstart = readFileSync(join(root, 'docs', 'guide', 'quickstart.md'), 'utf8');
    for (const text of [readme, docsQuickstart]) {
      expect(text).not.toContain('raw.githubusercontent.com/adam-s-k-i/super-backlog/main/');
      expect(text).toContain('raw.githubusercontent.com/adam-s-k-i/super-backlog/master/');
    }
  });

  it('opens the dashboard links outside the SPA router (public static file)', () => {
    // dashboard.html lives in docs/public, not in the VitePress route map -
    // without target=_blank the SPA router swallows the click and shows its 404.
    const vitepressConfig = readFileSync(join(root, 'docs', '.vitepress', 'config.mts'), 'utf8');
    const navLine = vitepressConfig.split('\n').find((l) => l.includes("'Dashboard'"));
    expect(navLine).toBeDefined();
    expect(navLine).toContain("target: '_blank'");

    const landing = readFileSync(join(root, 'docs', 'index.md'), 'utf8');
    // the redesigned landing is self-contained: it must not deep-link the
    // static dashboard.html file (that link lives in the nav config instead)
    expect(landing.includes('dashboard.html')).toBe(false);
  });

  it('cheat sheet keeps the core sbl commands', () => {
    for (const cmd of ['sbl init', 'sbl dashboard', 'sbl phase TASK-1 plan', 'sbl doctor', 'sbl update', 'sbl uninstall']) {
      expect(readme).toContain(cmd);
    }
  });

  it('drives the dashboard through the sbl dashboard command', () => {
    expect(readme).toContain('```bash\nsbl dashboard\n```');
  });

  it('keeps the uninstall guarantee essence', () => {
    expect(readme).toContain('provably owned artifacts');
    expect(readme).toContain('--with-backlog');
  });

  it('shows the dashboard screenshot as an active link to a committed asset', () => {
    expect(readme).toContain('![Project Dashboard](docs/assets/dashboard.png)');
    expect(existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'assets', 'dashboard.png'))).toBe(true);
  });

  it('states requirements and the default serve port', () => {
    expect(readme).toContain('Node >= 20');
    expect(readme).toContain('6428');
  });
});

describe('troubleshooting doc guard', () => {
  it('documents the Windows OpenCode fallback command verbatim', () => {
    expect(troubleshooting).toContain(
      'npm install superpowers@git+https://github.com/obra/superpowers.git --prefix "$HOME\\.config\\opencode"',
    );
    expect(troubleshooting).toContain('"plugin": ["~/.config/opencode/node_modules/superpowers"]');
  });

  it('documents the exit code legend and env seams', () => {
    expect(troubleshooting).toContain('| `0` | ok |');
    expect(troubleshooting).toContain('SBL_SKIP_INSTALL=1');
    expect(troubleshooting).toContain('SBL_FORCE_OFFLINE=1');
  });
});
