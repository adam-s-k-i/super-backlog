// src/lib/task-list.ts
// Reads `backlog task list --json` into plain rows; shared by sbl doctor and sbl summary.
import { resolveBacklogBin, runCapture, type RunResult } from './run.js';

export interface TaskListRow {
  id: string;
  status: string;
  labels: string[];
}

export interface TaskListDeps {
  resolveBacklog?: (cwd: string) => string | null;
  run?: (cmd: string, args: string[], cwd: string) => RunResult;
}

/** null when the backlog CLI is missing, fails, or prints something unparsable. */
export function readTaskList(cwd: string, deps: TaskListDeps = {}): TaskListRow[] | null {
  const bin = (deps.resolveBacklog ?? resolveBacklogBin)(cwd);
  if (!bin) return null;
  const res = (deps.run ?? runCapture)(bin, ['task', 'list', '--json'], cwd);
  if (res.status !== 0) return null;
  try {
    const parsed = JSON.parse(res.stdout) as { tasks?: unknown };
    if (!Array.isArray(parsed.tasks)) return null;
    const rows: TaskListRow[] = [];
    for (const t of parsed.tasks) {
      if (typeof t !== 'object' || t === null) continue;
      const id = (t as { id?: unknown }).id;
      const status = (t as { status?: unknown }).status;
      const labels = (t as { labels?: unknown }).labels;
      if (typeof id !== 'string' || typeof status !== 'string') continue;
      rows.push({
        id,
        status,
        labels: Array.isArray(labels) ? labels.filter((l): l is string => typeof l === 'string') : [],
      });
    }
    return rows;
  } catch {
    return null;
  }
}
