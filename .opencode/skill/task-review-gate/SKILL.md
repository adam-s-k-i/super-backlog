---
name: task-review-gate
description: Enforce the human review checkpoint before implementation starts. Use at session start on an existing task, right after spec-to-backlog created tasks, or when the user asks to implement a specific task: present the task, its pipeline phase and acceptance criteria, and wait for explicit approval before any code.
---

<!-- managed-by: super-backlog 1.3.1 -->
# Task Review Gate: session entry, review gate, resume

Human checkpoint between reviewed specs and the first line of code — and the
re-entry point for every session that continues a running task.

## When this skill runs

1. At the start of a session that works on an existing task (resume).
2. Right after spec-to-backlog created tasks (review specs + acceptance criteria).
3. When the user asks to implement a specific task (restate scope before starting).

## Procedure

1. Load the task: `backlog task view <ID> --plain`.
2. Load the phase: `sbl phase <ID>` (prints `phase/spec|plan|impl|verify` or `none`).
3. Present compactly: goal, every acceptance criterion, dependencies, the
   recorded plan if one exists, and the current phase.
4. STOP and wait for the user's explicit approval. Silence or a topic change
   is NOT approval.
5. After approval, resume per phase:
   - `phase/spec` — review gate passed: advance with `sbl phase <ID> plan`,
     then start the plan-before-code pass.
   - `phase/plan` — plan recorded: advance with `sbl phase <ID> impl` once the
     human approves the plan, then TDD.
   - `phase/impl` — refresh context from the recorded plan and implementation
     notes, then continue TDD where it stopped.
   - `phase/verify` — collect verification evidence (tests/lint/typecheck),
     write the final summary, then `sbl phase <ID> done` at archival.
   - `none` — a task without a phase label is either legacy (offer
     `sbl phase <ID> spec`) or not yet started (walk the review gate first).
6. Set the task In Progress via the backlog CLI when work starts.

## Boundaries

- Never approve the gate yourself; vague consent is not approval.
- Phase changes only via `sbl phase` — never edit labels by hand.
- Trivial edits stay exempt only on explicit user instruction.
- If acceptance criteria look wrong or incomplete, send the user back to task
  editing instead of starting.
