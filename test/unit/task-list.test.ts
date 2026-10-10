// test/unit/task-list.test.ts
import { describe, expect, it } from 'vitest';

import { readTaskList } from '../../src/lib/task-list.js';
import type { RunResult } from '../../src/lib/run.js';

const ok = (stdout: string): RunResult => ({ status: 0, stdout, stderr: '' });

describe('readTaskList', () => {
  it('returns null when the backlog CLI is not resolvable', () => {
    expect(readTaskList('/proj', { resolveBacklog: () => null, run: () => ok('{}') })).toBeNull();
  });

  it('runs "task list --json" with the resolved binary in cwd', () => {
    const calls: [string, string[], string][] = [];
    readTaskList('/proj', {
      resolveBacklog: () => 'backlog.cmd',
      run: (cmd, args, cwd) => {
        calls.push([cmd, args, cwd]);
        return ok('{"tasks":[]}');
      },
    });
    expect(calls).toEqual([['backlog.cmd', ['task', 'list', '--json'], '/proj']]);
  });

  it('returns null on a failing command or unparsable output', () => {
    const resolveBacklog = () => 'backlog';
    expect(readTaskList('/proj', { resolveBacklog, run: () => ({ status: 1, stdout: '', stderr: 'boom' }) })).toBeNull();
    expect(readTaskList('/proj', { resolveBacklog, run: () => ok('not json') })).toBeNull();
    expect(readTaskList('/proj', { resolveBacklog, run: () => ok('{"tasks":{}}') })).toBeNull();
  });

  it('keeps rows with string id and status and filters labels to strings', () => {
    const rows = readTaskList('/proj', {
      resolveBacklog: () => 'backlog',
      run: () =>
        ok(
          JSON.stringify({
            tasks: [
              { id: 'TASK-1', status: 'Done', labels: ['phase/impl', 7] },
              { id: 'TASK-2', status: 'To Do' },
              { id: 3, status: 'To Do' },
              null,
            ],
          }),
        ),
    });
    expect(rows).toEqual([
      { id: 'TASK-1', status: 'Done', labels: ['phase/impl'] },
      { id: 'TASK-2', status: 'To Do', labels: [] },
    ]);
  });
});
