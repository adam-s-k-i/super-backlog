---
id: TASK-30
title: >-
  Harden docs freshness gate: sidebar matching, parsing edge cases,
  self-exemption note
status: To Do
assignee: []
created_date: '2026-08-27 12:52'
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
- [ ] #1 Sidebar link check uses an exact bounded match (e.g. link: '<path>' with closing quote) so /guide/xyz no longer false-passes an unlinked new page
- [ ] #2 docs/guide/index.md-style pages map to their served URL (/guide/) instead of /guide/index
- [ ] #3 Quoted YAML frontmatter values (type: "how-to") are accepted
- [ ] #4 Renamed docs pages (git status R) undergo the same type and sidebar checks as added pages
- [ ] #5 touchesDocs excludes docs/superpowers/** so internal specs/plans alone no longer satisfy the docs-update requirement (spec wording change: flag to design owner)
- [ ] #6 CLI wrapper wraps execution in try/catch and prints actionable error messages instead of raw stack traces
- [ ] #7 CONTRIBUTING.md Documentation section states that changes to scripts/check-docs-required.mjs or .github/workflows/pr-hygiene.yml require explicit maintainer sign-off
- [ ] #8 Unit tests cover all new behaviors; npm test and npm run lint stay green
<!-- AC:END -->
