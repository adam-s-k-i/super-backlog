---
id: TASK-66
title: 'Pipeline phase: sbl phase command with validated transitions'
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-30 13:15'
updated_date: '2026-08-30 15:38'
labels:
  - feature
  - cli
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
- [x] #1 sbl phase <id> prints current phase or none; --json prints id, phase, phase labels
- [x] #2 sbl phase <id> <spec|plan|impl|verify|done> applies the transition plan in one backlog task edit call; other labels stay untouched
- [x] #3 Exit codes: 1 for usage/unknown target/no-phase/multiple-phases (hint points to sbl doctor)/unreadable JSON/missing backlog CLI; 3 for upstream edit failure
- [x] #4 Command registered in src/cli.ts with HELP entry; unit tests with injected run/resolveBacklog deps pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Failing tests test/unit/phase-command.test.ts per plan Task 2. 2. Implement src/commands/phase.ts (runPhase with injected deps). 3. Register phase case in src/cli.ts + HELP entry. 4. cli-contract/command-smoke suites green. 5. Finalize with evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: unit tests 12/12 with injected run/resolveBacklog deps (RED verified first); cli-contract + command-smoke green (26 tests); full suite 62 files / 516 passed. Behavior note: unknown targets are rejected before any CLI call (fail-fast) - plan test expectation corrected accordingly.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added sbl phase command (query/transition modes, --json, exit codes 1/3) wired into runCli + HELP; verified by 12 command unit tests and the green full suite.
<!-- SECTION:FINAL_SUMMARY:END -->
