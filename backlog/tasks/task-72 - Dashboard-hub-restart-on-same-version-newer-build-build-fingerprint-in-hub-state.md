---
id: TASK-72
title: >-
  Dashboard hub: restart on same-version newer build (build fingerprint in hub
  state)
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-30 14:00'
updated_date: '2026-08-30 15:56'
labels:
  - bug
  - dashboard
  - cli
dependencies: []
references:
  - docs/superpowers/plans/2026-08-30-pipeline-phase.md
type: bug
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found during TASK-71 acceptance testing: a running hub keeps serving its own old dashboard template after a local rebuild, because outdated-hub detection compares only KIT_VERSION - old and new build share the same version (1.3.1), so the hub never restarts and new dashboard features stay invisible until the old process is killed manually. Fix: record a build fingerprint (e.g. hash or timestamp of the built dashboard files) in the hub state alongside the kit version, and let sbl dashboard attach restart hubs whose fingerprint differs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hub state records a build fingerprint of the running dashboard build alongside the kit version
- [x] #2 sbl dashboard attach restarts a running hub when the fingerprint differs, even when KIT_VERSION is equal
- [x] #3 Equal version and equal fingerprint never restart (no restart loop)
- [x] #4 Unit tests cover same-version-different-build restart and no-restart on identical fingerprint
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research hub.ts attach/restart + hub-state.ts shape. 2. Failing tests: fingerprint stability + same-version-different-build restart + no-restart on equality. 3. Implement build fingerprint (hash of built dashboard files) in hub state + attach comparison. 4. Suite + lint green. 5. Finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: 4-layer TDD (fingerprint lib stable/change tests, hub-state roundtrip, dashboard-command same-version-mismatch/no-fingerprint/fallback cases, hub status contract). Full suite 64 files / 541 passed; lint OK. Live verify: hub1 fingerprint reported; modified dist + same version -> auto-restart with new pid/fingerprint; third attach with identical build did NOT restart (no loop).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hub state and /api/hub/status now carry a build fingerprint (sha256 over dist, 16 hex); sbl dashboard attach restarts same-version hubs whose fingerprint differs or is missing (older CLI), with version-only fallback when the local fingerprint is unavailable; verified by unit tests, full suite, and a live three-attach probe.
<!-- SECTION:FINAL_SUMMARY:END -->
