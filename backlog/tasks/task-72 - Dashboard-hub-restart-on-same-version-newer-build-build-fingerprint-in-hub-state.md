---
id: TASK-72
title: >-
  Dashboard hub: restart on same-version newer build (build fingerprint in hub
  state)
status: To Do
assignee: []
created_date: '2026-08-30 14:00'
labels:
  - bug
  - dashboard
  - cli
  - phase/spec
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
- [ ] #1 Hub state records a build fingerprint of the running dashboard build alongside the kit version
- [ ] #2 sbl dashboard attach restarts a running hub when the fingerprint differs, even when KIT_VERSION is equal
- [ ] #3 Equal version and equal fingerprint never restart (no restart loop)
- [ ] #4 Unit tests cover same-version-different-build restart and no-restart on identical fingerprint
<!-- AC:END -->
