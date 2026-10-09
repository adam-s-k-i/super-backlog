# Subagent Model Routing Rule — Design Spec

- **Date:** 2026-10-09
- **Status:** Approved (chat design gate)
- **Scope:** Workflow block template, CLAUDE.md pointer template and its refresh logic, docs, dogfood refresh of this repo

## Problem

Agents in projects set up by super-backlog do every piece of work on the session model, even routine work such as searches, test runs or backlog bookkeeping. On a top-tier session model that is slow and expensive for no quality gain. The user wants every initialized project to carry a binding rule: delegate less demanding work to subagents on cheaper models, picked by task complexity, regardless of which model the session currently runs on.

super-backlog supports several agent harnesses (Claude Code and OpenCode today; Cursor, Codex and Gemini CLI are planned), so the rule must be phrased harness-neutrally. The existing model router (`sbl models`) does not cover this: it is opt-in, knows only two tiers (workhorse and budget) for its own `sbl-worker` agents, and never tells the main agent when to delegate.

## Decisions

| # | Decision | Choice |
|---|---|---|
| M1 | Home of the rule | A new `### Model routing for subagents` subsection inside the managed AGENTS.md workflow block (`src/templates/workflow-block.md`). The block is versioned, refreshed by `sbl update` in every project and read by every supported harness. |
| M2 | Model naming | Three neutral tiers by complexity (light, standard, top) plus short per-harness examples. The examples are refreshed with each super-backlog release; no per-project model configuration. |
| M3 | Always on | The rule is part of the block like the other binding rules. No flag, no config key, no opt-out. Projects that want different behaviour add a project rule below the block. |
| M4 | Binding rule link | The "Binding rules" list gains rule 6, which points at the new subsection. |
| M5 | CLAUDE.md pointer text | `src/templates/claude-pointer.md` gains one sentence: distribute subagent work by the block's model-routing section and always pass the Agent tool's `model` explicitly. The pointer stays a single `##` section with the existing heading. |
| M6 | Pointer refresh | `applyClaudePointer` no longer stops when the pointer heading exists. It locates the pointer section (from the pointer heading to the next heading of any level, the boundary uninstall already uses), replaces it when its text differs from the template, and reports unchanged otherwise. Comparison ignores line-ending differences, and the file's existing line endings are kept. Content under any other heading is never touched. Section detection moves into one shared helper used by both execute and uninstall. |
| M7 | CLAUDE.md creation | Unchanged: the `claude` harness creates or appends CLAUDE.md exactly as today. |
| M8 | Model router | Unchanged and not referenced by the rule. Its Claude Code agents ship with a placeholder model until the session hook runs, so pointing the rule at them would be unreliable. |
| M9 | Dogfood | After the update, this repo's hand-written "Model routing for subagents" sections in AGENTS.md (below the block) and CLAUDE.md (below the pointer) are removed, because the managed rule replaces them. |

## Rule text (block subsection)

The block stays English like the rest of the template. The examples are a bullet list, not a numbered table: `test/unit/dashboard-render.test.ts` reads the pipeline phases from table rows that start with `| <number> |`, so no other table of that shape may appear in the block.

```markdown
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
```

Binding rule 6 (M4):

```markdown
6. Delegate by tier — less demanding work goes to subagents on cheaper models (see "Model routing for subagents" below).
```

## Pointer text (M5)

```markdown
## Workflow system (managed by super-backlog)

This project uses the combined Backlog.md + Superpowers workflow. Read the
integration block in AGENTS.md (section between SUPER-BACKLOG markers) and follow
it. Tasks are managed exclusively through the `backlog` CLI. Distribute subagent
work by the block's "Model routing for subagents" section and always pass the
Agent tool's `model` explicitly.
```

## Data flow

1. `sbl init` (harness `claude` and/or `opencode`) and `sbl update` already plan `inject-agents-block`. The block now carries the new subsection; `injectBlock` replaces the old span because the text and version changed.
2. `sbl init` and `sbl update` plan `write-claude-pointer` whenever the `claude` harness is active (`sbl update` always is). The refreshed `applyClaudePointer` (M6) appends the pointer when missing, replaces a stale pointer section, and leaves an identical one alone.
3. `sbl uninstall` keeps removing the pointer section through the shared helper; behaviour is unchanged.

## Error handling

- An unreadable CLAUDE.md keeps today's behaviour; the pointer write surfaces the existing error path.
- A pointer heading that appears more than once: only the first section is refreshed, matching uninstall's first-match behaviour.
- User text written directly under the pointer heading (inside the pointer section) is replaced on refresh. This is the documented contract: own content belongs under its own heading.

## Testing

- `test/unit/templates.test.ts`: the block contains the subsection heading, the three tiers (Light, Standard, Top), the explicit-model requirement, the "regardless of" clause and binding rule 6; it contains no `TBD`/`TODO`; the pointer mentions the routing section and `model`.
- `test/unit/dashboard-render.test.ts` stays green (pipeline rows unchanged).
- Pointer refresh (unit or integration on `applyClaudePointer`):
  - missing pointer → appended (as today);
  - stale pointer text → replaced, surrounding content and other headings preserved;
  - identical pointer → unchanged, no write;
  - CRLF file → treated as identical when only line endings differ, line endings preserved on replace.
- e2e `sbl update` on a project with an old pointer and old block → both refreshed, a second run reports no further changes.
- e2e `sbl uninstall` after a refresh → pointer section and block removed, remnant check clean.

## Docs

- `docs/guide/harness-support.md`: describe the routing rule as part of the harness-neutral block and note that the CLAUDE.md pointer is now refreshed by `sbl update`.
- `docs/guide/quickstart.md` and `README.md`: one short mention of the rule under what `sbl init` sets up.
- The Docs-Gate requires a docs change for `feat` PRs touching `src/`; the above satisfies it.

## Rollout

- Implemented on branch `feat/subagent-model-routing`; released as a new minor kit version (expected 1.6.0) after the user's per-version approval.
- Existing projects receive the rule with their next `sbl update`.

## Out of scope

- An opt-out flag or per-project model configuration
- Changes to the model router (`sbl models`, `sbl-worker` agents, discovery)
- New harnesses or harness-specific instruction files (e.g. GEMINI.md)
