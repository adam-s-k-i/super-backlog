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
| `sbl update` | Refresh all injected files and print harness/plugin versions. |
| `sbl doctor` | Check Node, PowerShell policy, and the `backlog` CLI. |
| `sbl uninstall` | Remove everything super-backlog owns; keep your `backlog/` data. |
| `sbl uninstall --with-backlog` | Remove everything, including task data. |

## Model router (opt-in)

The model router routes cheap models to simple agents and keeps your main model for complex work.

| Command | What it does |
| --- | --- |
| `sbl init --models` | Install the router and harness adapters. |
| `sbl models enable` | Turn routing on. |
| `sbl models disable` | Turn routing off. |
| `sbl models show` | Show the current router config. |
| `sbl models discover` | Discover available OpenCode models and rank them into tiers. |

When enabled:

- **OpenCode** uses a `chat.params` plugin to rewrite the model for `sbl-worker` (workhorse) and `sbl-worker-cheap` / `explore` (budget) agents.
- **Claude Code** uses a `SessionStart` hook to update agent `model:` placeholders based on your current main model.
- The dashboard server exposes `/api/models` and `/api/models/discover` for inspection.

The router is removed cleanly by `sbl uninstall`.

## Project dashboard

```bash
sbl dashboard
```

Starts a local server on port `6428` that serves a self-contained Project Dashboard rendered from your backlog data: board status, milestones, tasks, dependencies, activity, and decisions. The server watches `backlog/` and reloads connected browser tabs automatically.

Use `--port` to choose a different port and `--no-open` to prevent the browser from opening automatically:

```bash
sbl dashboard --port 8080 --no-open
```

There is no static `dashboard.html` written to your project.

### Backlog button

The Board &amp; Quick Actions section has a single **Backlog** button. Clicking
it makes the dashboard hub start a `backlog browser` process for the current
project on a free local port (reused while it is alive, stopped when the hub
stops) and opens the full Backlog.md UI — board, tasks, documents, decisions —
in a near-fullscreen overlay. Use the overlay's "open in new tab" link for a
standalone browser tab. If the `backlog` CLI is not installed, the button
reports the failure and nothing is spawned.

### Feature Cycle steps

The Feature Cycle section shows the nine workflow phases as a compact stepper —
step number and name only, with the human gates highlighted. Click a step to
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
