import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const troubleshooting = readFileSync(join(root, 'docs', 'guide', 'troubleshooting.md'), 'utf8');

describe('README doc-rot guard', () => {
  it('contains the quickstart command', () => {
    expect(readme).toContain('irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/main/scripts/install.ps1 | iex');
  });

  it('lists all four merged npm scripts with their commands', () => {
    for (const name of ['tasks', 'board', 'browser', 'dashboard']) {
      expect(readme).toContain(name);
    }
    for (const cmd of ['backlog task list', 'backlog board', 'backlog browser', 'super-backlog dashboard']) {
      expect(readme).toContain(cmd);
    }
  });

  it('references dashboard.html', () => {
    expect(readme).toContain('dashboard.html');
  });

  it('contains the uninstall guarantee sentence verbatim', () => {
    expect(readme).toContain(
      'uninstall removes only provably owned artifacts and keeps your Backlog task data unless you pass --with-backlog',
    );
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
