// src/commands/doctor.ts
import process from 'node:process';

import {
  getEffectiveExecutionPolicy,
  isBlockingExecutionPolicy,
  type Executor,
} from '../lib/powershell.js';
import { resolveBacklogBin } from '../lib/run.js';

export interface DoctorDeps {
  platform?: string;
  nodeVersion?: string;
  executor?: Executor;
  resolveBacklog?: (cwd: string) => string | null;
  log?: (line: string) => void;
}

type Status = 'ok' | 'warn' | 'skip';

const MARK: Record<Status, string> = { ok: '[ok]  ', warn: '[warn]', skip: '[skip]' };

export function runDoctor(cwd: string, deps: DoctorDeps = {}): number {
  const platform = deps.platform ?? process.platform;
  const nodeVersion = deps.nodeVersion ?? process.versions.node;
  const resolveBacklog = deps.resolveBacklog ?? resolveBacklogBin;
  const log = deps.log ?? ((line: string) => console.log(line));

  let okCount = 0;
  let warnCount = 0;
  let skipCount = 0;

  const emit = (status: Status, line: string, extra: string[] = []): void => {
    if (status === 'ok') okCount += 1;
    else if (status === 'warn') warnCount += 1;
    else skipCount += 1;
    log(`${MARK[status]} ${line}`);
    for (const extraLine of extra) log(`        ${extraLine}`);
  };

  // check 1: node >= 20
  const major = Number(nodeVersion.split('.')[0]);
  if (Number.isNaN(major)) {
    emit('warn', `node version unreadable ("${nodeVersion}") - super-backlog requires Node >= 20`);
  } else if (major >= 20) {
    emit('ok', `node v${nodeVersion} (>= 20)`);
  } else {
    emit('warn', `node v${nodeVersion} is too old - super-backlog requires Node >= 20`, [
      'fix: upgrade Node.js (https://nodejs.org)',
    ]);
  }

  // check 2: PowerShell execution policy (win32 only, fakeable via SBL_FAKE_POLICY)
  const policy = getEffectiveExecutionPolicy({ platform, executor: deps.executor });
  if (policy === null) {
    emit('skip', 'PowerShell execution policy check (not Windows or undetectable)');
  } else if (isBlockingExecutionPolicy(policy)) {
    emit(
      'warn',
      `PowerShell execution policy "${policy}" blocks .ps1 shims - direct npm/npx/sbl calls in PowerShell will fail`,
      [
        'fix: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned',
        'alt: call the .cmd shims explicitly (npx.cmd, sbl.cmd) or run from cmd.exe',
        'note: "npm run ..." scripts are unaffected (they execute via cmd.exe)',
      ],
    );
  } else {
    emit('ok', `PowerShell execution policy: ${policy}`);
  }

  // check 3: backlog binary resolvability
  const backlogBin = resolveBacklog(cwd);
  if (backlogBin !== null) {
    emit('ok', `backlog CLI resolvable at ${backlogBin}`);
  } else {
    emit('warn', 'backlog CLI not found - run sbl init or npm install first', [
      'fix: npx.cmd super-backlog init',
    ]);
  }

  log(`doctor summary: ${okCount} ok, ${warnCount} warn, ${skipCount} skip`);
  return warnCount > 0 ? 4 : 0;
}
