---
type: explanation
---

# Pipeline phases

Every task carries its pipeline phase as a Backlog label — exactly one of
`phase/spec`, `phase/plan`, `phase/impl`, `phase/verify` per task. The label
records where a task stands between review gate and archive.

## Why this matters to you

Before phases, the pipeline lived only in agent instructions. Every new session
started with reconstructing where work stood, gate approvals left no durable
trace, and the dashboard could show task status but not pipeline position.

With phases you get:

- **Faster session starts** — the agent reads the task and its phase and resumes
  exactly where work stopped. No re-explaining, no guessing.
- **One-command answers** — `sbl phase TASK-1` tells you where any task stands.
- **Visible progress** — the dashboard stepper, task table, and task modal show
  the live phase; the task modal offers a copyable advance command.
- **Guarded transitions** — `sbl phase` validates every change (no typos, no
  impossible jumps, no duplicate labels), and `sbl doctor` reports missing or
  unknown phase labels with fix hints.
- **Zero bookkeeping** — tasks created through the spec-to-backlog flow start
  at `phase/spec` automatically. You never maintain labels by hand.

## Lifecycle

| Label | Meaning | Advance when |
|---|---|---|
| `phase/spec` | Created from an approved design; review gate open | Human approved specs + acceptance criteria |
| `phase/plan` | Plan being written or awaiting approval | Human approved the written plan |
| `phase/impl` | TDD implementation running | Implementation complete |
| `phase/verify` | Verification & final summary | Tests/lint green, summary recorded |
| *(removed)* | Done / archived | Merge + archive complete |

## Commands

- `sbl phase TASK-1` — show the current phase
- `sbl phase TASK-1 plan` — advance (or `done` to remove the label)
- `sbl doctor` — reports missing, duplicate, or unknown phase labels

Phase transitions happen at gate passages, driven by the agent or copied from
the dashboard's task-modal chip. Never edit phase labels by hand.

## Dashboard

The Feature Cycle stepper shows live task counts on phases 5–8; the tasks
table and detail modal show a phase chip per task. The detail modal also
offers a copyable `sbl phase` advance command, and live-reload reflects every
transition immediately.
