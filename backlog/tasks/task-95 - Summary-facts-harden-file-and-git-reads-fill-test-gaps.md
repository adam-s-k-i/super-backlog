---
id: TASK-95
title: 'Summary facts: harden file and git reads, fill test gaps'
status: To Do
assignee: []
created_date: '2026-10-10 10:28'
labels:
  - bug
  - phase/spec
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
  - src/dashboard/summary-facts.ts
  - src/lib/run.ts
type: bug
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the project-summary final review (v1.7.0). collectSummaryFacts must never throw and must stay bounded, but a huge tracked file is read fully before the size check, and runCapture has no maxBuffer, so 'git ls-files' on large repos fails with ENOBUFS and silently falls back to the directory walk. Some small code smells and test gaps remain.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 File size is checked with statSync before reading, so a single huge tracked file is skipped without being read into memory
- [ ] #2 runCapture (src/lib/run.ts) accepts or sets a maxBuffer large enough for 'git ls-files' on a repo with about 50k files; an ENOBUFS failure is reported distinctly instead of silently using the walk fallback
- [ ] #3 The data source line distinguishes 'not a git repository' from 'git unavailable'
- [ ] #4 The duplicated sort comparator is shared and the redundant catch around the workflow count is removed
- [ ] #5 Unit tests cover: licenseOf with an array value, headerField with CRLF line endings and a same-line '*/', a WordPress-theme-only project lead, and the extension set for a package.json + composer.json project; the misnamed test 'prefers a theme style.css header' is renamed to match what it asserts
- [ ] #6 npm test passes
<!-- AC:END -->
