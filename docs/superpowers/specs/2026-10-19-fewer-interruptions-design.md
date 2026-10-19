# Fewer Interruptions: Drop the Project Profile, Bind Only the Three Gates — Design Spec

- **Date:** 2026-10-19
- **Status:** Design approved in the brainstorming session of 2026-10-19
- **Scope:** Remove the per-project profile (`backlog/docs/critical-areas.md`, the `project-profile` skill, block rule 8, doctor check, init hint) and soften the managed block so that the only human checkpoints are the three pipeline gates
- **Supersedes:** the "Project profile" parts of [Model tiers and project profile](2026-10-10-model-tiers-and-project-profile-design.md); the tier rule itself and Router v2 stay

## Problem

Since 1.9 the managed AGENTS.md block tells every agent that *every* subtask goes to the cheapest tier, that unsure cases go one tier up, that everything the project profile lists runs on the top tier (as a subagent when the session is lower), and that "Independent check" entries get a second reviewing subagent. Rules 7 and 8 add offers at session start, and the Superpowers skills add their own menus (branch end, execution mode). In daily use this floods a session with subagents, pushes merges back to the user and interrupts them far more often than the three gates the pipeline actually defines. The user wants the three gates — and nothing else — to be the only points where the agent stops.

## Rejected alternatives

- **Full revert to the pre-1.9 block.** Router v2 (`sbl-light…top` agents, `models.json` v2, dashboard tab) builds on the four tiers; reverting would be a large rebuild and leaves the Superpowers menus untouched.
- **Keep the profile as advisory text.** The file would still be offered, read and reasoned about every session for little gain; the user chose to remove it completely.
- **Delete `backlog/docs/critical-areas.md` in user projects on `sbl update`.** We never delete files we did not write; the file is simply no longer read.

## Decisions

### 1. The project profile is removed

- `src/templates/skill-project-profile.md` is deleted; `project-profile` leaves `GLUE_SKILLS` in `src/init/execute.ts`.
- `src/lib/critical-areas.ts` and its unit test are deleted. `sbl doctor` loses check 6 (the profile check); the remaining checks keep their order. `INIT_PROFILE_HINT` in `src/commands/init.ts` is deleted; `sbl init` keeps the architecture-summary hint.
- `src/models/agents.ts`: the Top tier description ends after "every decision where a mistake is costly" — the `critical-areas.md` clause is dropped. `sbl update` rewrites the `sbl-top.md` agent files accordingly.
- `src/templates/claude-pointer.md` drops "respect `backlog/docs/critical-areas.md`".
- `sbl update` removes the installed skill directories `.claude/skills/project-profile` and `.opencode/skill/project-profile` when present and reports `removed legacy <path>`, the same way `cleanLegacy` in `src/models/agents.ts` removes the router v1 files. `src/commands/uninstall.ts` keeps both paths in `OWNED_SKILL_DIRS` so older installs are still cleaned up.
- The repo's own `backlog/docs/critical-areas.md` is deleted; `backlog/docs/architecture.yml` drops the file reference.
- Docs: `docs/guide/project-profile.md` and its sidebar entry in `docs/.vitepress/config.mts` are deleted; `harness-support.md`, `model-router.md`, `quickstart.md` and `README.md` lose their profile sentences and the `sbl doctor` descriptions lose "the `critical-areas.md` project profile". The 2026-10-10 spec stays as history.

### 2. Block wording — only the three gates interrupt

`src/templates/workflow-block.md` changes as follows; everything not listed stays verbatim.

Rule 6 becomes:

> 6. Delegate by tier — when you delegate, the subtask goes to the cheapest model that solves it reliably (see "Model tiers and delegation" below).

Rule 7 becomes:

> 7. Keep the project summary current — if `backlog/docs/architecture.yml` is missing or `sbl summary --check` reports drift after a merge, say so in the final report; run the architecture-summary skill only when the user asks for it.

Rule 8 is deleted. A new rule 8 takes its number:

> 8. Human checkpoints are the three gates (3, 5, 6) and nothing else — outside them, do not ask for confirmation, make offers or present menus; decide, act and report at the end. Stop only when you are blocked or verification fails. This overrides any skill that asks for an integration or execution choice.

The "Model tiers and delegation" section:

- The opening paragraph becomes: "Goal: the best result at the lowest token cost. Default is to do the work yourself in the session. Delegate only when it pays off: the subtask is self-contained, can be briefed completely in a few sentences, and is large enough (many files or sources, much intermediate output). When you delegate, the subtask goes to the cheapest model that solves it reliably, regardless of the session model."
- The separate "Delegate only when it pays off …" paragraph is removed (its content moved up).
- The Top tier bullet ends after "every decision where a mistake is costly or hard to reverse".
- The "Quality" paragraph keeps "responsibility for the result stays with you … go one tier up or take over yourself" and loses the "Independent check" sentence.
- Tiers, "When unsure between two tiers, take the higher one", the pipeline mapping sentence, the "When delegating" list, the harness fallback and `{{MODEL_EXAMPLES}}` stay unchanged.

The two gate skills (`task-review-gate`, `spec-to-backlog`) and `architecture-summary` keep their STOPs: they are gates 5/6 and an explicit user request respectively.

### 3. Tests

- `test/unit/templates.test.ts`: assert the new rule 6, 7 and 8 texts, the absence of `critical-areas.md` and "Independent check", and the pointer without the profile sentence.
- `test/unit/glue-skills.test.ts`: drop the project-profile cases; assert the skill is not rendered.
- `test/unit/doctor.test.ts`, `test/e2e/doctor.e2e.test.ts`: drop check 6 and its `readCriticalAreas` seam.
- `test/integration/init-preflight.test.ts`: drop the profile hint expectation.
- `test/unit/models/agents.test.ts`: new Top description.
- `test/e2e/update.e2e.test.ts`: an installed `project-profile` skill directory is removed and reported.
- `test/e2e/uninstall.e2e.test.ts`: unchanged behavior (legacy dirs still removed).
- Snapshot files that change only in EOL are restored, not committed.

### 4. Release

Lands as `fix:` commits (the block over-asked; this corrects it) with `Release-As: 1.10.3` on the merge commit so release-please cuts 1.10.3 rather than 1.11.0, as the user asked. Dependency bumps and the dashboard fix of the same session ride the same release.

## Out of scope

- Changes to the Superpowers plugin skills themselves.
- The router (`sbl models`), the four tiers and the rendered examples.
- A replacement mechanism for per-project risk notes; projects add their own rules below the block.
