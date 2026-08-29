# super-backlog

[![CI](https://github.com/adam-s-k-i/super-backlog/actions/workflows/ci.yml/badge.svg)](https://github.com/adam-s-k-i/super-backlog/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-adam--s--k--i.github.io%2Fsuper--backlog-blue)](https://adam-s-k-i.github.io/super-backlog/)

![Super Backlog](docs/assets/super-backlog-logo.jpg)

One command to equip any project with [Backlog.md](https://github.com/MrLesk/Backlog.md) + [Superpowers](https://github.com/obra/superpowers), plus a Project Dashboard.

## What & why

Superpowers and Backlog.md are strong on their own, but nothing wires them together: Superpowers defines *how* agents should work (brainstorming → plans → TDD → review), Backlog.md defines *what* is tracked (markdown tasks, Kanban board, browser UI). Connecting them today means hand-copying glue from project to project — workflow blocks in `AGENTS.md`, bridge skills like `spec-to-backlog`, npm scripts, plugin config. super-backlog is the glue orchestrator that installs and maintains all of it in one step, with a guaranteed-clean exit path (`sbl uninstall`).

## Requirements

- Node >= 20
- A package manager (npm, pnpm, or bun) for dependency installation
- Works with **OpenCode** and **Claude Code** (both configured by default)

## Quickstart

Install super-backlog into the current project with the official installer for your platform:

**Windows (PowerShell)** — bypasses Execution Policy automatically:

```powershell
irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.ps1 | iex
```

**macOS / Linux**:

```bash
curl -fsSL https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.sh | bash
```

Both installers check Node.js and npm, install `super-backlog`, and run `sbl init` without using `npx`, so they work even when `npx` is blocked by PowerShell's Execution Policy.

**Already have Node and npm?** You can also install manually without `npx`:

```bash
# Global install
npm install -g super-backlog
sbl init
sbl init --models

# Local install
npm install super-backlog
node ./node_modules/super-backlog/dist/cli.js init
```

After installation:

```bash
npm run board                   # open the Backlog.md kanban board
sbl dashboard                   # live Project Dashboard on http://localhost:6428
```

`init` is idempotent — safe to re-run any time; re-running with a newer kit version is the upgrade path for all injected files.

## What gets installed

| Target | Content | Ownership model |
|---|---|---|
| `package.json` devDependencies | `backlog.md@latest` + `super-backlog@latest` | merged |
| `backlog/` | created by `backlog init --defaults` (upstream owns it) | delegated |
| `opencode.json` | `plugin[] += superpowers@git+https://github.com/obra/superpowers.git` | merged; other keys untouched |
| `.claude/` | Superpowers via official marketplace — init prints the exact command to paste (`/plugin install superpowers@claude-plugins-official`); file-based skills work immediately | instructed/delegated |
| `AGENTS.md` | `<!-- SUPER-BACKLOG:x.y.z START -->` … `<!-- SUPER-BACKLOG END -->` workflow block | marker-scoped |
| `CLAUDE.md` | one-line pointer to the AGENTS.md block | marker-scoped |
| `.opencode/skill/<skill>/SKILL.md` (3 glue skills) | skill templates | fingerprint header line |
| `.claude/skills/<skill>/SKILL.md` | same templates | fingerprint header line |
| `package.json` scripts | `tasks` → `backlog task list`, `board` → `backlog board`, `browser` → `backlog browser`, `dashboard` → `super-backlog dashboard` (never overwrite existing values) | merged, add-only-if-absent |
| `dashboard.html` | generated Project Dashboard | not installed in user projects; generated on demand by `sbl dashboard` |
| `.git/hooks/pre-commit` | integrity guard hook — only with `--guard` (opt-in) | appended marker block |

Commands: `sbl init` · `sbl models` · `sbl doctor` · `sbl uninstall [--with-backlog]` · `sbl update` · `sbl dashboard [--port <n>] [--no-open]`. See `sbl help` for every flag.

## Model router (opt-in)

`sbl init --models` adds an optional model router that routes simple work to cheaper model tiers while keeping your main model for complex tasks.

```bash
sbl init --models              # install router + harness adapters
sbl models enable              # turn routing on
sbl models disable             # turn routing off
sbl models show                # inspect current config
sbl models discover            # discover available OpenCode models
```

When enabled:

- **OpenCode** — the plugin `sbl-model-router.js` rewrites `chat.params` for the `sbl-worker` (workhorse) and `sbl-worker-cheap` / `explore` (budget) agents.
- **Claude Code** — agent files carry a `model:` placeholder that is updated by a `SessionStart` hook based on your current main model.
- **Dashboard** — `sbl dashboard` exposes `/api/models` and `/api/models/discover`.

The router is fully owned by super-backlog and removed by `sbl uninstall`. See the [model router design](docs/superpowers/specs/2026-08-26-sbl-model-router-design.md) for details.

## Project Dashboard

`sbl dashboard` starts a local hub that serves a dark, HTS-style cockpit rendered from your Backlog data in seven sections — Board & Quick Actions, Status (donut), Milestones, Tasks (sortable/filterable table; click a row to open a modal detail view with acceptance criteria and dependencies), Feature Cycle (pipeline stepper plus an Up Next / Blocked flow view from task dependencies), Activity (30-day sparkline), and Decisions & Docs. Glossary tooltips explain domain terms inline; extend or override them project-wide via `backlog/docs/glossary.md` (`## Term` heading plus the text below it). No CDNs, no external fonts — works offline when served locally. Bookmark `http://127.0.0.1:6428/p/<project_name>/`. The hub watches `backlog/`, regenerates on change, and serves on port `6428`; connected browser tabs reload automatically via Server-Sent Events. A second repo's `sbl dashboard` attaches to the same hub. `Ctrl+C` in the hub terminal stops all projects.

### Keeping it fresh

Run `sbl dashboard` whenever you want a live view of the board. The hub regenerates the dashboard while it runs; stop it with `Ctrl+C` in the hub terminal. There is no static `dashboard.html` installed in your project.

![Project Dashboard](docs/assets/dashboard.png)

## Uninstall guarantee

super-backlog uninstall removes only provably owned artifacts and keeps your Backlog task data unless you pass --with-backlog. Every removal decision is reported line by line as removed / kept / skipped; files whose ownership cannot be proven are left untouched.

## Harness support

- **OpenCode** — native: `opencode.json` plugin entry plus file-based skills under `.opencode/skill/` (spec-to-backlog, backlog-status-report, task-review-gate).
- **Claude Code** — file-based skills under `.claude/skills/` always work immediately; the marketplace plugin cannot be installed from a script, so init prints the exact command to paste (`/plugin install superpowers@claude-plugins-official`) and exits with a warning (exit code 4).

Details and matrix: [docs/guide/harness-support.md](docs/guide/harness-support.md).

## Troubleshooting

Windows OpenCode fallback, exit codes, and environment seams: [docs/guide/troubleshooting.md](docs/guide/troubleshooting.md). Architecture deep-dive: [docs/guide/architecture.md](docs/guide/architecture.md). Guard hook details: [docs/guide/guard.md](docs/guide/guard.md).

## Development

```bash
npm ci          # install dependencies
npm test        # build + vitest suite
npm run lint    # markdownlint + cspell over all Markdown
```

## License

[MIT](LICENSE)
