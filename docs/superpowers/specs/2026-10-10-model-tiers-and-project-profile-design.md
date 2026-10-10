# Model Tiers, Delegation and Project Profile — Design Spec

- **Date:** 2026-10-10
- **Status:** Design approved section by section in the brainstorming session of 2026-10-10
- **Scope:** Rewrite of the managed block's model-routing section into a four-tier delegation rule, a per-project profile of critical areas (`backlog/docs/critical-areas.md`) with its own skill, doctor check and init hint, docs and tests
- **Builds on:** [Subagent model routing design](2026-10-09-subagent-model-routing-design.md) (block rule 6 and the "Model routing for subagents" section), [Summary drift design](2026-10-10-summary-drift-design.md) (the onboarding pattern reused here)
- **Follow-up:** Router v2 (four tiers in `models.json`, rendered examples) is a separate later spec, see "Out of scope"

## Problem

The managed AGENTS.md block tells agents to delegate by three tiers (light, standard, top) and to "start one tier lower and escalate". That rule is short on *when* delegation pays off, how to brief and check a subagent, and when to escalate. It has no notion of project-specific risk: a refund flow and a typo fix get the same tier logic. The user's own delegation prompt (four tiers, delegation criteria, dispatch contract, quality duty, and a per-project "critical areas" profile) should apply to every project that installs super-backlog, in every harness, without hand-editing.

## Rejected alternatives

- **Block text only, profile inside AGENTS.md.** Fast, but the profile would live unstructured in a file the block mechanism edits, with no onboarding nudge, no check and nothing a dashboard could show.
- **Render the profile into the managed block** (`sbl update` copies the file into the block). Two sources of truth, every profile edit needs `sbl update`, the block grows. A 150-word file does not justify it.
- **Couple the tiers to the model router now** (block examples rendered from `models.json`). Deferred to Router v2; this design is built so that step only swaps the static example lines for rendered ones.
- **Create the profile unprompted.** The user's prompt says "create it"; this design asks for consent once, like rule 7, so no agent writes a repo file without being asked.

## Decisions

### Block section — "Model tiers and delegation"

`src/templates/workflow-block.md` replaces rule 6 and the whole "Model routing for subagents" section. Rule 6 becomes:

> 6. Delegate by tier — every subtask goes to the cheapest model that solves it reliably (see "Model tiers and delegation" below).

The section text, verbatim:

```markdown
### Model tiers and delegation

Goal: the best result at the lowest token cost. Every subtask goes to the
cheapest model that solves it reliably, regardless of the session model:
hand simpler work to a subagent on a cheaper model, and harder work to a
subagent on a stronger model when the session runs on a lower tier.

Tiers (see the examples below for current model names; otherwise use the
closest available equivalents):

- **Light** — purely mechanical: searching, listing, extracting, reformatting.
- **Standard** — clearly specified routine work: research, summaries,
  routine code, tests, documentation.
- **Strong** — demanding work with clear boundaries: complex implementation,
  debugging, reviews.
- **Top** — analysis, design, architecture, interpreting ambiguous results,
  every decision where a mistake is costly or hard to reverse, and everything
  `backlog/docs/critical-areas.md` lists as critical.

When unsure between two tiers, take the higher one. In this pipeline:
brainstorming, specs, plans and the final whole-branch review are Top;
per-task reviews and debugging are Strong; fully specified plan steps,
tests and docs are Standard; lookups and Backlog.md CLI bookkeeping are Light.

Delegate only when it pays off: the task is self-contained, can be briefed
completely in a few sentences, and is large enough (many files or sources,
much intermediate output). Do small things and anything that needs the whole
conversation context yourself — there the handover costs more than it saves.

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
yourself. Anything `backlog/docs/critical-areas.md` lists under "Independent
check" is additionally checked, before use, by a subagent on Strong or higher
that did not see the work being produced.

If the harness has no subagents or no per-dispatch model choice, work
directly and without mentioning it.

Examples (current as of this super-backlog release):

- Claude Code: the Agent tool's `model` parameter — light `haiku`, standard
  `sonnet`, strong `opus`, top = the strongest available model (e.g. Fable).
- OpenCode: set the tier's model on the subagent, e.g. the `model` field of
  an agent in `.opencode/agents/`.
- Other harnesses: the equivalent per-subagent model setting.
```

Decisions inside the text:

- Four harness-neutral tiers **Light / Standard / Strong / Top**. Model names appear only in the examples block; Router v2 replaces that block with rendered lines and nothing else.
- **"When unsure, take the higher tier"** reverses the previous "start one tier lower and escalate". Escalation remains the response to a result that falls short.
- The "In this pipeline" sentence maps the pipeline steps to tiers so the block and the subagent-driven-development skill ("cheap / standard / most capable") speak the same language.
- The block still contains no table that starts with `| <number> |` other than the pipeline table (the dashboard-render test parses it).

### Project profile — `backlog/docs/critical-areas.md`

A per-project Markdown file next to `architecture.yml`. `sbl` never writes or edits it; `sbl update` does not touch it. Format: English heading and keys, body in the user's language, at most 150 words below the Status line, grouped by risk area rather than by activity:

```markdown
# Critical areas

Status: 2026-10-10, created with Fable 5.1, provisional

Always on the top tier:
- Payments: refund flow in src/billing, Stripe webhook handlers
- Data loss: migrations in db/migrate, anything deleting customer records
- Credentials: .env handling, OAuth token storage
- Public release: npm publish, release notes

Independent check: migrations, release publishing

May go to lower tiers: UI copy, test fixtures, docs, formatting, lookups
```

- `Always on the top tier:` holds 4 to 7 items with concrete examples from the project.
- `Independent check:` lists irreversible operations; the line is omitted when there are none.
- `May go to lower tiers:` names uncritical kinds of work so that not everything gets escalated.
- The word `provisional` at the end of the `Status:` line is the only machine-readable marker. It means the profile was drafted below the top tier or from a description only, and should be revised on the top tier.

### Block rule 8

Added to "Binding rules" after rule 7, verbatim:

> 8. Respect the project profile — read `backlog/docs/critical-areas.md` at session start; its entries override the tier rule. If the file is missing, offer once, before the first non-trivial task, to run the project-profile skill. Never run it without the user's consent.

### Skill `project-profile`

Template `src/templates/skill-project-profile.md`, frontmatter `name: project-profile`, installed by `sbl init` and `sbl update` to `.claude/skills/project-profile/SKILL.md` and `.opencode/skill/project-profile/SKILL.md` through `GLUE_SKILLS` in `src/init/execute.ts`. Structure mirrors `skill-architecture-summary.md`.

**When this skill runs**

- `backlog/docs/critical-areas.md` is missing (offered once per rule 8).
- The user asks for it.
- The project changed substantially: new modules, new risks, going live.
- A misclassification caused a mistake.
- A provisional profile can now be judged better, or `sbl doctor` reports it as provisional.

**Procedure**

1. Tier check. Assessment and wording are top-tier work only. If the session runs on a lower tier, hand both to a subagent on the top tier; fact gathering (step 2) may go to Light or Standard. If no top-tier model is available, write a draft, end the Status line with `provisional`, and tell the user once that it should be revised with the strongest model.
2. Targeted overview, no full reading: project description, existing instructions (AGENTS.md, CLAUDE.md), README, directory layout, central modules, and `backlog/docs/architecture.yml` if present.
3. Guiding question: where would a mistake go unnoticed and be costly or hard to reverse? Check at least: money, law, security and credentials, data loss and other irreversible actions, external visibility, decision-relevant metrics, structural choices with long-term consequences.
4. Look specifically for work that looks like routine but silently determines results; the general tier rule does not catch these cases.
5. Name explicitly what may go to lower tiers.
6. If the project is too empty to judge, derive the profile from the user's description and mark it `provisional`.
7. Write `backlog/docs/critical-areas.md` in the format above: at most 150 words below the Status line, 4 to 7 items grouped by risk area, `Independent check` only when something is irreversible.
8. Show the file once and STOP until the user approves it. If the file cannot be written, print it and ask the user to add it.

**Maintenance:** do not re-check the profile every session. Revise it, on the top tier, only on the triggers listed under "When this skill runs".

**Boundaries**

- Only touch `backlog/docs/critical-areas.md`.
- Never invent risks the project does not show; every item names something real in the project.
- Keep the 150-word limit; English heading and keys, body in the user's language.
- Never downgrade something the user marked as critical.

### Reader — `src/lib/critical-areas.ts`

```ts
export const CRITICAL_AREAS_PATH = 'backlog/docs/critical-areas.md';
export type CriticalAreasState =
  | { status: 'missing' }
  | { status: 'present'; provisional: boolean; stamp: string | null };
export function readCriticalAreas(cwd: string): CriticalAreasState;
```

- `stamp` is the text after `Status:` on the first line that starts with `Status:` (trimmed); `null` when no such line exists or the file cannot be read as text (for example a directory at that path).
- `provisional` is `true` when the Status line contains the word `provisional`, case-insensitive.
- Never throws. Doctor uses it now; the dashboard may use it later.

### Doctor check 6

After check 5 in `src/commands/doctor.ts`, same `emit` style, seam `deps.readCriticalAreas`:

| State | Line |
|-------|------|
| missing | `[skip] backlog/docs/critical-areas.md not present (ask your agent to run the project-profile skill)` |
| present, provisional | `[warn] backlog/docs/critical-areas.md is provisional – revise it on the top tier (project-profile skill)` |
| present, no Status line | `[warn] backlog/docs/critical-areas.md has no Status line – run the project-profile skill` |
| present, stamp | `[ok] backlog/docs/critical-areas.md present (<stamp>)` |
| reader throws anyway | `[warn] backlog/docs/critical-areas.md check failed (<message>)` |

A missing file is a skip, not a warning, so existing projects keep their doctor exit code after updating. No word count, no further content parsing, no git or backlog call.

### `sbl init` hint

`src/commands/init.ts` gains `INIT_PROFILE_HINT`:

`next step: ask your agent to run the project-profile skill (writes backlog/docs/critical-areas.md, the areas that always run on the top tier)`

Printed after the completion line when `backlog/docs/critical-areas.md` does not exist and the run is not a dry-run, **before** `INIT_SUMMARY_HINT` (the profile is needed before the first non-trivial task, the summary later). Each hint prints on its own line; both, one or none appear depending on which files exist.

### Pointer template

`src/templates/claude-pointer.md`: the last sentence becomes "Distribute subagent work by the block's "Model tiers and delegation" section, respect `backlog/docs/critical-areas.md`, and always pass the Agent tool's `model` explicitly."

### Rollout to existing projects

`sbl update` already refreshes the block, the pointer and the glue skills, so projects receive the new section, rule 8 and the skill with their next update. The profile file itself is created only by the agent, with consent.

### Error handling

- `readCriticalAreas` never throws; doctor still wraps it and turns a throw into a warn line, like check 5.
- Check 6 reads one file; no network, git or backlog access.
- When the profile is missing, the tier rule applies on its own (the Top tier definition without the project addition); nothing in the block or skill depends on something `sbl` would have to generate.

## Docs

- `docs/guide/harness-support.md`: the "Model routing rule (all harnesses)" section becomes "Model tiers and delegation (all harnesses)": four tiers, delegation criteria, independent check, reference to the project profile; the per-harness examples stay.
- New `docs/guide/project-profile.md`: purpose of the file, format with the example above, the `provisional` marker, how the skill runs (top tier, consent), maintenance triggers, doctor check 6. Added to the guide navigation next to `project-summary.md`.
- `docs/guide/quickstart.md`: one sentence on the second init hint; the doctor description lists check 6.
- `README.md` line 92: the dead link to `docs/superpowers/specs/2026-08-26-sbl-model-router-design.md` points to `docs/guide/harness-support.md` instead.
- `docs/index.md`: unchanged (it describes only the router).

## Testing

- **Templates** (`test/unit/templates.test.ts`): the rendered block contains rule 6 in its new wording and rule 8 verbatim, the heading `### Model tiers and delegation`, all four tier names, the three example lines, and no longer the heading `Model routing for subagents`; still no second table starting with `| <number> |`. The pointer template names the new section and `critical-areas.md`.
- **Glue skills** (`test/unit/glue-skills.test.ts`): five templates instead of four; `skill-project-profile.md` has `name: project-profile`, names `backlog/docs/critical-areas.md`, `provisional`, `150 words`, the STOP step and the top-tier check.
- **Reader** (`test/unit/critical-areas.test.ts`, new): missing file; present without Status line (`stamp: null`, `provisional: false`); `provisional` in upper and lower case; a normal stamp; a directory at the path yields `present` with `stamp: null` and no throw.
- **Doctor** (`test/unit/doctor.test.ts`): check 6 skip, warn (provisional, no Status line, throwing seam) and ok through the seam; the exit code is 4 for a provisional profile and unchanged for a missing file.
- **Init** (`test/integration/init-preflight.test.ts`): the profile hint appears before the summary hint when both files are missing, is absent when `critical-areas.md` exists, and is absent on `--dry-run`.
- **E2E** (`test/e2e/doctor.e2e.test.ts`): `expectCleanExceptDrift` accepts the check 6 skip line; after the dogfood step this repo yields `[ok]`.
- Tests never touch the real `~/.super-backlog` hub or registry and never write to the real clipboard.

## Dogfood (this repository)

- Refresh the managed glue with `sbl update --no-self` (block, pointer, skills), never by hand.
- Create a real `backlog/docs/critical-areas.md` for super-backlog on the top tier through the new skill. Expected areas: release and publish (release-please, npm), the managed marker blocks written into other projects' AGENTS.md (can destroy user content), the guard hook, the hub registry under `~/.super-backlog`, the model-router files written into other projects' `.claude/` and `.opencode/`. The user sees the file before it is committed.
- `backlog/docs/architecture.yml` lists `src/lib/critical-areas.ts` and the new skill template; `sbl summary --check` and `sbl doctor` are clean (check 6 `[ok]`).

## Implementation units

Order is dependency order; each unit is one backlog task.

1. **Block and pointer** — rule 6 wording, rule 8, the "Model tiers and delegation" section, `claude-pointer.md`, template tests.
2. **Reader and doctor check 6** — `src/lib/critical-areas.ts`, doctor check 6 with seam, reader and doctor unit tests, E2E tolerance.
3. **Skill and init hint** — `skill-project-profile.md`, `GLUE_SKILLS`, `INIT_PROFILE_HINT`, glue-skill and init tests. Depends on 2 (`CRITICAL_AREAS_PATH`).
4. **Docs** — harness-support, new project-profile guide page and navigation, quickstart, README link. Depends on 1–3.
5. **Dogfood** — `sbl update --no-self`, this repo's profile, `architecture.yml`, green `sbl summary --check` and `sbl doctor`. Depends on all.

Units 1 and 2 are independent of each other.

## Out of scope

- Router v2 (separate spec): four tiers in `.super-backlog/models.json`, agents per tier, discovery and defaults, `sbl update` maintaining router files, block example lines rendered from the configuration, the `TIER_PLACEHOLDER` gap.
- Showing the profile in the dashboard.
- Automatic creation or content validation of the profile by `sbl` (word count, completeness).
