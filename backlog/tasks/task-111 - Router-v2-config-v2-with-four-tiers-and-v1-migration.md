---
id: TASK-111
title: 'Router v2: config v2 with four tiers and v1 migration'
status: Done
assignee: []
created_date: '2026-10-11 00:17'
updated_date: '2026-10-11 01:13'
labels:
  - feature
  - phase/verify
dependencies: []
references:
  - docs/superpowers/plans/2026-10-11-router-v2.md
type: feature
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 1 of the router v2 plan: models.json v2 (tiers per harness, defaults, validation, never-throwing loadConfig, v1 migration, compat shims).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 loadConfig returns a normalized v2 config for missing, unparsable, v1 and v2 files without throwing
- [x] #2 v1 migration maps workhorse/budget to OpenCode standard/light and keeps discoveredAt
- [x] #3 resolveTier shim returns null; family.ts is removed
- [x] #4 unit tests cover defaults, validation and migration
<!-- AC:END -->
