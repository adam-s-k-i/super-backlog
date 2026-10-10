---
id: TASK-108
title: 'Project profile: project-profile skill template and sbl init hint'
status: Done
assignee: []
created_date: '2026-10-10 21:38'
updated_date: '2026-10-10 22:22'
labels:
  - feature
dependencies:
  - TASK-107
references:
  - docs/superpowers/plans/2026-10-10-model-tiers-and-project-profile.md
  - docs/superpowers/specs/2026-10-10-model-tiers-and-project-profile-design.md
type: feature
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 3. Add src/templates/skill-project-profile.md (name: project-profile, structure like skill-architecture-summary.md, procedure and boundaries from the spec), register it as the fifth glue skill in GLUE_SKILLS so sbl init and sbl update install it for Claude Code and OpenCode, and print INIT_PROFILE_HINT after a real init while backlog/docs/critical-areas.md is missing, before INIT_SUMMARY_HINT.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 sbl init and sbl update install .claude/skills/project-profile/SKILL.md and .opencode/skill/project-profile/SKILL.md with the managed-by header
- [ ] #2 The skill template names backlog/docs/critical-areas.md, the file format with Status / Always on the top tier / Independent check / May go to lower tiers, the 150-word limit, the top-tier check, the provisional marker, the STOP step and the maintenance triggers
- [ ] #3 INIT_PROFILE_HINT is exactly the spec string and prints before INIT_SUMMARY_HINT when both files are missing, not when critical-areas.md exists, and not on --dry-run
- [ ] #4 test/unit/glue-skills.test.ts (five templates) and test/integration/init-preflight.test.ts cover the above; npm test and npm run lint are green
<!-- AC:END -->
