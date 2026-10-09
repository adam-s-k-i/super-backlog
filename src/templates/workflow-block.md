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
6. Delegate by tier — less demanding work goes to subagents on cheaper models (see "Model routing for subagents" below).

### Model routing for subagents

Applies always, regardless of which model the current session runs on.

1. Delegate less demanding work to a subagent on a cheaper model instead of doing it on the top tier. Set the model explicitly on every dispatch; never rely on inheriting the session model.
2. Pick the tier by complexity:
   - **Light**: routine, mechanical work (searches and file reading, running tests, lint/format/typo fixes, doc and changelog edits, Backlog.md CLI bookkeeping, fully specified plan steps).
   - **Standard**: moderately complex work (plan tasks that need judgement, per-task reviews, debugging with a clear reproduction, non-trivial refactors).
   - **Top**: only where its depth is needed (brainstorming and design, specs and plans, final whole-branch reviews, problems a cheaper tier could not solve).
3. When unsure, start one tier lower and escalate if the result falls short.
4. If the harness has no subagents or no per-dispatch model choice, this rule does not apply.

Examples (current as of this super-backlog release):

- Claude Code: the Agent tool's `model` parameter: light `sonnet`, standard `opus`, top = the strongest available model (e.g. Fable).
- OpenCode: set a cheaper model on the subagent, e.g. the `model` field of an agent in `.opencode/agents/`.
- Other harnesses: the equivalent per-subagent model setting.

Project-specific human gates are intentionally out of scope for this block.
Add project-specific human gates below the block.
