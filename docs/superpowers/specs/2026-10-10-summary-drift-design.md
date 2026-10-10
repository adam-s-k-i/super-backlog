# Summary Drift Detection and Onboarding — Design Spec

- **Date:** 2026-10-10
- **Status:** Design approved section by section in the brainstorming session of 2026-10-10
- **Scope:** Shared drift module, new `sbl summary` command, doctor check 5 and summary page integration, onboarding through the AGENTS.md workflow block, `sbl init` and the `architecture-summary` skill; supersedes TASK-98
- **Builds on:** [Project summary page design](2026-10-09-project-summary-design.md) (v1.7.0)

## Problem

The project summary page (v1.7.0) shows a curated architecture diagram from `backlog/docs/architecture.yml`. Two gaps remain:

1. **Onboarding.** After `sbl init` the page shows "No architecture file yet" and nothing tells the user or the agent what to do next. The `architecture-summary` skill exists, but the agent only runs it when someone asks.
2. **Maintenance.** Once written, the file silently goes stale. Paths in `files:` get renamed or deleted, the `tasks:` map keeps ids of tasks that are long Done (the dogfood file still maps TASK-85..92, all Done; TASK-98), and code under documented paths keeps changing while the file stays the same. Nothing measures this, so nobody knows when to refresh.

## Rejected alternatives

- **Run the skill inside `sbl init`.** `sbl` is a CLI without an agent; it cannot run a skill. Init can only point the agent at it.
- **Drift logic in each consumer** (doctor, command, page each computing their own signals). Three implementations would diverge; one shared module is cheaper to test.
- **Drift as schema warnings inside `loadArchitecture`.** The schema loader stays pure and file-local; drift needs git, the filesystem and the task list.
- **Uncovered top-level directories as a signal.** Too noisy: most projects have directories that do not belong in an architecture diagram (`docs/`, `scripts/`, fixtures).
- **`sbl summary --export`.** Deferred; not part of this design.

## Decisions

### Drift module — `src/dashboard/summary-drift.ts`

```ts
export type DriftCode = 'missing-path' | 'done-task' | 'unknown-task' | 'stale-file';
export interface DriftFinding { code: DriftCode; path: string; message: string }
export interface DriftResult { findings: DriftFinding[]; notes: string[] }

export function detectDrift(
  cwd: string,
  architecture: Architecture,
  opts: { tasks: { id: string; status: string }[] | null; deps?: DriftDeps },
): DriftResult;
```

- Pure with respect to its inputs; all filesystem and git access goes through injectable `deps` (defaults: `fs.existsSync`/`statSync`, `runCapture`). It never throws: an unexpected error inside one signal becomes a note and the other signals still run.
- `notes` explains every skipped signal (for example `task signals skipped: backlog CLI unavailable`, `stale-file skipped: not a git repository`).
- Findings are ordered by signal (`missing-path`, `done-task`, `unknown-task`, `stale-file`), then by path.

**Signals:**

| Code | Rule | `path` | Skipped when |
|------|------|--------|--------------|
| `missing-path` | A `nodes[].files` entry does not exist relative to `cwd`. An entry ending in `/` must be a directory; any other entry may be a file or a directory. | `nodes.<id>.files` entry | never |
| `done-task` | A `tasks:` key points to a task whose status matches `isDone` (`done`, `complete`, `completed`, case-insensitive; reuse `isDone` from `src/dashboard/metrics.ts`). | `tasks.<TASK-ID>` | `opts.tasks` is `null` |
| `unknown-task` | A `tasks:` key is absent from the task list (archived, deleted or never existed). | `tasks.<TASK-ID>` | `opts.tasks` is `null` |
| `stale-file` | Count commits since the last commit that touched `backlog/docs/architecture.yml` which change any documented `files:` path that exists: `git log -1 --format=%H -- backlog/docs/architecture.yml`, then `git rev-list --count <sha>..HEAD -- <paths…>`. A finding when the count is **≥ 20**. | `backlog/docs/architecture.yml` | no git, not a repository, or the file has no commit history |

`STALE_COMMIT_THRESHOLD = 20` is an exported constant. The stale check costs exactly two git calls; the schema limits (40 nodes × 12 files) bound the path checks.

### Shared prompt text — `summaryAgentPrompt(state)`

One function in `summary-drift.ts` returns the prompt the user hands to the agent, so CLI and page never diverge:

- `missing` → `Run the architecture-summary skill to create backlog/docs/architecture.yml for the project summary page.`
- `invalid` → `Run the architecture-summary skill to repair backlog/docs/architecture.yml; sbl summary lists the problems.`
- `drift` → `Run the architecture-summary skill to refresh backlog/docs/architecture.yml; sbl summary lists the drift findings.`

`state` is `'missing' | 'invalid' | 'drift'`; a clean file has no prompt.

### `sbl summary` command — `src/commands/summary.ts`

Usage: `sbl summary [--check]`. It runs inside a project (same detection as `sbl doctor`), loads the file with `loadArchitecture(cwd, { taskIds })`, reads the task list with `readTaskList(cwd)`, extracted from the private doctor helper `defaultReadTaskLabels` into `src/lib/task-list.ts` and used by both commands, and calls `detectDrift`.

Output follows the doctor style:

```
[ok]   architecture.yml valid, no drift
```

```
[warn] architecture.yml valid, 3 drift findings
  missing-path  nodes.cli.files  src/commands/old.ts does not exist
  done-task     tasks.TASK-85    TASK-85 is Done
  stale-file    backlog/docs/architecture.yml  24 commits touched documented files since the last update
  note: stale-file skipped: not a git repository
next step: ask your agent: "Run the architecture-summary skill to refresh backlog/docs/architecture.yml; sbl summary lists the drift findings."
```

- **Missing file:** `[warn] architecture.yml not present` plus the `missing` prompt.
- **Invalid file:** `[fail] architecture.yml invalid` plus up to 20 problems (`path  message`, then `… and N more`) plus the `invalid` prompt. No drift check on an invalid file.
- **Schema or layout warnings** on a valid file are listed like doctor check 5 does today, before the drift findings.
- **`--check`:** the same status, finding and note lines, but no `next step` line and no prompt. Intended for CI and for the agent's end-of-pipeline check.

**Exit codes** (existing convention, `src/cli.ts`):

| Situation | Exit |
|-----------|------|
| File valid, no warnings, no drift | 0 |
| File missing, or valid with schema/layout warnings, or drift findings | 4 |
| File invalid, or not inside a project | 1 |

`--check` uses the same exit codes. The command is added to the CLI dispatch, the HELP text and the README command table.

### Doctor check 5

Check 5 (`src/commands/doctor.ts`) calls `detectDrift` on a valid file. With findings it prints `[warn] architecture.yml valid, N drift findings – run sbl summary for details` instead of listing them; the doctor exit code treats this like any other warning. `[skip]` and `[fail]` behaviour is unchanged. A throw from `layoutArchitecture` or `detectDrift` is caught and becomes a problem line.

### Summary page

- `buildSummaryModel` (`src/dashboard/summary-render.ts`) adds `model.drift: { count: number; codes: DriftCode[]; prompt: string } | null`. The hub already loads the task list for the dashboard; it passes those tasks to `detectDrift`, so the page costs no extra backlog call. Any throw inside drift detection yields `drift: null` and never breaks the page.
- `noticeHtml` renders a subtle drift banner when `model.drift` is set: one line such as `3 drift findings (missing paths, Done tasks) – the diagram may be out of date`, plus a copy button that copies `model.drift.prompt`. It reuses the existing copy machinery (`.copy` class, `data-copy`, `copyText`, delegated click handler).
- The existing missing-file notice ("No architecture file yet") gets the same copy button with the `missing` prompt.
- The banner uses existing tokens only; no new colours.

### Onboarding

- **AGENTS.md workflow block** (`src/templates/workflow-block.md`): a new binding rule 7:
  > 7. Keep the project summary current — at session start, if `backlog/docs/architecture.yml` is missing, offer once to run the architecture-summary skill. At the end of the pipeline, after a merge, run `sbl summary --check`; if it reports drift, offer a refresh. Never run the skill without the user's consent.
- **`sbl init`** (`src/commands/init.ts`): after the completion line, when `backlog/docs/architecture.yml` does not exist and the run is not a dry-run, print
  `next step: ask your agent to run the architecture-summary skill (writes backlog/docs/architecture.yml for the summary page)`.
  Nothing is printed when the file exists or on `--dry-run`.
- **Skill template** (`src/templates/skill-architecture-summary.md`): "When this skill runs" gains the trigger `sbl summary reports drift`. The procedure starts an update by running `sbl summary`, fixes every finding (remove or correct missing paths, prune `tasks:` entries for Done or unknown tasks, refresh nodes whose code changed) and finishes when `sbl summary` exits 0 (or 4 only for warnings the user accepts). Step 6 (doctor check 5) stays.

### Error handling

- Missing git or backlog CLI skips the affected signals with a note; the command never fails because of them.
- Every consumer (command, doctor, hub) wraps `detectDrift` so an unexpected throw becomes a problem line (command, doctor) or `drift: null` (page).
- No network access; at most two git calls plus one backlog call per run.

## Testing

- **Unit, drift** (`test/unit/summary-drift.test.ts`): each signal with injected deps; trailing `/` requires a directory; file vs directory entries; `tasks: null` skips task signals with a note; no git / no history skips `stale-file` with a note; threshold boundary at 19 (no finding) and 20 (finding); a throwing dep becomes a note and the other signals still run; deterministic ordering; `summaryAgentPrompt` for all three states.
- **Unit, command** (`test/unit/summary-command.test.ts`): output and exit code for missing (4), clean (0), drift (4), schema warnings (4), invalid (1, problem list capped at 20), not in a project (1); `--check` omits the next-step line and prompt with identical exit codes.
- **Unit, doctor** (`test/unit/doctor.test.ts`): check 5 prints the drift warn line and the overall exit reflects a warning; a throwing `detectDrift` becomes a problem line.
- **Render** (`test/unit/summary-render.test.ts`): drift banner present with count and copy button carrying the prompt; no banner when `drift` is null; missing-file notice has a copy button with the `missing` prompt; prompt text is HTML-escaped.
- **Templates** (`test/unit/templates.test.ts`, `test/unit/glue-skills.test.ts`): rule 7 is present in the rendered AGENTS block; the skill template contains the drift trigger and the `sbl summary` step.
- **Init** (`test/integration/init-preflight.test.ts`): the next-step hint appears when the file is missing, not when it exists, and not on dry-run.
- **E2E** (`test/integration/`): a temp git repo with an `architecture.yml` that references a deleted path; `sbl summary` exits 4 and prints `missing-path`; after fixing the file it exits 0.
- Tests never touch the real `~/.super-backlog` hub or registry and never write to the real clipboard.

## Docs

- `docs/guide/project-summary.md`: new section "Keeping it current" covering `sbl summary`, `--check`, the four signals, the threshold, the exit codes and the agent prompt.
- README command table and `sbl --help` list `sbl summary`.
- `docs/guide/quickstart.md`: one sentence on the init next-step hint.

## Cleanup

- TASK-98 is closed as superseded by this feature (final summary points to this spec).
- This repo's `backlog/docs/architecture.yml`: prune the Done `tasks:` entries (TASK-85..92) and change the cli node purpose to "eight commands" including `summary`. `sbl summary` exits 0 on the dogfood file afterwards.

## Implementation units

Order is dependency order; each unit is one backlog task.

1. **Drift module** — `summary-drift.ts`, `detectDrift`, `summaryAgentPrompt`, unit tests.
2. **`sbl summary` command** — command, CLI dispatch, HELP, README table, command tests, E2E test.
3. **Doctor and summary page** — doctor check 5 drift line, `model.drift`, banner and copy buttons, render tests.
4. **Onboarding** — workflow-block rule 7, init hint, skill template update, template and init tests, guide and quickstart docs.
5. **Dogfood and cleanup** — prune the repo's `architecture.yml`, verify `sbl summary` exits 0, close TASK-98.

## Out of scope

- `sbl summary --export` and any other output format.
- Automatic fixing of drift by `sbl`; only the agent edits the file, with consent.
- Uncovered-directory detection.
- A configurable stale threshold.
