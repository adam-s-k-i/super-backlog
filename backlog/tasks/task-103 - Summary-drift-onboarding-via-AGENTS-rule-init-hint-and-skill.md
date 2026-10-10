---
id: TASK-103
title: 'Summary drift: onboarding via AGENTS rule, init hint and skill'
status: Done
assignee: []
created_date: '2026-10-10 15:07'
updated_date: '2026-10-10 16:05'
labels:
  - feature
dependencies:
  - TASK-101
references:
  - docs/superpowers/specs/2026-10-10-summary-drift-design.md
  - docs/superpowers/plans/2026-10-10-summary-drift.md
type: feature
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 4. Make the agent offer the architecture-summary skill: binding rule 7 in the workflow block, a next-step hint at the end of sbl init when the file is missing, a drift trigger and sbl summary loop in the skill template, plus guide and quickstart docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 src/templates/workflow-block.md contains binding rule 7 verbatim from the spec, after rule 6 and before 'Model routing for subagents'
- [x] #2 sbl init prints the spec's next-step hint only when backlog/docs/architecture.yml is missing and the run is not a dry-run
- [x] #3 The architecture-summary skill template lists the trigger 'sbl summary reports drift' and its procedure runs sbl summary and fixes every finding, including pruning Done or unknown task ids
- [x] #4 docs/guide/project-summary.md has a 'Keeping it current' section (command, --check, the four signals, threshold, exit codes, agent prompt); quickstart mentions the init hint
- [x] #5 templates, glue-skills and init-preflight tests cover the changes; npm test and npm run lint pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Workflow block gains binding rule 7; sbl init prints the architecture-summary next-step hint when the file is missing (not on dry-run); the skill template adds the drift trigger and an sbl summary fix loop (stale-file clears on commit). project-summary guide has 'Keeping it current'; quickstart mentions the hint.
<!-- SECTION:FINAL_SUMMARY:END -->
