---
id: TASK-66
title: 'Pipeline phase: sbl phase command with validated transitions'
status: To Do
assignee: []
created_date: '2026-08-30 13:15'
labels:
  - feature
  - cli
  - phase/spec
dependencies:
  - TASK-65
references:
  - docs/superpowers/plans/2026-08-30-pipeline-phase.md
type: feature
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Thin CLI command over the phase library: query mode prints the current phase or none (with --json), transition mode swaps exactly one phase label via backlog task edit (--remove-label/--add-label), done removes it. Implements plan Task 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 sbl phase <id> prints current phase or none; --json prints id, phase, phase labels
- [ ] #2 sbl phase <id> <spec|plan|impl|verify|done> applies the transition plan in one backlog task edit call; other labels stay untouched
- [ ] #3 Exit codes: 1 for usage/unknown target/no-phase/multiple-phases (hint points to sbl doctor)/unreadable JSON/missing backlog CLI; 3 for upstream edit failure
- [ ] #4 Command registered in src/cli.ts with HELP entry; unit tests with injected run/resolveBacklog deps pass
<!-- AC:END -->
