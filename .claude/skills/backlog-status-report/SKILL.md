---
name: backlog-status-report
description: Summarize current project state from Backlog.md (task counts, in-progress work, milestones) and point to the Project Dashboard. Use when the user asks for status, progress, or a project overview.
---

<!-- managed-by: super-backlog 1.3.1 -->
# Backlog Status Report: project state at a glance

Read-only summary of the Backlog.md data in this project.

## When this skill runs

- The user asks for status, progress, or an overview ("where are we?").
- Before or after a work session, to orient.

## Procedure

1. Read `backlog instructions overview` if not already loaded this session.
2. Collect data: `backlog task list --json` plus milestones via the backlog CLI.
3. Report compactly in chat:
   - Counts per status (To Do / In Progress / Done)
   - Every In Progress task: ID, title, open acceptance criteria
   - Milestones with done/total
   - Blocked or stale items worth flagging
4. Point to the visual surfaces: `sbl dashboard` (live dashboard) or
   `backlog browser` (interactive Kanban).

## Boundaries

- Strictly read-only: never change task status, never edit tasks.
- Never guess state from memory — always read fresh CLI output.
- Keep the report short; link details instead of pasting them.
