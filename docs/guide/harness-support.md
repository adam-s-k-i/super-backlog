---
type: reference
---

# Harness support

super-backlog v1 supports two agent harnesses (design decision D1): **OpenCode** and **Claude Code**. `sbl init` targets both by default; use `--harness opencode` or `--harness claude` to restrict.

## OpenCode — native

- `opencode.json` gets a merged plugin entry: `"plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]`. Existing keys and other plugin entries are untouched; the entry is only added if the exact kit spec string is absent.
- The glue skills (spec-to-backlog, backlog-status-report, task-review-gate, architecture-summary, project-profile) are installed as files at `.opencode/skill/<skill>/SKILL.md`.

## Claude Code — file-based skills + marketplace

- The same glue skills are installed file-based at `.claude/skills/<skill>/SKILL.md` — this always works, with or without CLI scripting support.
- A short pointer section is written to `CLAUDE.md`. It references the managed block in `AGENTS.md`, its delegation rule and the project profile. `sbl init` and `sbl update` refresh this section whenever its text differs from the current kit version. Put your own CLAUDE.md content under its own heading, because text inside the pointer section is replaced.
- Marketplace installation: init does not run `claude` commands. After writing skills, it prints the exact command to paste inside Claude Code: `/plugin install superpowers@claude-plugins-official`. Because this step must be run manually, init pushes a warning (`claude plugin install must be run manually`) and finishes as success-with-warnings (exit code 4). File-based skills work immediately either way.

## Model tiers and delegation (all harnesses)

The managed `AGENTS.md` block carries a harness-neutral "Model tiers and delegation" section. Every subtask goes to the cheapest model that solves it reliably, picked from four tiers: **Light** (mechanical: searching, listing, extracting), **Standard** (clearly specified routine work: research, routine code, tests, docs), **Strong** (complex implementation, debugging, reviews) and **Top** (analysis, design, architecture, decisions where a mistake is costly, and everything the [project profile](project-profile) lists). When unsure, the agent takes the higher tier. The section also says when delegation pays off, how to brief a subagent (goal, context, limits, done criterion, return format), that returns stay brief, that a result that falls short goes one tier up instead of being retried, and that anything the profile lists under "Independent check" is verified by a second subagent on Strong or higher. Short examples name the per-harness setting: for Claude Code the Agent tool's `model` parameter (`haiku`, `sonnet`, `opus`, strongest available), for OpenCode the agent's `model` field.

The rule applies regardless of the session model and is always on. Projects that want different behavior add their own rule below the block. It is independent of the opt-in model router (`sbl models`).

## What is file-based vs. delegated

| Artifact | Mechanism | Managed how |
|---|---|---|
| `.opencode/skill/spec-to-backlog/` | file-based, written by init | fingerprint header line |
| `.claude/skills/spec-to-backlog/` | file-based, written by init | fingerprint header line |
| `opencode.json` plugin entry | file-based merge into your config | byte-equality of entry |
| Superpowers runtime for OpenCode | delegated to OpenCode's plugin loader via the git-backed spec string | canonical spec string only |
| Superpowers marketplace install for Claude Code | instructed (manual one-time step) | init prints the exact command; never executed automatically |
| `AGENTS.md` workflow block | file-based injection | start/end markers; written with the file's line endings |
| `CLAUDE.md` pointer | file-based append, refreshed in place | recognized heading; the section ends at the next heading; written with the file's line endings |

The manifest is designed so later harnesses (Cursor, Codex, Gemini CLI — v2 backlog) can be added without changing the ownership model.
