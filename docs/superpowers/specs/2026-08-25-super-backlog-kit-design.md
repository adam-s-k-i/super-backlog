# super-backlog — Kit Design Spec

- **Date:** 2026-08-25
- **Status:** Approved for planning
- **Scope:** v1 (MVP "core kit")

## 1. Problem

Superpowers (obra/superpowers) and Backlog.md (MrLesk/Backlog.md) are strong on
their own, but nothing wires them together:

- Superpowers defines *how* agents should work (brainstorming → plans → TDD → review).
- Backlog.md defines *what* is tracked (markdown tasks, Kanban board, browser UI).
- Connecting them today means hand-copying glue from project to project:
  workflow-integration blocks in AGENTS.md, bridge skills like `spec-to-backlog`,
  npm scripts, plugin config.

Market research (2026-08) confirmed the niche is open: every adjacent project
(jesstelford/superpowers-backlog, varienos/agentic-workflow,
navneetvishwakarma/throughline, cordsjon/20_agentflow, afrizzal/ratchet) either
uses its own backlog format or treats one of the two tools as optional. No
project combines Superpowers + Backlog.md + a project dashboard + cheat sheet.

## 2. Goal

One command equips any project — new or existing — with the combined workflow:

```bash
npx super-backlog init
```

…plus a guaranteed-clean exit path (`sbl uninstall`) and an at-a-glance
**Project Dashboard** (`dashboard.html`) showing key facts and current status.
Everything optimizes for simplicity: the developer installs, sees their project,
and starts working.

## 3. Key Decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Supported harnesses v1 | OpenCode + Claude Code (manifest designed for later additions) |
| D2 | Dashboard form | Static single-file `dashboard.html`, optional `--serve` watcher |
| D3 | Docs/UI language | English; German translation later |
| D4 | v1 scope | Core kit; extra skills/features recorded in our own backlog |
| D5 | Naming | Package/repo `super-backlog`, CLI bin `sbl` + `super-backlog` |
| D6 | Architecture | **Glue orchestrator** — delegate to upstream tools, own only the glue |
| D7 | Freshness | Upstream tools pulled at latest at init; `sbl update` refreshes glue |
| D8 | Integrity | Opt-in `--guard` pre-commit hook (v1); integrity check via `sbl doctor` (v2 backlog) |
| D9 | Terminology | The feature is called **Project Dashboard** everywhere; file stays `dashboard.html` |

Rejected alternative architectures: vendoring/forking both upstreams (B) —
unmaintainable, loses upstream fixes; template/starter repo (C) — splits new vs.
existing projects into divergent paths and contradicts the one-command goal.

## 4. Architecture

`super-backlog` is a Node ≥ 20 CLI (TypeScript, minimal runtime deps, ESM) that
orchestrates existing tools and injects templates. It never forks upstream code;
it pins nothing and therefore always pulls current versions at run time.

```text
┌──────────────┐   detects    ┌─────────────────────────────┐
│   sbl init   │─────────────▶│ PM (npm/pnpm/bun), existing │
└──────┬───────┘              │ backlog/, AGENTS.md,        │
       │ orchestrates         │ CLAUDE.md, opencode.json,   │
       ▼                      │ .claude/                    │
┌───────────────────────────────────────────────────────────┐
│ backlog.md@latest (devDep)  ·  backlog init --defaults    │
│ opencode.json plugin entry  ·  Claude marketplace/CLI     │
│ AGENTS.md marker block      ·  CLAUDE.md pointer          │
│ .opencode/skill + .claude/skills templates               │
│ npm scripts: tasks board browser dashboard               │
│ first dashboard.html generation                          │
└───────────────────────────────────────────────────────────┘
```

### 4.1 Install manifest (what lands where)

| Target | Content | Ownership model |
|---|---|---|
| `package.json` devDependencies | `backlog.md@latest` | merged |
| `backlog/` | created by `backlog init` (upstream owns) | delegated |
| `opencode.json` | `plugin[] += superpowers@git+https://github.com/obra/superpowers.git` | merged, other keys untouched |
| `.claude/` | superpowers via official marketplace (see §5.1) | instructed/delegated |
| `AGENTS.md` | `<!-- SUPER-BACKLOG:x.y.z START --> … END -->` block | marker-scoped |
| `CLAUDE.md` | one-line pointer to the AGENTS.md block | marker-scoped |
| `.opencode/skill/spec-to-backlog/SKILL.md` | glue skill template | fingerprint header line |
| `.claude/skills/spec-to-backlog/SKILL.md` | same template | fingerprint header line |
| `package.json` scripts | `tasks`, `board`, `browser`, `dashboard` | merged, add-only-if-absent |
| `dashboard.html` | generated Project Dashboard | regenerated wholesale |
| `.git/hooks/pre-commit` | guard hook (only with `--guard`) | appended block with markers |

## 5. Commands

### 5.1 `sbl init`

1. **Detect** before writing anything: package manager via lockfile; existence of
   `backlog/config.yml`, `AGENTS.md`, `CLAUDE.md`, `opencode.json`, `.claude/`.
2. **Install upstream:** add `backlog.md@latest` as devDependency with detected
   PM; run `backlog init "<name>" --defaults --agent-instructions none`
   (skipped when a backlog config already exists — our own block replaces the
   generic instructions).
3. **Wire harnesses:** create-or-merge the OpenCode plugin entry into
   `opencode.json`.
   For Claude Code: if the `claude` CLI supports non-interactive marketplace
   commands, run them; otherwise print the exact command to paste
   (`/plugin install superpowers@claude-plugins-official`). Skills install
   file-based either way.
4. **Inject glue:** replace-or-create the marker block in `AGENTS.md`; write the
   pointer into `CLAUDE.md`; copy skill templates to both harness locations.
5. **Merge scripts:** `tasks`, `board`, `browser`, `dashboard` (never overwrite).
6. **Generate** the first `dashboard.html` and print next steps
   (`sbl dashboard --serve`).

Flags: `--harness opencode,claude` (default: both) · `--pm auto|npm|pnpm|bun` ·
`--guard` (install pre-commit hook) · `--no-dashboard` · `--dry-run` · `--force`.

Idempotent: safe to re-run any time; re-running with a newer kit version is the
upgrade path for all injected artifacts.

Windows note: v1 writes the canonical git-backed plugin spec; the documented
npm-fallback for OpenCode's cache issue lives in README troubleshooting. An
automated check arrives with `sbl doctor` (v2).

### 5.2 `sbl uninstall`

Removes only provably owned artifacts: marker blocks, files carrying our
fingerprint header, scripts whose value matches ours exactly, the plugin entry
only if byte-equal to our spec string, `dashboard.html`. Backlog task data is
kept by default — full removal requires explicit `--with-backlog`. Ends with a
report listing removed / kept / skipped items.

### 5.3 `sbl update`

Refreshes injected artifacts (block, pointer, skills, hook) to the installed
kit version, refreshes `backlog.md@latest`, compares installed vs. published
upstream versions and prints guidance. Never touches task data.

### 5.4 `sbl dashboard`

Generates `dashboard.html` from stable read sources only:
`backlog task list --json` (versioned fields), milestones, plus project name /
description from `backlog/config.yml` and `package.json`.

Layout — outside-in, progressive disclosure:

1. Header: project name · description · generated-at · kit version
2. Metric cards: tasks per status (To Do / In Progress / Done), open milestones
3. Milestone progress bars (done / total)
4. Compact task table with status chips; row click expands detail
   (description, acceptance criteria as checkboxes)
5. Workflow cheat sheet: the 9-phase pipeline rendered as table/timeline +
   quick commands (`backlog board`, `backlog browser`, `sbl …`)
6. Footer: live-board hint (`backlog browser`) + regeneration command

Single self-contained file: embedded JSON island, inline CSS/JS, no CDNs or
external fonts — works offline, diffs cleanly in git, hostable anywhere.
Vanilla JS only; client-side sort/filter; honors `prefers-color-scheme`;
clean typography/spacing tokens.

`--serve`: tiny built-in Node HTTP server (no Express), watches `backlog/`,
regenerates on change, default port **6428** (backlog browser uses 6420),
`--no-open` supported.

## 6. Glue Layer Content

### 6.1 Skill `spec-to-backlog` (generalized, English)

Installed identically to `.opencode/skill/spec-to-backlog/` and
`.claude/skills/spec-to-backlog/`; first line after frontmatter carries the
fingerprint comment `<!-- managed-by: super-backlog <version> -->`.

- **Triggers:** after an approved design doc / after `writing-plans` / when the
  user asks to split work into tasks.
- **Flow:** read `backlog instructions overview` + `task-creation` first →
  one plan unit = one task (`task create` with `-d`, multiple `--ac`, `--type`,
  `--label`, `--ref <plan-doc-path>`) → dependencies via `--dep`, larger efforts
  as milestones → **stop at the review gate** so the human can check specs
  (board / browser / dashboard) before any code exists.
- **Boundaries:** never hand-edit task markdown; set `--plan`/`--notes` only at
  task start (checkpoint #2), not at create time; no code, no worktrees, no
  status changes inside this skill.

### 6.2 Workflow block (AGENTS.md, ~50 lines, English, project-neutral)

1. **Roles:** Backlog.md = WHAT (specs, ACs, status, history — CLI only);
   Superpowers = HOW (methodology skills).
2. **Pipeline table:** idea → brainstorming → design gate → spec-to-backlog
   decomposition → review gate → plan-before-code → TDD implementation →
   verification & final summary → merge & archive.
3. **Binding rules:** no task, no code (trivial edits only on explicit user
   instruction); plan before code with human approval; status changes always
   via CLI with verification evidence, never from memory; matching skills take
   precedence over habit.
4. Project-specific human gates are intentionally out of scope — users add
   them below the block.

### 6.3 Guard hook (`--guard`, opt-in)

POSIX-sh pre-commit hook (runs under Git for Windows' bundled sh) that
validates staged changes under `backlog/**` structurally: frontmatter parses,
task ID matches filename, title non-empty. Rejects accidental/faulty hand
edits at commit time without interfering with the backlog CLI. OS-level
read-only attributes were evaluated and rejected: the CLI and manual editors
share the same user identity, so read-only flags would break `backlog` itself
and git checkout flows.

## 7. Error Handling Principles

- Detect-then-write; `--dry-run` prints the exact planned change set.
- All writes atomic (temp file + rename).
- Distinct exit codes: detection failure / merge conflict / upstream command
  failure / success-with-warnings (e.g., Claude CLI absent → printed
  instructions instead).
- Never modify files we cannot attribute ownership to.

## 8. Testing Strategy (TDD)

- **Unit:** marker merge (idempotency, byte-exactness outside block), script
  merge, PM detection, fingerprint recognition, frontmatter validation.
- **E2E (temp dirs):** init into empty dir and into fixture projects → assert
  manifest; uninstall → assert clean removal; idempotent re-run; guard hook
  accepts CLI-shaped change, rejects corrupted hand edit.
- **Dashboard:** snapshot test from fixture JSON.
- CI matrix (windows-latest, ubuntu-latest) — v2 backlog.

## 9. Repository Layout

```text
super-backlog/
├─ src/
│  ├─ commands/        # init · uninstall · update · dashboard
│  ├─ lib/             # pm-detect, marker-merge, atomic-write, hooks
│  └─ templates/       # workflow-block, SKILL.md, dashboard, guard-hook
├─ docs/               # architecture, guard, harness matrix (depth on demand)
├─ docs/superpowers/specs/
├─ backlog/            # our own tasks (dogfooding)
├─ test/               # unit + e2e (vitest)
├─ package.json        # bin: sbl, super-backlog; engines: node >=20
└─ AGENTS.md / opencode.json   # carrying our own marker block
```

## 10. Documentation & UX

README (English, short): what/why incl. niche statement, 30-second quickstart,
"what gets installed" table, dashboard screenshot, prominent uninstall
guarantee, troubleshooting (Windows plugin spec). Depth lives in `docs/`.
MIT LICENSE, CHANGELOG, CONTRIBUTING. German README section later (D3).

## 11. Dogfooding Loop

1. Build the kit in this repo according to this spec.
2. First act after v0: run `sbl init` on super-backlog itself, replacing the
   current hand-made configuration.
3. From then on, all further development runs through the kit's own pipeline
   (brainstorming → spec-to-backlog → tasks → TDD), visible in the own
   dashboard.
4. Learnings flow back into templates — the iteration engine requested by the
   project owner.

## 12. Roadmap (recorded in our backlog, not v1)

`sbl doctor` (env/plugin/integrity checks incl. Windows fallback automation) ·
additional skills (`backlog-status-report`, task-review-gate) · terminal
`status` summary · German docs · CI matrix · further harnesses (Cursor, Codex,
Gemini CLI).

## 13. Risks

| Risk | Mitigation |
|---|---|
| Windows OpenCode cache issue with git-backed plugin specs | Canonical spec + README fallback; automated healing in v2 doctor |
| `claude` CLI not scriptable everywhere | File-based skills always work; marketplace commands printed verbatim |
| Upstream breaking changes (both tools pre-1.0 culture) | Glue-only architecture limits blast radius; smoke test against upstream releases in CI (v2) |
| Guard hook false positives on valid CLI output | Structural checks kept minimal; `--no-verify` escape hatch documented |
