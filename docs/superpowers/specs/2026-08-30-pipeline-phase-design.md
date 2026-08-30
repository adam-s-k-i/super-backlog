# Explicit Pipeline Phase — Design Spec

- **Date:** 2026-08-30
- **Status:** Approved (chat design gate); release blocked behind the user acceptance gate (R1)
- **Scope:** Phase labels, `sbl phase` command, skill + workflow-block updates, dashboard phase rendering, doctor hygiene checks

## Problem

The AGENTS.md pipeline defines nine phases with human gates, but Backlog.md only tracks To Do / In Progress / Done. Where a task actually stands in the pipeline (spec reviewed? plan approved? in TDD?) lives only in prose — the dashboard stepper has to guess, and every new session starts with context reconstruction. The friction the user named: sessions lose their place, the dashboard watches instead of informs, and phase state cannot be resumed.

## Decisions

| # | Decision | Choice |
|---|---|---|
| P1 | Storage | Backlog.md labels: `phase/spec`, `phase/plan`, `phase/impl`, `phase/verify`. Exactly one `phase/*` label per task; other labels untouched. Statuses stay To Do / In Progress / Done — phases are orthogonal, not columns. |
| P2 | Phase model | Four task phases: `spec` (created, review gate open) → `plan` (plan being written / awaiting approval) → `impl` (TDD) → `verify` (tests/lint/finalization). Terminal transition `done` removes the label. Gates are transitions, not states. Drafts (idea/brainstorm) carry no phase label — the pipeline starts at task creation. |
| P3 | Transitions | Agent sets the phase via CLI exactly at gate passages (after explicit approval). Dashboard offers copy-to-clipboard chips (`sbl phase <id> <phase>`) in the task modal — same pattern as existing quick actions; no new server-side execution path. |
| P4 | Command | `sbl phase TASK-<n> <spec\|plan\|impl\|verify\|done>`: reads current labels via `backlog task view --json`, validates, swaps via `backlog task edit --remove-label <old> --add-label <new>` in a single call when the CLI supports combining them, else two sequential calls (`done` = remove only). `sbl phase TASK-<n>` prints the current phase or `none`. Exit 0/1. New files: `src/commands/phase.ts`, `src/lib/phase.ts` (pure, unit-tested like the planner). |
| P5 | Validation | Reject: unknown phase value; phase transition on a task with no phase label (except setting `spec`); a task carrying two `phase/*` labels (error pointing at `sbl doctor`). |
| P6 | spec-to-backlog skill | Task creation adds `-l "phase/spec"`; skill text states transitions happen only via `sbl phase`. |
| P7 | task-review-gate skill | Becomes the session entry + resume flow: reads task AND phase, presents goal/ACs/phase/recorded plan, waits for explicit approval. Resume behavior per phase: `spec` → present for review gate; `plan` → show plan, get approval; `impl` → refresh plan, continue TDD; `verify` → collect verification evidence. Phase advance after approval via `sbl phase`. |
| P8 | Workflow block | Pipeline table gains a phase column; new binding rule: "Phase transitions only via `sbl phase`, always at a gate passage." Delivered as a new kit version; existing installs refresh via `sbl update`. |
| P9 | Dashboard | `DashboardTask` gains `labels: string[]` plus derived `phase` (already present in CLI JSON). Feature-Cycle stepper renders the true phase distribution; tasks table and detail modal show a phase badge; modal offers the clipboard chip from P3. SSE live-reload reflects transitions immediately. |
| P10 | Doctor hygiene | New checks in `sbl doctor`: (a) task with two `phase/*` labels → error with fix hint; (b) In-Progress task without a phase label → warning (legacy inventory, no coercion); (c) unknown `phase/<x>` label → error. Output in the established doctor format. |
| P11 | Error handling | Backlog-CLI unreachable / invalid JSON follows the unified exit-code convention. Legacy tasks without phase labels are not migrated automatically; `sbl phase <id> spec` backfills on demand. |
| P12 | Marker upgrade | Verify `sbl update` recognizes and replaces this repo's stale `SUPER-BACKLOG:0.1.0` block (version in the start marker must match upgrade-tolerant); if it does not, fixing marker matching becomes its own plan step before any release. |

## Rollout & user acceptance gate

| # | Gate | Rule |
|---|---|---|
| R1 | Local only until acceptance | Implementation stays on a local branch: no push, no npm release, no `sbl update` rollout. The kit CLI runs from the local build (`node ./dist/bin.js` / linked). |
| R2 | Automated verification | Unit + integration + render tests green (see Testing) before anything is handed to the user. |
| R3 | User acceptance test | The user tests the full flow manually — CLI (`sbl phase` against real and fixture backlogs), doctor checks, and the live dashboard (`sbl dashboard` from the local build): stepper, badges, chips, SSE updates. |
| R4 | Production decision | Only after R3 passes does the user decide: ship (merge/push/release as a new kit version) or discard the approach. Discarding loses only the local branch. |

## Out of scope

- Phase auto-advance from agent heuristics without an explicit gate approval
- Server-executed phase buttons in the dashboard (write API) — chips only
- Migration of legacy tasks without phase labels
- Custom statuses or changes to `backlog/config.yml`
- Backlog.md browser theming (separate spike TASK-62)

## Testing

- **Unit (pure):** `src/lib/phase.ts` — phase set, swap logic, validation matrix (unknown value, none-label transition, double phase label, done-removal, label preservation).
- **CLI integration:** `sbl phase` against a temp backlog fixture — set/advance/query; error paths and exit codes.
- **Doctor:** hygiene checks against fixtures for cases (a)–(c), including legacy warning behavior.
- **Dashboard render:** stepper distribution from real labels, phase badge in table/modal, clipboard chip markup, SSE reload after a label change.
- **Skill/workflow-block:** template fingerprint checks in existing init/update tests cover the refreshed files.
- **Manual acceptance (R3):** scripted walkthrough create → gates → done with zero manual label edits; dashboard observed live.
