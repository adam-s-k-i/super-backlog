---
id: TASK-82
title: Fix invalid YAML frontmatter in task-review-gate skill template
status: To Do
assignee: []
created_date: '2026-10-09 18:24'
updated_date: '2026-10-09 18:26'
labels:
  - bug
  - phase/verify
dependencies: []
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The description in src/templates/skill-task-review-gate.md is a plain YAML scalar containing ': ' ("task: present"), which is invalid YAML. Claude Code fails to parse the frontmatter and lists the skill with its first body line (managed-by marker) as description.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 skill-task-review-gate.md description is valid YAML (no unquoted ': ')
- [x] #2 All other templates in src/templates/ checked for the same problem
- [x] #3 Unit test asserts every template frontmatter value contains no unquoted ': ' or ' #'
- [x] #4 Dogfood copies under .claude/skills and .opencode/skill refreshed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add failing test in test/unit/templates.test.ts: every src/templates/*.md frontmatter value is either quoted or contains no ': ' / ' #'. 2. Rephrase skill-task-review-gate.md description to avoid ': '. 3. npm test, lint. 4. npm run build + node dist/bin.js update --no-self to refresh dogfood copies. 5. Local commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rephrased description (no quoting, so naive frontmatter readers don't keep literal quotes). Only skill-task-review-gate.md was affected; all other templates in src/templates/ pass the new frontmatter test. Verification: npm test 65 files / 561 passed, 4 skipped; npm run lint 0 issues; tsc --noEmit clean. Dogfood refresh also bumps managed-by stamps 1.3.1 -> 1.5.0.
<!-- SECTION:NOTES:END -->
