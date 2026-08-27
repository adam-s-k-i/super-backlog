---
id: TASK-29
title: Add documentation style guide and backfill type frontmatter
status: Done
assignee: []
created_date: '2026-08-27 12:00'
updated_date: '2026-08-27 13:10'
labels:
  - docs
dependencies: []
references:
  - docs/superpowers/specs/2026-08-27-docs-freshness-gate-design.md
type: docs
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a binding Documentation section to CONTRIBUTING.md describing the Diataxis page types (tutorial, how-to, reference, explanation) with guidelines: user perspective, one page equals one topic, how-tos task-oriented, reference complete. Backfill type frontmatter on the 9 existing published pages (docs/index.md, docs/operations.md, 7 guide pages) so the gate is consistent from day one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CONTRIBUTING.md has a Documentation section describing the four Diataxis types with 2-3 guidelines each
- [x] #2 All 9 existing published docs pages carry a valid type frontmatter
- [x] #3 markdownlint and cspell pass on all changed files
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: npm run lint PASS locally (markdownlint 0 issues, cspell clean) and Lint check green on PR #25. vitepress build succeeded (no dead links). Gate frontmatterType() verified against all 9 backfilled pages. Note: docs/index.md type was merged into its existing layout:page frontmatter block (two stacked blocks would break VitePress).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Documentation section to CONTRIBUTING.md (4 Diataxis types with guidelines, gate behavior, no-docs label) and backfilled type frontmatter on all 9 published pages. Lint and VitePress build verified. Merged via PR #25 (94431b7).
<!-- SECTION:FINAL_SUMMARY:END -->
