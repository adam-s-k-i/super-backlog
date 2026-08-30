---
type: explanation
---

# Pipeline phases

Tasks carry their pipeline phase as a Backlog label — exactly one of
`phase/spec`, `phase/plan`, `phase/impl`, `phase/verify` per task. The label
answers "where does this task stand between review gate and archive?" without
reconstructing context from chat history.

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
table and detail modal show a phase chip per task.
