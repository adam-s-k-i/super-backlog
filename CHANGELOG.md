# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-08-26

First release of the core kit (v1 MVP scope).

### Added

- `sbl init` — one-command installation into any project: `backlog.md@latest` + `super-backlog@latest` devDependencies, upstream `backlog init --defaults`, OpenCode plugin entry, Claude marketplace setup (automatic or printed instructions), marker-scoped workflow block in `AGENTS.md`, `CLAUDE.md` pointer, file-based `spec-to-backlog` skill for both harnesses, merged npm scripts (`tasks`, `board`, `browser`, `dashboard`), first Project Dashboard generation; flags `--pm`, `--harness`, `--guard`, `--no-dashboard`, `--dry-run`; idempotent re-runs.
- `sbl uninstall` — ownership-proven removal with a removed/kept/skipped report; Backlog task data preserved unless `--with-backlog`.
- `sbl update` — refreshes injected glue files to the installed kit version and compares installed vs. published upstream versions.
- `sbl dashboard` — generates the single-file Project Dashboard (`dashboard.html`) from Backlog data; `--serve` live mode on port 6428, `--port`, `--no-open`, `--out`.
- Optional integrity guard hook (`--guard`): structural pre-commit validation of staged task files.
- Exit code contract 0–4 and test seams `SBL_SKIP_INSTALL=1` / `SBL_FORCE_OFFLINE=1`.
- Documentation set: architecture, harness support, guard hook, troubleshooting guides.

[0.1.0]: https://github.com/adam-s-k-i/super-backlog/releases/tag/v0.1.0
