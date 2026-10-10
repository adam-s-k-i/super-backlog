---
id: TASK-87
title: 'Summary page: automatic project facts'
status: Done
assignee: []
created_date: '2026-10-09 21:51'
updated_date: '2026-10-10 09:15'
labels:
  - feature
milestone: m-2
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
type: feature
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 3. src/dashboard/summary-facts.ts collects facts per D1-D6: manifests, WordPress headers, LOC/tests, tags, workflows, lockfile versions, script commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 collectSummaryFacts(cwd) reads package.json, composer.json and WordPress plugin headers
- [ ] #2 LOC and test-file counts work with the walk fallback; the 10 MB approximation flag is set when the limit is hit
- [ ] #3 Tag count comes through an injected runCapture; scripts map to commands per detected package manager
- [ ] #4 test/unit/summary-facts.test.ts covers these with temp projects
<!-- AC:END -->
