---
id: TASK-33
title: 'init: scaffold minimal package.json when absent'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 15:08'
updated_date: '2026-08-27 15:21'
labels:
  - feature
dependencies: []
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In a project without package.json, init currently skips dependency installation ('no package manager detected') and the doctor pass then circularly advises 'npx super-backlog init'. init should scaffold a minimal package.json ({name: basename(cwd), private: true}) when none exists, then proceed with the normal install so one command ends in a working setup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 init in a directory without package.json creates a minimal private package.json named after the directory and installs dependencies
- [x] #2 No scaffolding when a package.json or lockfile already exists
- [x] #3 Doctor pass after such an init resolves the backlog CLI (no circular advice)
- [x] #4 Integration test covers the scaffold path
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research planner/execute: where skipInstall/no-PM is decided. 2. TDD: failing integration test - init in dir without package.json creates minimal private package.json (name=basename) and installs. 3. Implement scaffold step before PM detection/install; skip when package.json or lockfile exists. 4. Doctor resolves backlog after such init. 5. Full suite.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
init now scaffolds a minimal package.json ({name: basename(cwd), private: true}) when none exists, then installs with npm and merges scripts/devDeps; the old 'no package manager detected' degrade path is gone. No scaffolding under --pm skip or when a package.json exists. Verified: 2 planner unit tests + 1 integration test; real run in a package.json-less dir ends with doctor 3 ok / 0 warn and backlog CLI resolvable (no circular advice). Full suite 316/316 green.
<!-- SECTION:FINAL_SUMMARY:END -->
