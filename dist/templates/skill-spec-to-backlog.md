---
name: spec-to-backlog
description: Convert an approved design/implementation plan (from brainstorming/writing-plans) into reviewed Backlog.md tasks with acceptance criteria, milestones and dependencies. Use after a design is approved, when the user asks to decompose work into tasks, or before starting planned work in this project.
---

# Spec → Backlog: turn plan units into tracked tasks

Bridge between Superpowers (brainstorming, writing-plans) and Backlog.md.

## When this skill runs

1. After an approved design doc (end of brainstorming), BEFORE implementing.
2. After writing-plans, to materialize plan units as tasks.
3. When the user asks to split work into tasks.

## Procedure

1. Read `backlog instructions overview` and `backlog instructions task-creation` first.
2. Decompose: every plan unit becomes ONE task, small enough for one session/PR.
3. Create per task:
   backlog task create "Title" -d "<goal/context>" --ac "<criterion 1>" --ac "<criterion 2>" --type feature --label feature --ref "<path/to/plan-doc>"
   - Dependencies: --dep TASK-y (order follows the plan).
   - Larger efforts: backlog milestone add "<Name>", attach via -m.
   - Reference the plan doc via --ref; NEVER copy it into the task.
4. Never set --plan or --notes at create time — those belong to the "task started" checkpoint after codebase research.
5. STOP at the review gate: the human reviews specs and acceptance criteria (backlog board / backlog browser / dashboard.html) before any code exists.

## Boundaries

- Never hand-edit task markdown; use the backlog CLI exclusively.
- No code, no worktrees, no status changes inside this skill.
- Project-specific human-gate topics get their own tasks with an explicit review gate.
