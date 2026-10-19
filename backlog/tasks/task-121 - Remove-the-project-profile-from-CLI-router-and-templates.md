---
id: TASK-121
title: 'Remove the project profile from CLI, router and templates'
status: Done
assignee: []
created_date: '2026-10-19 17:32'
updated_date: '2026-10-19 18:32'
labels:
  - fix
dependencies: []
references:
  - docs/superpowers/plans/2026-10-19-fewer-interruptions.md
type: bug
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delete critical-areas.md support: project-profile skill template, src/lib/critical-areas.ts, doctor check 6, INIT_PROFILE_HINT, the Top-tier clause in src/models/agents.ts and the pointer sentence. Plan task 1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 skill-project-profile.md, critical-areas.ts and their tests are deleted; GLUE_SKILLS has four entries
- [x] #2 sbl doctor prints no critical-areas line; sbl init prints only the summary hint
- [x] #3 sbl-top agent description ends after 'where a mistake is costly'; claude-pointer.md does not mention critical-areas.md
- [x] #4 npm test passes
<!-- AC:END -->
