---
id: TASK-83
title: Keep the file's line endings when writing the managed block and pointer
status: Done
assignee: []
created_date: '2026-10-09 18:27'
updated_date: '2026-10-09 20:58'
labels:
  - bug
dependencies: []
references:
  - docs/superpowers/plans/2026-10-09-crlf-managed-writes.md
type: bug
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the final review of feat/subagent-model-routing. injectBlock/stripOwned in src/lib/markers.ts and the create branch of refreshPointer in src/lib/pointer.ts write LF into CRLF files, so AGENTS.md gets mixed endings and every update after a fresh Windows checkout reports the block as changed. A shared detectEol helper makes all managed writes use the file's line ending.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 injectBlock writes the block with CRLF into a file that contains CRLF and keeps LF output byte-identical for LF or empty files
- [x] #2 An LF block inside a CRLF file is replaced once and reported unchanged on the next run
- [x] #3 stripOwned removes the block from a CRLF file without leaving a stray blank line
- [x] #4 refreshPointer appends the pointer with CRLF into a CRLF CLAUDE.md
- [x] #5 e2e: sbl update on an aged CRLF project leaves no lone LF in AGENTS.md or CLAUDE.md and a second run is byte-identical
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
See docs/superpowers/plans/2026-10-09-crlf-managed-writes.md (Task 1)
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Managed writes now keep the file's line ending: shared detectEol helper (src/lib/eol.ts) used by injectBlock/stripOwned and the refreshPointer create branch; LF/empty output stays byte-identical. Legacy lone LFs around the block and above the pointer separator are healed (commits f6f6b48, 1aad893, e058032). Verified by unit tests, an aged-CRLF e2e (no lone LF in AGENTS.md/CLAUDE.md, second run byte-identical), tsc clean, npm test 591 passed/4 skipped, lint clean, and task/scoped/final reviews (Ready to merge: Yes).
<!-- SECTION:FINAL_SUMMARY:END -->
