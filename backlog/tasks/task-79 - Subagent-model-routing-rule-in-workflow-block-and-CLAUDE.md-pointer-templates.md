---
id: TASK-79
title: 'Subagent model routing: rule in workflow block and CLAUDE.md pointer templates'
status: In Progress
assignee: []
created_date: '2026-10-09 17:48'
updated_date: '2026-10-09 18:12'
labels:
  - feature
  - phase/verify
dependencies: []
references:
  - docs/superpowers/plans/2026-10-09-subagent-model-routing.md
  - docs/superpowers/specs/2026-10-09-subagent-model-routing-design.md
type: feature
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 1. Add binding rule 6 and the harness-neutral "### Model routing for subagents" subsection (three tiers Light/Standard/Top plus per-harness examples) to src/templates/workflow-block.md, and the routing sentence to src/templates/claude-pointer.md, exactly as specified in the spec. Unit tests in test/unit/templates.test.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 workflow-block.md contains binding rule 6 and the Model routing for subagents subsection with the Light, Standard and Top tiers, the explicit-model requirement and the regardless-of-session-model clause, worded as in the spec
- [x] #2 The closing 'Project-specific human gates' lines stay last in the block and no new numbered table rows appear (dashboard-render test stays green)
- [x] #3 claude-pointer.md keeps exactly one heading and mentions the Model routing for subagents section and passing the Agent tool's model explicitly
- [x] #4 templates.test.ts covers the new strings and passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added binding rule 6 and the harness-neutral 'Model routing for subagents' subsection (Light/Standard/Top tiers) to the workflow block, plus the routing sentence to the CLAUDE.md pointer template (7bf6cf1). Verified by templates.test.ts asserting subsection, tiers, rule 6 and pointer sentence; whole branch: tsc clean, npm test 579 passed / 4 skipped, lint clean.
<!-- SECTION:FINAL_SUMMARY:END -->
