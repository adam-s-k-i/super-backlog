---
id: TASK-5
title: 'Roadmap skills: backlog-status-report and task-review-gate'
status: Done
assignee: []
created_date: '2026-08-25 23:27'
updated_date: '2026-08-26 00:36'
labels:
  - skills
dependencies: []
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two glue skills from spec roadmap section 12, to brainstorm and build in later sessions: a status report skill that summarizes project state via backlog CLI into chat or dashboard refresh, and a review-gate skill that enforces the human checkpoint before implementation starts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 each skill has an approved mini design before implementation
- [x] #2 skills installed via templates and covered by structural tests like spec-to-backlog
- [x] #3 README and harness-support updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Templates skill-backlog-status-report.md + skill-task-review-gate.md (EN, frontmatter like spec-to-backlog). 2. Failing structural tests (new test/unit/glue-skills.test.ts covering both). 3. execute.ts copy-skills loops all skills; uninstall removes all three owned dirs. 4. README + harness-support mention both. 5. Full suite, finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: 7 new structural tests (test/unit/glue-skills.test.ts), suite 120/120 green. Dogfood proof: sbl update installed backlog-status-report + task-review-gate to .opencode/skill/ and .claude/skills/ with fingerprint headers. Uninstall coverage via OWNED_SKILL_DIRS loop. README + harness-support updated. Mini-design approved by user in chat before implementation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added glue skills backlog-status-report (read-only status summary pointing at dashboard/browser) and task-review-gate (presents task+ACs, stops for explicit approval before code). Templates, install loop for all 3 skills, uninstall coverage, docs updated. Verified: 120/120 tests, dogfooded install via sbl update.
<!-- SECTION:FINAL_SUMMARY:END -->
