---
id: TASK-106
title: 'Model tiers: four-tier delegation section, rules 6 and 8, pointer template'
status: Done
assignee: []
created_date: '2026-10-10 21:37'
updated_date: '2026-10-10 22:21'
labels:
  - feature
dependencies: []
references:
  - docs/superpowers/plans/2026-10-10-model-tiers-and-project-profile.md
  - docs/superpowers/specs/2026-10-10-model-tiers-and-project-profile-design.md
type: feature
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 1. Replace the managed block's 'Model routing for subagents' section with the four-tier 'Model tiers and delegation' section (verbatim from the spec), reword rule 6, add rule 8 (respect backlog/docs/critical-areas.md, offer the project-profile skill once, only with consent), and update the CLAUDE.md pointer template. Independent of Task 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 src/templates/workflow-block.md contains the heading '### Model tiers and delegation' with the spec's verbatim text, tiers Light/Standard/Strong/Top and the three example lines; 'Model routing for subagents' no longer appears in any template, test or doc
- [ ] #2 Rule 6 and rule 8 appear verbatim as in the spec, ordered 7 < 8 < section; the block still has no table starting with '| <number> |' other than the pipeline table
- [ ] #3 src/templates/claude-pointer.md ends with the sentence naming 'Model tiers and delegation', backlog/docs/critical-areas.md and the explicit model parameter
- [ ] #4 test/unit/templates.test.ts and test/e2e/update.e2e.test.ts assert the new wording; npm test and npm run lint are green
<!-- AC:END -->
