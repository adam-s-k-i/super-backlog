---
id: TASK-30
title: >-
  Harden docs freshness gate: sidebar matching, parsing edge cases,
  self-exemption note
status: Done
assignee: []
created_date: '2026-08-27 12:52'
updated_date: '2026-08-27 13:37'
labels:
  - ci
dependencies: []
references:
  - docs/superpowers/specs/2026-08-27-docs-freshness-gate-design.md
type: enhancement
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from final review of the docs-freshness-gate branch (spec docs/superpowers/specs/2026-08-27-docs-freshness-gate-design.md). Bundle of small correctness fixes in scripts/check-docs-required.mjs plus a CONTRIBUTING.md note that changes to the gate script or pr-hygiene.yml require explicit maintainer sign-off (the gate executes PR-controlled code and could otherwise exempt itself; permissions:{} contains the security blast radius, this is about enforcement integrity).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sidebar link check uses an exact bounded match (e.g. link: '<path>' with closing quote) so /guide/xyz no longer false-passes an unlinked new page
- [x] #2 docs/guide/index.md-style pages map to their served URL (/guide/) instead of /guide/index
- [x] #3 Quoted YAML frontmatter values (type: "how-to") are accepted
- [x] #4 Renamed docs pages (git status R) undergo the same type and sidebar checks as added pages
- [x] #5 touchesDocs excludes docs/superpowers/** so internal specs/plans alone no longer satisfy the docs-update requirement (spec wording change: flag to design owner)
- [x] #6 CLI wrapper wraps execution in try/catch and prints actionable error messages instead of raw stack traces
- [x] #7 CONTRIBUTING.md Documentation section states that changes to scripts/check-docs-required.mjs or .github/workflows/pr-hygiene.yml require explicit maintainer sign-off
- [x] #8 Unit tests cover all new behaviors; npm test and npm run lint stay green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TDD evidence: 6 of 7 new tests failed first (RED), all 25 green after implementation (GREEN). Full suite 312/312 locally; CI matrix (ubuntu+windows), Lint, Guard and Docs-Gate green on PR #27. CLI error path verified manually: bad --base exits nonzero with actionable message (no stack trace). Squash merge 43c1d77.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened scripts/check-docs-required.mjs per the final review of #25: exact bounded sidebar matching, index-page URL mapping, quoted YAML type values, rename (R) handling, docs/superpowers exclusion from the docs-update requirement, actionable CLI error reporting, plus maintainer sign-off note in CONTRIBUTING.md. Merged via PR #27, verified by 7 new unit tests and green CI.
<!-- SECTION:FINAL_SUMMARY:END -->
