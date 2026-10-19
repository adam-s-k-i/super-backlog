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
6. Delegate by tier — when you delegate, the subtask goes to the cheapest model that solves it reliably (see "Model tiers and delegation" below).
7. Keep the project summary current — if `backlog/docs/architecture.yml` is missing or `sbl summary --check` reports drift after a merge, say so in the final report; run the architecture-summary skill only when the user asks for it.
8. Human checkpoints are the three gates (3, 5, 6) and nothing else — outside them, do not ask for confirmation, make offers or present menus; decide, act and report at the end. Stop only when you are blocked or verification fails. This overrides any skill that asks for an integration or execution choice.

### Model tiers and delegation

Goal: the best result at the lowest token cost.
Default is to do the work yourself in the session.
Delegate only when it pays off: the subtask is self-contained, can be
briefed completely in a few sentences, and is large enough (many files or
sources, much intermediate output). When you delegate, the subtask goes to
the cheapest model that solves it reliably, regardless of the session model.

Tiers (see the examples below for current model names; otherwise use the
closest available equivalents):

- **Light** — purely mechanical: searching, listing, extracting, reformatting.
- **Standard** — clearly specified routine work: research, summaries,
  routine code, tests, documentation.
- **Strong** — demanding work with clear boundaries: complex implementation,
  debugging, reviews.
- **Top** — analysis, design, architecture, interpreting ambiguous results,
  every decision where a mistake is costly or hard to reverse.

When unsure between two tiers, take the higher one. In this pipeline:
brainstorming, specs, plans and the final whole-branch review are Top;
per-task reviews and debugging are Strong; fully specified plan steps,
tests and docs are Standard; lookups and Backlog.md CLI bookkeeping are Light.

When delegating:

- Brief with goal, required context, limits, done criterion and return
  format. Set the model explicitly on every dispatch; never rely on
  inheriting the session model.
- Returns stay brief: result plus evidence (paths, sources, numbers), no raw
  data or logs.
- Start independent tasks in parallel; never redo delegated work yourself.

Quality: responsibility for the result stays with you. Check returns before
using them, the more carefully the costlier a mistake would be. If a result
falls short, do not retry on the same tier — go one tier up or take over
yourself.

If the harness has no subagents or no per-dispatch model choice, work
directly and without mentioning it.

{{MODEL_EXAMPLES}}

Project-specific human gates are intentionally out of scope for this block.
Add project-specific human gates below the block.
