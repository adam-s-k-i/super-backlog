
<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.50.1 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:

- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
<!-- SUPER-BACKLOG:1.3.1 START -->
## Workflow system

This section is managed by super-backlog 1.3.1.

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

<!-- SUPER-BACKLOG END -->

## Git and delivery rules (project-specific, binding)

1. Never `git push` without the user's explicit instruction (e.g. "ship", "release") or an explicit
   question answered with yes. Local commits and local merges are always fine.
2. Never merge pull requests on the remote (GitHub) without the same explicit instruction or approval.
   When in doubt: merge locally and ask before touching the remote.
3. Exception by design: PRs from the screenshot bot branch (`docs/dashboard-screenshot`) auto-merge via
   the deploy workflow — that zero-touch flow is intended and needs no approval.
4. If a push is rejected because the remote moved, integrate locally and still ask before pushing.
5. Changing hosted surfaces (GitHub Pages, the GitHub README) does NOT imply push approval:
   commit locally, then present the pending commits and ask.
6. Releases need per-version approval: each release-please PR (e.g. release 1.3.x) is merged only
   after the user approves exactly that version. An approved version never covers later ones.
7. Never bypass branch protection (no admin pushes, no admin merges) unless the user explicitly
   says so for that specific case. If required checks fail, fix the cause instead of bypassing.
