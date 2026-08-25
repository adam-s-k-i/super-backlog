// src/dashboard/data.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveBacklogBin, runCapture } from '../lib/run.js';
import { readSimpleKeys } from '../lib/yamlmini.js';
function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function asString(v) {
    if (typeof v === 'string' && v.trim().length > 0)
        return v.trim();
    if (typeof v === 'number' && Number.isFinite(v))
        return String(v);
    return undefined;
}
/**
 * Parse the stdout of `backlog task list --json` defensively.
 * Accepts `{tasks:[...]}` and bare-array shapes; anything else throws
 * so the caller can degrade to fallback-empty.
 */
export function parseTasksJson(raw) {
    const trimmed = raw.trim();
    if (trimmed.length === 0)
        throw new Error('empty task list output');
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed))
        return parsed.filter(isRecord);
    if (isRecord(parsed) && Array.isArray(parsed['tasks'])) {
        return parsed['tasks'].filter(isRecord);
    }
    throw new Error('unrecognized task list shape');
}
function normalizeAcs(value) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    for (const item of value) {
        if (typeof item === 'string') {
            if (item.trim().length > 0)
                out.push({ text: item.trim(), checked: false });
            continue;
        }
        if (isRecord(item)) {
            const text = asString(item['text']) ?? asString(item['title']) ?? asString(item['description']);
            if (text === undefined)
                continue;
            const checked = item['checked'] === true || item['done'] === true;
            out.push({ text, checked });
        }
    }
    return out;
}
export function normalizeTasks(rawTasks) {
    return rawTasks.map((t) => ({
        id: asString(t['id']) ?? '',
        title: asString(t['title']) ?? '(untitled)',
        status: asString(t['status']) ?? 'Unknown',
        priority: asString(t['priority']),
        assignee: asString(t['assignee']),
        updated: asString(t['updated_at']) ?? asString(t['updated']),
        milestone: asString(t['milestone']),
        description: asString(t['description']),
        acs: normalizeAcs(t['acceptance_criteria']),
    }));
}
export function computeStatuses(tasks) {
    const counts = new Map();
    for (const t of tasks)
        counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    return [...counts.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => a.status.localeCompare(b.status));
}
export function computeMilestones(tasks) {
    const acc = new Map();
    for (const t of tasks) {
        if (!t.milestone)
            continue;
        const m = acc.get(t.milestone) ?? { done: 0, total: 0 };
        m.total++;
        if (t.status.toLowerCase() === 'done')
            m.done++;
        acc.set(t.milestone, m);
    }
    return [...acc.entries()]
        .map(([name, m]) => ({ name, done: m.done, total: m.total }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
function readProjectIdentity(cwd) {
    const cfg = readSimpleKeys(join(cwd, 'backlog', 'config.yml'), [
        'project_name',
        'name',
        'description',
    ]);
    let pkg;
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
        try {
            pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        }
        catch {
            pkg = undefined;
        }
    }
    const name = asString(cfg['project_name']) ??
        asString(cfg['name']) ??
        asString(pkg?.['name']) ??
        'Untitled project';
    const description = asString(cfg['description']) ?? asString(pkg?.['description']) ?? '';
    return { name, description };
}
export function collectDashboardData(cwd, opts) {
    const base = {
        project: readProjectIdentity(cwd),
        generatedAt: new Date().toISOString(),
        kitVersion: opts.kitVersion,
        statuses: [],
        milestones: [],
        tasks: [],
        source: 'fallback-empty',
    };
    try {
        const bin = resolveBacklogBin(cwd);
        if (!bin)
            return base;
        const res = runCapture(bin, ['task', 'list', '--json'], cwd);
        if (res.status !== 0)
            return base;
        const tasks = normalizeTasks(parseTasksJson(res.stdout));
        return {
            ...base,
            tasks,
            statuses: computeStatuses(tasks),
            milestones: computeMilestones(tasks),
            source: 'backlog-json',
        };
    }
    catch {
        // Any parse/exec failure degrades to an empty dashboard; never crash.
        return base;
    }
}
