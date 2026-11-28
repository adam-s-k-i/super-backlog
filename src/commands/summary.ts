// src/commands/summary.ts
// Deprecation stub: the curated architecture file was replaced by Floorplan. Always exits 0
// so scripts that still call `sbl summary --check` keep working.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FLOORPLAN_REPO_URL, floorplanStatusLine, readFloorplanStatus, type FloorplanStatus } from '../lib/floorplan.js';

export const SUMMARY_DEPRECATION =
  'sbl summary no longer checks backlog/docs/architecture.yml: the curated architecture file was replaced by ' +
  `Floorplan (${FLOORPLAN_REPO_URL}).`;

export interface SummaryCommandDeps {
  isProject?: (cwd: string) => boolean;
  readFloorplanStatus?: (cwd: string) => FloorplanStatus;
  log?: (line: string) => void;
}

export function runSummary(cwd: string, deps: SummaryCommandDeps = {}): number {
  const log = deps.log ?? ((line: string) => console.log(line));
  const isProject = deps.isProject ?? ((c: string) => existsSync(join(c, 'backlog', 'config.yml')));
  log(SUMMARY_DEPRECATION);
  if (isProject(cwd)) {
    const read = deps.readFloorplanStatus ?? ((c: string) => readFloorplanStatus(c));
    log(`map status: ${floorplanStatusLine(read(cwd))}`);
  }
  return 0;
}
