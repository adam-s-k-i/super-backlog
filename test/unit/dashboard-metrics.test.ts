// test/unit/dashboard-metrics.test.ts
import { describe, expect, it } from 'vitest';

import { computeKpis } from '../../src/dashboard/metrics.js';
import { computeActivity } from '../../src/dashboard/data.js';
import type { DashboardTask } from '../../src/dashboard/data.js';

const TODAY = '2026-08-30';
function task(partial: Partial<DashboardTask> & { id: string; status: string }): DashboardTask {
  return { title: partial.id, acs: [], ...partial } as DashboardTask;
}

describe('computeKpis', () => {
  it('computes progress, velocity and forecast', () => {
    const tasks = [
      task({ id: 't-1', status: 'Done', updated: '2026-08-28' }),
      task({ id: 't-2', status: 'Done', updated: '2026-08-20' }),
      task({ id: 't-3', status: 'To Do', created: '2026-08-01' }),
      task({ id: 't-4', status: 'In Progress', created: '2026-08-25' }),
    ];
    const k = computeKpis(tasks, [], computeActivity([], TODAY), TODAY);
    expect(k.total).toBe(4);
    expect(k.done).toBe(2);
    expect(k.open).toBe(2);
    expect(k.progressPct).toBe(50);
    expect(k.velocity7).toBe(1);       // t-1 within Aug 24-30
    expect(k.velocityPrev7).toBe(1);   // t-2 within Aug 17-23
    // 2 open at 1 done/7d -> 14 days
    expect(k.forecastDate).toBe('2026-09-13');
  });

  it('hides the forecast without velocity and counts wip/blocked', () => {
    const tasks = [
      task({ id: 't-1', status: 'In Progress' }),
      task({ id: 't-2', status: 'Blocked' }),
      task({ id: 't-3', status: 'To Do' }),
      task({ id: 't-4', status: 'Done', updated: '2026-01-01' }),
      task({ id: 't-5', status: 'Code Review' }), // "review" containment, not exact match
    ];
    const deps = [{ from: 't-3', to: 't-1' }];
    const k = computeKpis(tasks, deps, computeActivity([], TODAY), TODAY);
    expect(k.forecastDate).toBeNull();
    expect(k.wip).toBe(2); // t-1 (In Progress) + t-5 (Code Review)
    expect(k.blocked).toBe(2); // t-2 by status, t-3 by unresolved dep on t-1
  });

  it('computes ages of open tasks from created with updated fallback', () => {
    const tasks = [
      task({ id: 'old', status: 'To Do', created: '2026-08-10' }),   // 20 days
      task({ id: 'mid', status: 'To Do', updated: '2026-08-24' }),   // 6 days (fallback)
      task({ id: 'done', status: 'Done', created: '2026-01-01' }),   // ignored
      task({ id: 'undated', status: 'To Do' }),                       // ignored
    ];
    const k = computeKpis(tasks, [], computeActivity([], TODAY), TODAY);
    expect(k.oldestOpenId).toBe('old');
    expect(k.oldestOpenDays).toBe(20);
    expect(k.medianOpenAgeDays).toBe(13); // median of [6, 20]
  });

  it('computes activity aggregates and streak', () => {
    const activity = computeActivity(
      [
        { id: 'a', updated_at: '2026-08-30' },
        { id: 'b', updated_at: '2026-08-29' },
        { id: 'c', updated_at: '2026-08-29' },
        { id: 'd', updated_at: '2026-08-27' },
      ],
      TODAY,
    );
    const k = computeKpis([], [], activity, TODAY);
    expect(k.activityTotal30).toBe(4);
    expect(k.streakDays).toBe(2);        // Aug 30 + Aug 29; gap on Aug 28
    expect(k.busiestWeekday).toBe(6);    // 2026-08-29 is a Saturday
    expect(k.activityAvgPerWeek).toBe(0.2); // 4 touches / 26 weeks, rounded to one decimal
  });
});
