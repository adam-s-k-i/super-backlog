---
id: TASK-91
title: 'Summary page: architecture-summary skill and doctor check 5'
status: To Do
assignee: []
created_date: '2026-10-09 21:51'
updated_date: '2026-10-10 00:32'
labels:
  - feature
  - phase/verify
milestone: m-2
dependencies:
  - TASK-86
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
type: feature
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 7, own PR. src/templates/skill-architecture-summary.md as a glue skill that generates backlog/docs/architecture.yml, added to GLUE_SKILLS and uninstall paths, plus sbl doctor check 5 validating the file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Skill template has valid frontmatter, uses the sbl doctor loop and states the never-invent boundary
- [ ] #2 Skill is in GLUE_SKILLS (src/init/execute.ts) and removed by uninstall
- [ ] #3 sbl doctor check 5 passes on a clean file, fails with paths on a broken one, and is skipped when the file is absent
- [ ] #4 glue-skills and doctor unit tests cover the above
<!-- AC:END -->
