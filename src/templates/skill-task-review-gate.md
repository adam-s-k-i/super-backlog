---
name: task-review-gate
description: Enforce the human review checkpoint before implementation starts. Use after tasks were created from a plan, or when the user asks to implement a specific task, to present the task and its acceptance criteria and wait for explicit approval before any code.
---

# Task Review Gate: no code before an explicit yes

Human checkpoint between reviewed specs and the first line of code.

## When this skill runs

1. Right after spec-to-backlog created tasks (review specs + acceptance criteria).
2. When the user asks to implement a specific task (restate scope before starting).

## Procedure

1. Load the task: `backlog task view <ID> --plain`.
2. Present compactly: goal, every acceptance criterion, dependencies, and the
   recorded plan if one exists.
3. STOP and wait for the user's explicit approval. Silence or a topic change
   is NOT approval.
4. Only after approval: set the task In Progress via the backlog CLI and start
   with a plan-before-code pass if no plan is recorded yet.

## Boundaries

- Never approve the gate yourself; vague consent is not approval.
- Trivial edits stay exempt only on explicit user instruction.
- If acceptance criteria look wrong or incomplete, send the user back to task
  editing instead of starting.
