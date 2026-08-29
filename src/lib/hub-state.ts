import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { atomicWrite } from './atomic.js';

export interface HubState {
  pid: number;
  port: number;
  token: string;
}

export function hubStatePath(home: string): string {
  return join(home, '.super-backlog', 'hub.json');
}

export function readHubState(home: string): HubState | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(hubStatePath(home), 'utf8'));
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      typeof (parsed as HubState).pid !== 'number' ||
      typeof (parsed as HubState).port !== 'number' ||
      typeof (parsed as HubState).token !== 'string'
    ) {
      return null;
    }
    const { pid, port, token } = parsed as HubState;
    return { pid, port, token };
  } catch {
    return null;
  }
}

export function writeHubState(home: string, state: HubState): void {
  mkdirSync(join(home, '.super-backlog'), { recursive: true });
  const path = hubStatePath(home);
  atomicWrite(path, JSON.stringify(state));
  // hub.json carries the hub's auth token; keep it off other local accounts.
  // win32 has no POSIX mode bits (ACLs govern access there instead).
  if (process.platform !== 'win32') {
    chmodSync(path, 0o600);
  }
}

export function clearHubState(home: string, pid: number): void {
  const current = readHubState(home);
  if (current === null || current.pid !== pid) return;
  rmSync(hubStatePath(home), { force: true });
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function newHubToken(): string {
  return randomBytes(16).toString('hex');
}
