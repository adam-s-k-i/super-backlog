# Architecture

super-backlog is a Node >= 20 CLI (TypeScript, ESM, zero runtime dependencies) that equips projects with Backlog.md + Superpowers. This document explains the three ideas it is built on: the glue-orchestrator role, the planner/executor change flow, and the ownership model that makes uninstall safe.

## Glue orchestrator, not a fork

Decision D6 in the [design spec](../superpowers/specs/2026-08-25-super-backlog-kit-design.md): super-backlog delegates to upstream tools and owns only the glue between them.

- Backlog.md is installed as a devDependency at `latest` and driven through its own CLI (`backlog init --defaults`, `backlog task list --json`). super-backlog never forks or vendors upstream code and pins nothing — every init pulls current versions.
- Superpowers reaches the project through its canonical channels (OpenCode plugin spec, Claude marketplace) rather than copies of its content.
- The kit itself only authors the connective tissue: the workflow block in `AGENTS.md`, the `spec-to-backlog` skill, npm scripts, the plugin config entry, the guard hook, and the Project Dashboard.

Rejected alternatives: vendoring/forking both upstreams (unmaintainable, loses upstream fixes) and a template/starter repo (splits new vs. existing projects into divergent paths).

## ChangeSet planner/executor

`init` follows detect → plan → execute:

1. **Detect** (`src/commands/init.ts`) reads the current state before writing anything: package manager via lockfile, presence of `backlog/config.yml`, `AGENTS.md`, `CLAUDE.md`, `opencode.json`, `.claude/`, `package.json`.
2. **Plan** (`src/init/planner.ts`) turns state + options into a declarative list of actions (`Action[]`) plus warnings. Actions are data, not effects: `upstream-install`, `merge-json` (opencode.json plugin entry; package.json scripts/devDeps), `inject-agents-block`, `write-claude-pointer`, `copy-skills`, `install-guard-hook`, `generate-dashboard`. Planning is pure and unit-tested without touching the filesystem.
3. **Execute** (`src/init/execute.ts`) applies each action with all writes atomic (temp file + rename). It returns counts of applied/skipped plus warnings; degraded situations (e.g., no package manager detected, missing dashboard module) become warnings and exit code 4 instead of crashes.

`--dry-run` runs steps 1–2 and prints the exact planned change set without executing.

## Ownership model

Uninstall can be trusted because every artifact carries proof of who wrote it:

| Mechanism | Applies to | Rule |
|---|---|---|
| Markers | `AGENTS.md` block | byte-exact start `<!-- SUPER-BACKLOG:<version> START -->` / end `<!-- SUPER-BACKLOG END -->`; everything outside stays untouched |
| Fingerprint line | skill files | first line after frontmatter matches `<!-- managed-by: super-backlog <version> -->`; files without it are kept |
| Byte equality | npm scripts, opencode.json plugin entry | removed only when the value equals the kit's exact default; differing values are kept and reported |
| Wholesale regeneration | `dashboard.html` | generated artifact, safe to delete/regenerate |
| Appended marker block | `.git/hooks/pre-commit` | only the guarded block is removed |

The governing principle: never modify files we cannot attribute ownership to. Anything ambiguous is reported as `kept` or `skipped`, never silently changed.
