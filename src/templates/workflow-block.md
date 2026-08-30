## Workflow system

This section is managed by super-backlog {{VERSION}}.

**Roles:** Backlog.md = WHAT — specs, acceptance criteria, status and history,
managed exclusively through the `backlog` CLI. Superpowers = HOW — the
methodology skills that decide how the work is done.

### Pipeline (follow in order)

| # | Phase | Phase label | Gate to pass |
|---|-------|-------------|--------------|
| 1 | Idea | — | User states a need; capture it before doing anything else |
| 2 | Brainstorming | — | Explore intent, requirements and design before any creative work |
| 3 | Design gate | — | Human approves the design document |
| 4 | Spec-to-backlog | `phase/spec` set at creation | Decompose the approved design into reviewed tasks with acceptance criteria |
| 5 | Review gate | `phase/spec` | Human reviews specs and acceptance criteria before any code exists |
| 6 | Plan-before-code | `phase/plan` | A written implementation plan is approved by the human |
| 7 | TDD implementation | `phase/impl` | Failing test first, then code; one task per session/PR |
| 8 | Verification & final summary | `phase/verify` | Run tests/lint/typecheck; verification evidence before success claims |
| 9 | Merge & archive | label removed (`done`) | Merge the branch, then close/archive the task via the backlog CLI |

### Binding rules

1. No task, no code — trivial edits only on explicit user instruction.
2. Plan before code — implementation starts only after an approved written plan.
3. Task status changes always go through the CLI backed by verification evidence, never from memory.
4. Skills take precedence over habit whenever a matching skill exists.
5. Phase transitions only via `sbl phase <id> <phase>`, always at a gate passage — never edit phase labels by hand.

Project-specific human gates are intentionally out of scope for this block.
Add project-specific human gates below the block.
