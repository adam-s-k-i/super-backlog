import { describe, expect, it } from 'vitest';

import {
  runPreflight,
  type PreflightDeps,
} from '../../src/lib/preflight.js';
import type { ExecutorResult } from '../../src/lib/powershell.js';

interface Call {
  cmd: string;
  args: string[];
}

interface DepsProbe extends PreflightDeps {
  lines: string[];
  calls: Call[];
  env: Record<string, string>;
}

interface ProbeOptions extends Partial<PreflightDeps> {
  responses?: Record<string, ExecutorResult>;
  nodeVersions?: Array<string | null>;
  policies?: Array<string | null>;
  backlogResults?: Array<string | null>;
  existingPaths?: string[];
}

function key(cmd: string, args: string[]): string {
  return `${cmd} ${args.join(' ')}`.trim();
}

function makeDeps(options: ProbeOptions = {}): DepsProbe {
  const lines: string[] = [];
  const calls: Call[] = [];
  const env: Record<string, string> = { PATH: 'C:\\Windows' };
  const responses = options.responses ?? {};
  const nodeVersions = [...(options.nodeVersions ?? ['22.14.0'])];
  const policies = [...(options.policies ?? ['RemoteSigned'])];
  const backlogResults = [...(options.backlogResults ?? ['C:\\proj\\node_modules\\.bin\\backlog.cmd'])];
  const existing = new Set(options.existingPaths ?? []);

  const executor = (cmd: string, args: string[]): ExecutorResult => {
    calls.push({ cmd, args });
    const k = key(cmd, args);
    if (k in responses) return responses[k];
    return { status: 0, stdout: '', stderr: '' };
  };

  return {
    lines,
    calls,
    env,
    platform: 'win32',
    getNodeVersion: () =>
      nodeVersions.length > 1 ? (nodeVersions.shift() ?? null) : nodeVersions[0],
    getPolicy: () => (policies.length > 1 ? (policies.shift() ?? null) : policies[0]),
    lookupCommand: (name: string) => {
      const k = `lookup:${name}`;
      if (k in responses) {
        const r = responses[k];
        return r.status === 0 ? r.stdout : null;
      }
      return name === 'sbl' ? 'C:\\npm\\sbl.cmd' : `C:\\npm\\${name}.cmd`;
    },
    setEnv: (name: string, value: string) => {
      env[name] = value;
    },
    getEnv: (name: string) => env[name] ?? null,
    resolveBacklog: () =>
      backlogResults.length > 1 ? (backlogResults.shift() ?? null) : backlogResults[0],
    exists: (p: string) => existing.has(p),
    executor,
    log: (line: string) => lines.push(line),
    ...options,
  };
}

describe('runPreflight', () => {
  it('reports all units ok or skipped on a healthy win32 environment', () => {
    const deps = makeDeps();
    const result = runPreflight('C:\\proj', deps);
    expect(result.ok).toBe(true);
    expect(result.reports.every((r) => r.status === 'ok' || r.status === 'skipped')).toBe(true);
    const mutating = deps.calls.filter((c) =>
      /install|Set-ExecutionPolicy|winget|brew/.test(key(c.cmd, c.args)),
    );
    expect(mutating.length).toBe(0);
  });

  it('installs node via winget when too old and consent is given', () => {
    const deps = makeDeps({
      nodeVersions: ['18.19.1', '22.0.0'],
      confirm: () => true,
    });
    const result = runPreflight('C:\\proj', deps);
    const winget = deps.calls.find((c) => c.cmd === 'winget');
    expect(winget).toBeDefined();
    const report = result.reports.find((r) => r.id === 'node-version');
    expect(report?.status).toBe('fixed');
    expect(result.ok).toBe(true);
  });

  it('installs node via brew on darwin when consent is given', () => {
    const deps = makeDeps({
      platform: 'darwin',
      nodeVersions: ['18.19.1', '22.0.0'],
      policies: [null],
      confirm: () => true,
    });
    const result = runPreflight('/proj', deps);
    expect(deps.calls.some((c) => c.cmd === 'brew')).toBe(true);
    expect(result.reports.find((r) => r.id === 'node-version')?.status).toBe('fixed');
  });

  it('requires consent for a node install and reports the manual command without it', () => {
    const deps = makeDeps({ nodeVersions: ['18.19.1'], confirm: () => false });
    const result = runPreflight('C:\\proj', deps);
    expect(deps.calls.some((c) => c.cmd === 'winget')).toBe(false);
    const report = result.reports.find((r) => r.id === 'node-version');
    expect(report?.status).toBe('needs-manual');
    expect(report?.manualCommand).toContain('winget');
    expect(result.ok).toBe(false);
  });

  it('skips consent prompts for system-changing fixes when fixAll is set', () => {
    let asked = 0;
    const deps = makeDeps({
      nodeVersions: ['18.19.1', '22.0.0'],
      policies: ['Restricted', 'RemoteSigned'],
      fixAll: true,
      confirm: () => {
        asked += 1;
        return false;
      },
    });
    const result = runPreflight('C:\\proj', deps);
    expect(asked).toBe(0);
    expect(deps.calls.some((c) => c.cmd === 'winget')).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('reports failed with a manual command when the node fix does not verify', () => {
    const deps = makeDeps({
      nodeVersions: ['18.19.1', '18.19.1'],
      confirm: () => true,
    });
    const result = runPreflight('C:\\proj', deps);
    const report = result.reports.find((r) => r.id === 'node-version');
    expect(report?.status).toBe('failed');
    expect(report?.manualCommand).toContain('nodejs.org');
    expect(result.ok).toBe(false);
  });

  it('fixes a blocking execution policy after consent', () => {
    const deps = makeDeps({
      policies: ['Restricted', 'RemoteSigned'],
      confirm: () => true,
    });
    const result = runPreflight('C:\\proj', deps);
    const ps = deps.calls.find(
      (c) => c.cmd === 'powershell.exe' && c.args.join(' ').includes('Set-ExecutionPolicy'),
    );
    expect(ps).toBeDefined();
    expect(ps?.args.join(' ')).toContain('RemoteSigned');
    expect(result.reports.find((r) => r.id === 'execution-policy')?.status).toBe('fixed');
  });

  it('does not touch the execution policy without consent', () => {
    const deps = makeDeps({ policies: ['Restricted'], confirm: () => false });
    const result = runPreflight('C:\\proj', deps);
    expect(
      deps.calls.some((c) => c.args.join(' ').includes('Set-ExecutionPolicy')),
    ).toBe(false);
    const report = result.reports.find((r) => r.id === 'execution-policy');
    expect(report?.status).toBe('needs-manual');
    expect(report?.manualCommand).toContain('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  });

  it('skips the execution policy unit off win32', () => {
    const deps = makeDeps({ platform: 'linux', policies: [null] });
    const result = runPreflight('/proj', deps);
    expect(result.reports.find((r) => r.id === 'execution-policy')?.status).toBe('skipped');
  });

  it('falls back to npm.cmd on win32 when npm is not directly callable', () => {
    const deps = makeDeps({
      responses: {
        'npm --version': { status: null, stdout: '', stderr: 'not found' },
      },
    });
    const result = runPreflight('C:\\proj', deps);
    const report = result.reports.find((r) => r.id === 'npm-command');
    expect(report?.status).toBe('fixed');
    expect(deps.calls.some((c) => c.cmd === 'npm.cmd')).toBe(true);
  });

  it('still updates PATH but reports failed when sbl stays unresolvable', () => {
    const deps = makeDeps({
      lookupCommand: () => null,
      responses: {
        'npm bin -g': { status: 0, stdout: 'C:\\npm-global\n', stderr: '' },
      },
    });
    const result = runPreflight('C:\\proj', deps);
    expect(result.reports.find((r) => r.id === 'sbl-on-path')?.status).toBe('failed');
    expect(deps.env.PATH).toContain('C:\\npm-global');
  });

  it('reports sbl-on-path fixed when the PATH refresh makes sbl resolvable', () => {
    let pathUpdated = false;
    const deps = makeDeps({
      lookupCommand: (name: string) => {
        if (name !== 'sbl') return `C:\\npm\\${name}.cmd`;
        return pathUpdated ? 'C:\\npm-global\\sbl.cmd' : null;
      },
      setEnv: (name: string, value: string) => {
        if (name === 'PATH') pathUpdated = true;
        deps.env[name] = value;
      },
      responses: {
        'npm bin -g': { status: 0, stdout: 'C:\\npm-global\n', stderr: '' },
      },
    });
    const result = runPreflight('C:\\proj', deps);
    expect(result.reports.find((r) => r.id === 'sbl-on-path')?.status).toBe('fixed');
  });

  it('reports a manual PATH command when npm bin -g cannot be determined', () => {
    const deps = makeDeps({
      lookupCommand: () => null,
      responses: {
        'npm bin -g': { status: 1, stdout: '', stderr: 'boom' },
      },
    });
    const result = runPreflight('C:\\proj', deps);
    const report = result.reports.find((r) => r.id === 'sbl-on-path');
    expect(report?.status).toBe('failed');
    expect(report?.manualCommand).toContain('npm bin -g');
  });

  it('reinstalls dependencies when the backlog CLI is not resolvable', () => {
    const deps = makeDeps({
      backlogResults: [null, 'C:\\proj\\node_modules\\.bin\\backlog.cmd'],
      existingPaths: ['C:\\proj\\package.json'],
    });
    const result = runPreflight('C:\\proj', deps);
    expect(deps.calls.some((c) => c.args[0] === 'install' && c.cmd.startsWith('npm'))).toBe(true);
    expect(result.reports.find((r) => r.id === 'backlog-bin')?.status).toBe('fixed');
  });

  it('reports failed with a manual command when npm install does not restore backlog', () => {
    const deps = makeDeps({
      backlogResults: [null, null],
      existingPaths: ['C:\\proj\\package.json'],
    });
    const result = runPreflight('C:\\proj', deps);
    const report = result.reports.find((r) => r.id === 'backlog-bin');
    expect(report?.status).toBe('failed');
    expect(report?.manualCommand).toBe('npm install');
    expect(result.ok).toBe(false);
  });

  it('repairs a partial install where the package dir exists but the .bin shim is missing', () => {
    const missingShim = 'C:\\proj\\node_modules\\.bin\\sbl.cmd';
    const pkgDir = 'C:\\proj\\node_modules\\super-backlog';
    let shimRestored = false;
    const deps = makeDeps({
      existingPaths: [pkgDir, 'C:\\proj\\package.json'],
      exists: (p: string) => p === pkgDir || p === 'C:\\proj\\package.json' || (p === missingShim && shimRestored),
      executor: (cmd: string, args: string[]): ExecutorResult => {
        deps.calls.push({ cmd, args });
        if (args[0] === 'install') shimRestored = true;
        return { status: 0, stdout: '', stderr: '' };
      },
    });
    const result = runPreflight('C:\\proj', deps);
    const report = result.reports.find((r) => r.id === 'partial-install');
    expect(report?.status).toBe('fixed');
    expect(deps.calls.some((c) => c.args[0] === 'install')).toBe(true);
  });

  it('reports partial-install ok when package and shim are consistent', () => {
    const deps = makeDeps({
      existingPaths: [
        'C:\\proj\\package.json',
        'C:\\proj\\node_modules\\super-backlog',
        'C:\\proj\\node_modules\\.bin\\sbl.cmd',
      ],
    });
    const result = runPreflight('C:\\proj', deps);
    expect(result.reports.find((r) => r.id === 'partial-install')?.status).toBe('ok');
  });

  it('runs only the units named in the units filter', () => {
    const deps = makeDeps({
      units: ['node-version'],
      nodeVersions: ['18.19.1'],
      confirm: () => false,
    });
    const result = runPreflight('C:\\proj', deps);
    expect(result.reports.length).toBe(1);
    expect(result.reports[0].id).toBe('node-version');
    expect(result.ok).toBe(false);
  });

  it('skips install-type fixes when there is no package.json', () => {
    const deps = makeDeps({
      units: ['backlog-bin', 'partial-install'],
      backlogResults: [null],
      existingPaths: ['C:\\proj\\node_modules\\super-backlog'],
    });
    const result = runPreflight('C:\\proj', deps);
    expect(result.reports.every((r) => r.status === 'skipped')).toBe(true);
    expect(deps.calls.some((c) => c.args[0] === 'install')).toBe(false);
    expect(result.ok).toBe(true);
  });
});
