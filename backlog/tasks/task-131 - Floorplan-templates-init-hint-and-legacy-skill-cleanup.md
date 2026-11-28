---
id: TASK-131
title: 'Floorplan: templates, init hint and legacy skill cleanup'
status: To Do
assignee: []
created_date: '2026-11-28T13:50:59Z'
updated_date: '2026-11-28T14:51:15Z'
labels:
  - feature
  - phase/impl
dependencies:
  - TASK-127
references:
  - docs/superpowers/specs/2026-11-28-floorplan-integration-design.md
type: feature
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply spec decision 7: remove the architecture-summary glue skill, rewrite rule 7 of the workflow block, replace the init hint and let sbl update remove the installed legacy skill directories.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 architecture-summary is gone from GLUE_SKILLS and src/templates; sbl update removes .claude/skills/architecture-summary and .opencode/skill/architecture-summary when present and reports removed legacy <path>
- [ ] #2 Rule 7 of the workflow block has the wording from the spec; rule 8 is unchanged; the status-report and review-gate skill templates no longer mention the architecture file or sbl summary
- [ ] #3 sbl init prints INIT_FLOORPLAN_HINT only when no map exists and claude is among the selected harnesses; it installs nothing and does not probe the plugin directory
- [ ] #4 sbl uninstall still removes both legacy skill paths and does not touch floorplan/, CLAUDE.local.md or .git/info/exclude
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan section 'Task 3 (TASK-131)' in docs/superpowers/plans/2026-11-28-floorplan-integration.md: rule 7 in the workflow block, delete the architecture-summary skill template, GLUE_SKILLS/LEGACY_SKILL_DIRS, INIT_FLOORPLAN_HINT, tests first, verify, commit. Runs after TASK-128 and before TASK-130/129.
<!-- SECTION:PLAN:END -->
