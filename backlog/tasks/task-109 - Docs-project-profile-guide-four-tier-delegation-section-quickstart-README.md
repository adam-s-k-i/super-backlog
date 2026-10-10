---
id: TASK-109
title: 'Docs: project profile guide, four-tier delegation section, quickstart, README'
status: To Do
assignee: []
created_date: '2026-10-10 21:38'
labels:
  - feature
  - phase/spec
dependencies:
  - TASK-106
  - TASK-107
  - TASK-108
references:
  - docs/superpowers/plans/2026-10-10-model-tiers-and-project-profile.md
  - docs/superpowers/specs/2026-10-10-model-tiers-and-project-profile-design.md
type: feature
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 4. New docs/guide/project-profile.md (purpose, format, provisional marker, how the skill runs, maintenance, doctor check 6) added to the VitePress sidebar after Project summary; rename the harness-support section to 'Model tiers and delegation (all harnesses)' with the four tiers; quickstart sentence on the second init hint and check 6 in the doctor row; README doctor row and the dead router design-doc link replaced by the harness-support guide.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/guide/project-profile.md exists and is linked from the sidebar in docs/.vitepress/config.mts directly after Project summary
- [ ] #2 docs/guide/harness-support.md has the section 'Model tiers and delegation (all harnesses)' describing Light/Standard/Strong/Top, delegation criteria, the independent check and the project profile; no doc mentions 'Model routing for subagents' any more
- [ ] #3 docs/guide/quickstart.md mentions the profile hint and lists check 6 in the sbl doctor row; README.md doctor row lists the profile and line 92 no longer links to the missing 2026-08-26 design doc
- [ ] #4 npm run lint is green and npx vitepress build docs reports no dead links
<!-- AC:END -->
