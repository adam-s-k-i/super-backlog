// src/dashboard/metrics.ts
// All numbers are declared approximations: Backlog.md keeps no status
// history, so everything derives from created/updated timestamps.
import type { DashboardActivityBucket, DashboardDep, DashboardTask } from './data.js';

export interface DashboardKpis {
  total: number;
  done: number;
  open: number;
  progressPct: number;
  velocity7: number;
  velocityPrev7: number;
  forecastDate: string | null;
  wip: number;
  blocked: number;
  oldestOpenId: string | null;
  oldestOpenDays: number | null;
  medianOpenAgeDays: number | null;
  activityTotal30: number;
  activityAvgPerWeek: number;
  busiestWeekday: number | null;
  streakDays: number;
}

function isDone(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'done' || s === 'complete' || s === 'completed';
}

function isWip(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('progress') || s === 'review';
}

function utcDay(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const DAY_MS = 86_400_000;

export function computeKpis(
  tasks: readonly DashboardTask[],
  deps: readonly DashboardDep[],
  activity: readonly DashboardActivityBucket[],
  today: string,
): DashboardKpis {
  const todayMs = utcDay(today) ?? Date.UTC(1970, 0, 1);
  const total = tasks.length;
  const doneTasks = tasks.filter((t) => isDone(t.status));
  const done = doneTasks.length;
  const open = total - done;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const doneInWindow = (fromDaysAgo: number, toDaysAgo: number): number =>
    doneTasks.filter((t) => {
      const d = utcDay(t.updated);
      if (d === null) return false;
      const age = (todayMs - d) / DAY_MS;
      return age >= toDaysAgo && age < fromDaysAgo;
    }).length;
  const velocity7 = doneInWindow(7, 0);
  const velocityPrev7 = doneInWindow(14, 7);

  let forecastDate: string | null = null;
  if (velocity7 > 0 && open > 0) {
    const daysNeeded = Math.ceil((open / velocity7) * 7);
    forecastDate = new Date(todayMs + daysNeeded * DAY_MS).toISOString().slice(0, 10);
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const unresolved = new Set<string>();
  for (const dep of deps) {
    const from = byId.get(dep.from);
    const to = byId.get(dep.to);
    if (from && !isDone(from.status) && to && !isDone(to.status)) unresolved.add(dep.from);
  }
  const openTasks = tasks.filter((t) => !isDone(t.status));
  const wip = openTasks.filter((t) => isWip(t.status)).length;
  const blocked = openTasks.filter(
    (t) => t.status.toLowerCase().includes('block') || unresolved.has(t.id),
  ).length;

  const ages: { id: string; days: number }[] = [];
  for (const t of openTasks) {
    const d = utcDay(t.created) ?? utcDay(t.updated);
    if (d === null) continue;
    ages.push({ id: t.id, days: Math.max(0, Math.round((todayMs - d) / DAY_MS)) });
  }
  ages.sort((a, b) => b.days - a.days);
  const oldest = ages[0] ?? null;
  let medianOpenAgeDays: number | null = null;
  if (ages.length > 0) {
    const mid = Math.floor(ages.length / 2);
    medianOpenAgeDays =
      ages.length % 2 === 1 ? ages[mid]!.days : Math.round((ages[mid - 1]!.days + ages[mid]!.days) / 2);
  }

  const activityTotal30 = activity.slice(-30).reduce((sum, b) => sum + b.count, 0);
  const windowTotal = activity.reduce((sum, b) => sum + b.count, 0);
  const activityAvgPerWeek =
    activity.length > 0 ? Math.round((windowTotal / (activity.length / 7)) * 10) / 10 : 0;

  const perWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const b of activity) {
    const d = utcDay(b.date);
    if (d !== null) perWeekday[new Date(d).getUTCDay()]! += b.count;
  }
  const maxWeekday = Math.max(...perWeekday);
  const busiestWeekday = maxWeekday > 0 ? perWeekday.indexOf(maxWeekday) : null;

  let streakDays = 0;
  let i = activity.length - 1;
  if (i >= 0 && activity[i]!.count === 0) i--; // today may still be empty
  while (i >= 0 && activity[i]!.count > 0) {
    streakDays++;
    i--;
  }

  return {
    total, done, open, progressPct,
    velocity7, velocityPrev7, forecastDate,
    wip, blocked,
    oldestOpenId: oldest ? oldest.id : null,
    oldestOpenDays: oldest ? oldest.days : null,
    medianOpenAgeDays,
    activityTotal30, activityAvgPerWeek, busiestWeekday, streakDays,
  };
}
