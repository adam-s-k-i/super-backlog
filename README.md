<div align="center">

<img src="docs/assets/super-backlog-logo.jpg" alt="Super Backlog" width="100%">

# super-backlog

[![CI](https://github.com/adam-s-k-i/super-backlog/actions/workflows/ci.yml/badge.svg)](https://github.com/adam-s-k-i/super-backlog/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/super-backlog)](https://www.npmjs.com/package/super-backlog)
[![Docs](https://img.shields.io/badge/docs-adam--s--k--i.github.io%2Fsuper--backlog-blue)](https://adam-s-k-i.github.io/super-backlog/)

**Supercharge your backlog. Watch it live.**

One command to equip any project with [Backlog.md](https://github.com/MrLesk/Backlog.md) + [Superpowers](https://github.com/obra/superpowers), plus a live Project Dashboard.

</div>

---

## Start in 3 commands

```bash
# 1 · install (Windows: irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.ps1 | iex)
curl -fsSL https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.sh | bash

# 2 · wire your project (Backlog.md, skills, npm scripts, hooks)
sbl init

# 3 · open the live Project Dashboard
sbl dashboard
```

That's it. Everything else below is detail.

---

## Command cheat sheet

| Command | What it does |
| --- | --- |
| `sbl init` | Wire Backlog.md, Superpowers skills, npm scripts, and hooks into the current project. |
| `sbl dashboard` | Live Project Dashboard on `http://localhost:6428` (alias: `sbl db`). |
| `sbl phase TASK-1` | Show where a task stands: `phase/spec → plan → impl → verify`. |
| `sbl phase TASK-1 plan` | Advance the phase after its gate is passed (`done` clears the label). |
| `sbl doctor` | Check Node, PowerShell policy, the `backlog` CLI, and phase-label hygiene. |
| `sbl update` | Self-update the CLI, then refresh every injected file. |
| `sbl models enable` | Optional model router: cheap models for simple agents, your main model for hard work. |
| `sbl uninstall` | Remove everything super-backlog owns — your `backlog/` data stays. |

Full reference with flags and parameters: [Quick start guide](https://adam-s-k-i.github.io/super-backlog/guide/quickstart).

---

## Why

Superpowers defines *how* agents work (brainstorm → plan → TDD → review), Backlog.md defines *what* is tracked (markdown tasks, kanban board). Nothing wired them together — super-backlog is the glue: one `sbl init` installs and maintains everything, with a guaranteed-clean exit (`sbl uninstall`).

Tasks carry their pipeline phase as a label (`phase/spec → plan → impl → verify`), so every session resumes exactly where work stopped, the dashboard shows live phase counts, and `sbl doctor` guards the convention.

## What gets installed

| Target | Content |
| --- | --- |
| `backlog/` | Your Backlog.md data (created by `backlog init --defaults`) |
| `AGENTS.md` / `CLAUDE.md` | Workflow block with pipeline, gates, and phase rules |
| `.opencode/skill/` + `.claude/skills/` | Glue skills: `spec-to-backlog`, `task-review-gate`, `backlog-status-report` |
| `opencode.json` | Superpowers plugin entry |
| `package.json` scripts | `tasks`, `board`, `browser`, `dashboard` |
| `.git/hooks/pre-commit` | Integrity guard — opt-in via `--guard` |

`init` is idempotent — re-run any time to upgrade injected files.

## Project Dashboard

```bash
sbl dashboard
```

A live cockpit rendered from your backlog data: status KPIs, milestones, phase pipeline with live counts, drafts, tasks table (sortable, filterable), 26-week activity heatmap, decisions & docs. Watches `backlog/`, reloads connected tabs automatically, runs on port `6428`.

![Project Dashboard](docs/assets/dashboard.png)

## Requirements

- Node >= 20 and a package manager (npm, pnpm, or bun)
- Works with **OpenCode** and **Claude Code**

## Model router (opt-in)

`sbl init --models` routes simple agents to cheaper tiers while keeping your main model for complex work. Toggle with `sbl models enable|disable`, inspect with `sbl models show`, discover tiers with `sbl models discover`. [Design doc](docs/superpowers/specs/2026-08-26-sbl-model-router-design.md).

## Uninstall guarantee

`sbl uninstall` removes only provably owned artifacts, reports every decision line by line, and keeps your task data unless you pass `--with-backlog`.

## Docs & troubleshooting

Full documentation lives on [GitHub Pages](https://adam-s-k-i.github.io/super-backlog/) — quickstart, architecture, pipeline phases, harness support, guard hook, operations. Architecture deep-dive: [docs/guide/architecture.md](docs/guide/architecture.md).

## Development

```bash
npm ci          # install dependencies
npm test        # build + vitest suite
npm run lint    # markdownlint + cspell over all Markdown
```

## License

[MIT](LICENSE)
