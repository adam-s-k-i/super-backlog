---
id: TASK-123
title: sbl update removes the legacy project-profile skill
status: To Do
assignee: []
created_date: '2026-10-19 17:33'
updated_date: '2026-10-19 17:35'
labels:
  - fix
  - phase/spec
dependencies:
  - TASK-121
references:
  - docs/superpowers/plans/2026-10-19-fewer-interruptions.md
type: bug
ordinal: 118000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
applyCopySkills deletes .claude/skills/project-profile and .opencode/skill/project-profile and reports 'removed legacy <path>'. Plan task 3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 e2e: pre-seeded legacy skill dirs are removed and reported by sbl update
- [ ] #2 uninstall keeps both paths in OWNED_SKILL_DIRS
<!-- AC:END -->
