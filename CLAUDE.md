## Workflow system (managed by super-backlog)

This project uses the combined Backlog.md + Superpowers workflow. Read the
integration block in AGENTS.md (section between SUPER-BACKLOG markers) and follow
it. Tasks are managed exclusively through the `backlog` CLI.

## Model routing for subagents (binding, always applies)

Regardless of the current session model: delegate less demanding work to a
subagent on a cheaper model instead of using Fable, and always pass the model
explicitly (Agent tool `model`). Sonnet for routine/mechanical work (searches,
tests, lint, docs, Backlog CLI bookkeeping, fully specified plan steps); Opus
for moderately complex work (judgement-heavy implementation, per-task reviews,
debugging with a clear repro); Fable only for brainstorming/design, specs and
plans, final branch reviews, and hard problems a cheaper model could not
solve. When unsure, start cheaper and escalate. Full rule: "Model routing for
subagents" in AGENTS.md.
