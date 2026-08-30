// src/lib/self-update.ts
import { join } from 'node:path';
import process from 'node:process';

import { isNewerVersion } from './version-check.js';

export type InstallKind = 'global' | 'local' | 'unknown';

/**
 * Normalizes separators for prefix comparison and, on win32, case as well:
 * `npm root -g` and `realpathSync` can disagree on drive-letter/path casing
 * (`C:\` vs `c:\`) even for the same install, and Windows paths are
 * case-insensitive anyway, so comparing case-sensitively there would
 * misclassify a real global install as `unknown`. Takes an optional
 * `caseInsensitive` override (default: `process.platform === 'win32'`) so
 * the function stays pure and testable for both platforms' behavior.
 */
function normalizeForCompare(p: string, caseInsensitive: boolean): string {
  const withForwardSlashes = p.replace(/\\/g, '/');
  return caseInsensitive ? withForwardSlashes.toLowerCase() : withForwardSlashes;
}

function isUnder(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

/**
 * Classifies the running binary's real path as a local (project
 * node_modules) install, a global npm install, or unknown (treated the
 * same as local: never mutated, hint only). Pure function -- callers
 * gather binRealPath (from `process.argv[1]` + `realpathSync`) and
 * globalRoot (from `npm root -g`, captured once, null on failure).
 */
export function detectInstallKind(
  binRealPath: string,
  cwd: string,
  globalRoot: string | null,
  caseInsensitive: boolean = process.platform === 'win32',
): InstallKind {
  const bin = normalizeForCompare(binRealPath, caseInsensitive);
  const localRoot = normalizeForCompare(join(cwd, 'node_modules'), caseInsensitive);
  if (isUnder(bin, localRoot)) return 'local';
  if (globalRoot !== null && isUnder(bin, normalizeForCompare(globalRoot, caseInsensitive))) return 'global';
  return 'unknown';
}

export interface SelfUpdateDeps {
  installed: string; // KIT_VERSION
  fetchLatest: () => Promise<string | null>;
  installKind: InstallKind;
  npmInstallGlobal: (spec: string) => { status: number | null }; // runCapture wrapper
  log: (line: string) => void;
  warn: (line: string) => void;
}

export type SelfUpdateResult =
  | { kind: 'updated'; latest: string }
  | { kind: 'current' }
  | { kind: 'skipped-local'; latest: string }
  | { kind: 'unavailable' } // offline / fetch failed
  | { kind: 'failed'; latest: string }; // npm install failed

export async function runSelfUpdate(deps: SelfUpdateDeps): Promise<SelfUpdateResult> {
  const latest = await deps.fetchLatest();
  if (latest === null) {
    deps.warn('could not check for a newer super-backlog (offline?)');
    return { kind: 'unavailable' };
  }

  if (!isNewerVersion(latest, deps.installed)) {
    return { kind: 'current' };
  }

  if (deps.installKind !== 'global') {
    deps.log(
      `a newer super-backlog (${latest}) is available; update the dependency yourself, e.g. npm i -D super-backlog@${latest}`,
    );
    return { kind: 'skipped-local', latest };
  }

  const result = deps.npmInstallGlobal(`super-backlog@${latest}`);
  if (result.status === 0) {
    deps.log(`self-updated to ${latest}, re-running update...`);
    return { kind: 'updated', latest };
  }

  deps.warn(
    `self-update to ${latest} failed (npm install exited ${String(result.status)}); continuing with ${deps.installed}`,
  );
  return { kind: 'failed', latest };
}
