---
id: TASK-110
title: >-
  Dogfood: refresh managed glue, write this repo's critical-areas profile,
  architecture.yml
status: To Do
assignee: []
created_date: '2026-10-10 21:38'
labels:
  - chore
  - phase/spec
dependencies:
  - TASK-106
  - TASK-107
  - TASK-108
  - TASK-109
references:
  - docs/superpowers/plans/2026-10-10-model-tiers-and-project-profile.md
  - docs/superpowers/specs/2026-10-10-model-tiers-and-project-profile-design.md
type: chore
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 5. Refresh AGENTS.md, CLAUDE.md and the installed skills with sbl update --no-self (never by hand), write backlog/docs/critical-areas.md for super-backlog on the top tier through the new skill (user reviews the file before it is committed), list src/lib/critical-areas.ts and the skill template in backlog/docs/architecture.yml, and verify sbl doctor (check 6 ok) and sbl summary --check.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AGENTS.md carries the 'Model tiers and delegation' section and rule 8; CLAUDE.md names the section; .claude/skills/project-profile and .opencode/skill/project-profile exist, all written by sbl update --no-self
- [ ] #2 backlog/docs/critical-areas.md exists with a Status line without 'provisional', 4 to 7 items grouped by risk area, at most 150 words below the Status line, approved by the user before commit
- [ ] #3 backlog/docs/architecture.yml lists src/lib/critical-areas.ts and src/templates/skill-project-profile.md; sbl summary --check exits 0
- [ ] #4 sbl doctor prints '[ok]   backlog/docs/critical-areas.md present (...)' and exits 0, or 4 only for the check-5 drift line; npm test and npm run lint are green
<!-- AC:END -->
