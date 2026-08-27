---
id: TASK-40
title: Unify kit commands under sbl aliases
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 19:13'
updated_date: '2026-08-27 21:09'
labels:
  - cli
dependencies: []
type: feature
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
All end-user commands of the super-backlog kit should start with sbl. Add sbl browser and sbl board subcommands that delegate to the local backlog CLI binary, matching the behavior of backlog browser and backlog board. Update the CLI help text accordingly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sbl browser launches backlog browser
- [x] #2 sbl board launches backlog board
- [x] #3 Help text lists the new subcommands
- [x] #4 Delegation reuses the same backlog binary resolution logic as the dashboard
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Import resolveBacklogBin into src/cli.ts.\n2. Add 'browser' and 'board' cases to the CLI switch that delegate to the resolved backlog binary.\n3. Spawn the backlog binary with the matching subcommand, inheriting stdio and forwarding exit code.\n4. Update HELP text to list browser and board subcommands.\n5. Add unit tests in test/unit/cli.test.ts (or similar) verifying delegation and exit code forwarding.\n6. Run npm test, build, lint, and manual verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: added src/commands/backlog-alias.ts with runBacklogSubcommand() that resolves the local backlog binary and spawns backlog browser or backlog board, forwarding stdio and exit code. Wired sbl browser and sbl board cases in src/cli.ts and updated HELP. Added unit tests in test/unit/backlog-alias.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added sbl browser and sbl board subcommands that delegate to the resolved local backlog binary, forwarding arguments, stdio, and exit code. Updated HELP to list the new commands. Verified with npm test (335 passed), build, lint, and manual runs of 'sbl board --help' and 'sbl browser --help' showing backlog's help output.
<!-- SECTION:FINAL_SUMMARY:END -->
