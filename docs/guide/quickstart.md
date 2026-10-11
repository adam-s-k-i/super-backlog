---
type: tutorial
---

# Quick start

Get super-backlog installed and running in a few commands.

## Install

Use the official installer for your platform. Both check Node.js and npm, install super-backlog, and run `sbl init` without relying on `npx`.

**Windows (PowerShell)** — works even when `npx` is blocked by Execution Policy:

```powershell
irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.ps1 | iex
```

**macOS / Linux**:

```bash
curl -fsSL https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.sh | bash
```

If you already have Node and npm and prefer a manual install, run `sbl init` directly without `npx`:

```bash
# Global install
npm install -g super-backlog
sbl init
sbl init --models

# Local install
npm install super-backlog
node ./node_modules/super-backlog/dist/bin.js init
```

`init` is idempotent — run it again any time to upgrade injected files to the latest kit version.

Add `--models` to also enable the optional [model router](#model-router-opt-in).

Every initialized project also gets a binding delegation rule in its `AGENTS.md` block: every subtask goes to the cheapest of four model tiers that solves it reliably, and the project's `backlog/docs/critical-areas.md` names what always stays on the top tier. After a real init, `sbl` prints a next step to ask your agent for that profile (and for the summary page's `architecture.yml`) while the files are missing. This rule is independent of the opt-in router.

## Daily commands

| Command | What it does |
| --- | --- |
| `sbl init` | Wire Backlog.md, Superpowers skills, npm scripts, and hooks into the current project. |
| `sbl init --models` | Same as above, plus the optional model router. |
| `npm run board` | Open the Backlog.md kanban board. |
| `npm run tasks` | List Backlog tasks in the terminal. |
| `npm run browser` | Open the Backlog browser UI. |
| `npm run dashboard` | Start the live Project Dashboard server on `http://localhost:6428`. |
| `sbl dashboard --port 8080` | Start the dashboard server on a custom port. |
| `sbl phase TASK-1` | Show where the task stands in the pipeline (`phase/spec` → `plan` → `impl` → `verify`). |
| `sbl phase TASK-1 plan` | Advance the phase after the gate is passed (`done` clears the label). |
| `sbl update` | First self-updates a globally installed CLI to the latest npm version and re-runs itself (opt out with `--no-self` or `SBL_SKIP_UPDATE_CHECK`), then refreshes all injected files and prints harness/plugin versions. |
| `sbl doctor` | Check Node, PowerShell policy, the `backlog` CLI, phase-label hygiene, the summary page's `architecture.yml`, and the `critical-areas.md` project profile. |
| `sbl summary` | Check the summary page's `architecture.yml` for drift and print the prompt that refreshes it; `--check` for CI. |
| `sbl uninstall` | Remove everything super-backlog owns; keep your `backlog/` data. |
| `sbl uninstall --with-backlog` | Remove everything, including task data. |

## Model router (opt-in)

The model router writes one subagent per tier (`sbl-light`, `sbl-standard`, `sbl-strong`, `sbl-top`) for Claude Code and OpenCode, each with a fixed model from `.super-backlog/models.json`.

| Command | What it does |
| --- | --- |
| `sbl init --models` | Install the router and enable it. |
| `sbl models enable` | Turn the router on and install its agents. |
| `sbl models disable` | Turn the router off; the agents fall back to the session model. |
| `sbl models show` | Print the router configuration. |
| `sbl models set <harness> <tier> <model>` | Set one tier (`-` removes it). |
| `sbl models discover` | Rank the available OpenCode models into the four tiers. |

`sbl update` keeps installed router files current and migrates a router v1 configuration. The dashboard's **Model Router** button shows the tiers and toggles the router. `sbl uninstall` removes every router file. Full reference: [Model router](model-router).

## Project dashboard

```bash
sbl dashboard
```

`sbl dashboard` (alias: `db`) starts a local server on port `6428` that serves a self-contained Project Dashboard rendered from your backlog data: board status, milestones, tasks, dependencies, activity, and decisions. The server watches `backlog/` and reloads connected browser tabs automatically. If a hub from an older or otherwise mismatched version of super-backlog is already running, the dashboard automatically stops it and restarts a fresh one.

Use `--port` to choose a different port and `--no-open` to prevent the browser from opening automatically:

```bash
sbl dashboard --port 8080 --no-open
```

There is no static `dashboard.html` written to your project.

Each project also gets a [project summary page](./project-summary) at `/p/<slug>/summary/`: architecture diagram, tech stack, commands and open work at a glance. While its `backlog/docs/architecture.yml` is missing, `sbl init` ends with a hint to ask your agent for the `architecture-summary` skill.

### Backlog button

The Board &amp; Quick Actions section has a single **Backlog** button. Clicking
it makes the dashboard hub start a `backlog browser` process for the current
project on a free local port (reused while it is alive, stopped when the hub
stops) and opens the full Backlog.md UI — board, tasks, documents, decisions —
in a near-fullscreen overlay. Under the hub the overlay runs same-origin: the
hub proxies the browser UI through `/p/<slug>/bb/`, and the dashboard theme
toggle also switches the embedded UI between light and dark. Use the overlay's
"open in new tab" link for a standalone browser tab. If the `backlog` CLI is
not installed, the button reports the failure and nothing is spawned.

### Task details

Clicking a task row opens a centered detail dialog: title and status up top
(the header stays visible while scrolling), metadata as a labelled grid with
priority colouring and the task's pipeline phase, the description in readable
paragraphs, acceptance criteria with a progress bar, dependency chips with
done-markers, and copyable `backlog task edit <id>` and `sbl phase <id> <next>`
commands to jump into editing or advance the phase. Descriptions
and acceptance criteria are read from the task markdown files, so the dialog
stays complete even where `backlog task list --json` omits them.

### Feature Cycle steps

The Feature Cycle section shows the nine workflow phases as a compact stepper —
step number and name only, with the human gates highlighted. Steps 5–8 carry a
live count of the tasks currently sitting in the matching pipeline phase
(`phase/spec` … `phase/verify`). Click a step to
open its detail panel: the gate description plus, for tool-driven phases, the
command that drives the phase (for example `/superpowers:brainstorming` for
Brainstorming) with a one-click copy button. Purely human steps such as Idea
and the Design gate carry no command.

### Version and update badge

The sidebar shows the installed super-backlog version. When the daily version
check has cached a newer release, an update badge appears next to it; clicking
the badge copies `npm i -g super-backlog` to your clipboard. The dashboard
never contacts the npm registry itself — the badge is fed entirely by the
cache under `~/.super-backlog/version-check.json`.

## Pipeline phases

Every task carries its pipeline phase as a label, so you and your agents always
know where work stands — no more reconstructing context at the start of a
session. Tasks created through the spec-to-backlog flow start at `phase/spec`
automatically; you advance phases only after the matching human gate:

```bash
sbl phase TASK-1          # where does this task stand?
sbl phase TASK-1 plan     # review gate passed -> advance to plan
sbl phase TASK-1 done     # archived -> clear the label
sbl doctor                # flags missing, duplicate, or unknown phase labels
```

The dashboard shows the live phase everywhere: counts on the Feature Cycle
stepper, chips in the tasks table, and a copyable advance command in the task
modal.

Full lifecycle and details: [Pipeline phases](./pipeline-phases).

## Harness support

- **OpenCode** — plugin entry + file-based skills under `.opencode/skill/`.
- **Claude Code** — file-based skills under `.claude/skills/` work immediately. `init` prints the marketplace plugin command to paste into Claude Code.

See [Harness support](./harness-support) for the full matrix.

## Windows PowerShell

If you prefer `npx` or a globally installed `sbl` command, PowerShell's Execution Policy may block `.ps1` shims. Use the installer above (`irm ... | iex`) to avoid this entirely. If you still want to use `npx`, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use `sbl doctor` for the exact policy and fix.

## Next steps

- Architecture deep-dive: [Architecture](./architecture)
- Operations and release chain: [Operations](./operations)
- Troubleshooting and exit codes: [Troubleshooting](./troubleshooting)
