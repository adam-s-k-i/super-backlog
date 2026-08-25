# Harness support

super-backlog v1 supports two agent harnesses (design decision D1): **OpenCode** and **Claude Code**. `sbl init` targets both by default; use `--harness opencode` or `--harness claude` to restrict.

## OpenCode — native

- `opencode.json` gets a merged plugin entry: `"plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]`. Existing keys and other plugin entries are untouched; the entry is only added if the exact kit spec string is absent.
- The glue skill is installed as a file at `.opencode/skill/spec-to-backlog/SKILL.md`.

## Claude Code — file-based skills + marketplace

- The same glue skill is installed file-based at `.claude/skills/spec-to-backlog/SKILL.md` — this always works, with or without CLI scripting support.
- A one-line pointer section is written to `CLAUDE.md` referencing the managed block in `AGENTS.md`.
- Marketplace installation: init does not run `claude` commands. After writing skills, it prints the exact command to paste inside Claude Code: `/plugin install superpowers@claude-plugins-official`. Because this step must be run manually, init pushes a warning (`claude plugin install must be run manually`) and finishes as success-with-warnings (exit code 4). File-based skills work immediately either way.

## What is file-based vs. delegated

| Artifact | Mechanism | Managed how |
|---|---|---|
| `.opencode/skill/spec-to-backlog/` | file-based, written by init | fingerprint header line |
| `.claude/skills/spec-to-backlog/` | file-based, written by init | fingerprint header line |
| `opencode.json` plugin entry | file-based merge into your config | byte-equality of entry |
| Superpowers runtime for OpenCode | delegated to OpenCode's plugin loader via the git-backed spec string | canonical spec string only |
| Superpowers marketplace install for Claude Code | instructed (manual one-time step) | init prints the exact command; never executed automatically |
| `AGENTS.md` workflow block | file-based injection | start/end markers |
| `CLAUDE.md` pointer | file-based append | recognized heading |

The manifest is designed so later harnesses (Cursor, Codex, Gemini CLI — v2 backlog) can be added without changing the ownership model.
